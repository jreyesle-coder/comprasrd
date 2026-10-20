import "server-only";
import { headers } from "next/headers";
import type { Categoria } from "../../config/categorias";
import { normalizar } from "./clasificador";
import { EXCLUSIONES_POR_DEFECTO, reglasDePlantillas } from "./plantillas";
import { supabaseAdmin } from "./supabase/admin";

const DIAS_RECLASIFICAR = 120;

function ok<T>(r: { data: T; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data;
}

export function slugDe(texto: string) {
  return normalizar(texto).replace(/ /g, "-").slice(0, 40).replace(/-+$/, "") || "empresa";
}

export async function origenApp() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Re-clasifica los procesos de los últimos 120 días para una empresa. Devuelve cuántos coinciden. */
export async function reclasificar(empresaId: string) {
  const desde = new Date(Date.now() - DIAS_RECLASIFICAR * 86_400_000).toISOString();
  return ok(await supabaseAdmin().rpc("clasificar_procesos", { p_empresa: empresaId, p_desde: desde }), "clasificar") as number;
}

export async function crearEmpresa(d: {
  nombre: string;
  slug?: string;
  plantillas: Categoria[];
  color?: string;
  estado: "prueba" | "activa";
  diasPrueba: number;
  precio: number;
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
}) {
  const db = supabaseAdmin();
  const vence = new Date(Date.now() + d.diasPrueba * 86_400_000).toISOString().slice(0, 10);
  const empresa = ok(
    await db
      .from("empresas")
      .insert({
        nombre: d.nombre.trim(),
        slug: slugDe(d.slug || d.nombre),
        color_primario: /^#[0-9a-f]{6}$/i.test(d.color ?? "") ? d.color : "#1d4ed8",
        estado: d.estado,
        vence_en: vence,
        precio_mensual_usd: d.precio,
        contacto_nombre: d.contacto_nombre || null,
        contacto_email: d.contacto_email?.toLowerCase() || null,
        contacto_telefono: d.contacto_telefono || null,
        alertas_destinatarios: d.contacto_email ? [d.contacto_email.toLowerCase()] : [],
        ...EXCLUSIONES_POR_DEFECTO,
      })
      .select("id, slug")
      .single(),
    "crear empresa",
  ) as { id: string; slug: string };
  const reglas = reglasDePlantillas(d.plantillas).map((r) => ({ ...r, empresa_id: empresa.id }));
  if (reglas.length) ok(await db.from("reglas").insert(reglas), "rubros");
  await reclasificar(empresa.id);
  return empresa;
}

/** Crea (o reutiliza) el usuario y lo asigna a la empresa. */
export async function agregarMiembro(empresaId: string, email: string, rol: "admin" | "usuario", nombre?: string) {
  const db = supabaseAdmin();
  const correo = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error("Correo inválido");
  let userId: string | undefined;
  const creado = await db.auth.admin.createUser({ email: correo, email_confirm: true });
  if (creado.data.user) userId = creado.data.user.id;
  else {
    // ya existía: buscarlo
    for (let page = 1; page < 50 && !userId; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      userId = data.users.find((u) => u.email?.toLowerCase() === correo)?.id;
      if (data.users.length < 1000) break;
    }
  }
  if (!userId) throw new Error(creado.error?.message ?? "No se pudo crear el usuario");
  const existente = ok(await db.from("miembros").select("empresa_id").eq("user_id", userId).maybeSingle(), "miembro");
  if (existente && existente.empresa_id !== empresaId) throw new Error("Ese correo ya pertenece a otra empresa.");
  ok(await db.from("miembros").upsert({ user_id: userId, empresa_id: empresaId, email: correo, rol, nombre: nombre || null }), "miembro");
  return userId;
}

export async function quitarMiembro(empresaId: string, userId: string) {
  ok(await supabaseAdmin().from("miembros").delete().eq("user_id", userId).eq("empresa_id", empresaId), "quitar miembro");
}

/**
 * Enlace de acceso de un solo uso (vence en 1 h) para compartir por WhatsApp o correo.
 * No depende del envío de correos de Supabase.
 */
export async function enlaceAcceso(email: string) {
  const r = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email: email.toLowerCase() });
  const hash = r.data?.properties?.hashed_token;
  if (r.error || !hash) throw new Error(r.error?.message ?? "No se pudo generar el enlace");
  return `${await origenApp()}/auth/callback?token_hash=${hash}&type=magiclink`;
}

const TIPOS_LOGO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };

export async function subirLogo(empresaId: string, archivo: File) {
  if (!archivo.size) return null;
  const ext = TIPOS_LOGO[archivo.type];
  if (!ext) throw new Error("El logo debe ser PNG, JPG, SVG o WEBP.");
  if (archivo.size > 1_000_000) throw new Error("El logo debe pesar menos de 1 MB.");
  const db = supabaseAdmin();
  await db.storage.createBucket("logos", { public: true }).catch(() => {});
  const ruta = `${empresaId}/logo-${Date.now()}.${ext}`;
  const sube = await db.storage.from("logos").upload(ruta, archivo, { contentType: archivo.type, upsert: true });
  if (sube.error) {
    if (/not found/i.test(sube.error.message)) {
      await db.storage.createBucket("logos", { public: true });
      const otra = await db.storage.from("logos").upload(ruta, archivo, { contentType: archivo.type, upsert: true });
      if (otra.error) throw new Error(otra.error.message);
    } else throw new Error(sube.error.message);
  }
  return db.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
}

/** Registra un pago y extiende la suscripción hasta `periodo_hasta`. */
export async function registrarPago(
  empresaId: string,
  p: { fecha: string; monto: number; moneda: string; metodo: string; referencia: string; periodo_hasta: string },
  por: string,
) {
  const db = supabaseAdmin();
  ok(await db.from("pagos").insert({ ...p, empresa_id: empresaId, registrado_por: por }), "pago");
  ok(await db.from("empresas").update({ vence_en: p.periodo_hasta, estado: "activa", actualizado_en: new Date().toISOString() }).eq("id", empresaId), "vigencia");
}
