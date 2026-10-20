"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Categoria } from "../../../config/categorias";
import { agregarMiembro, crearEmpresa, enlaceAcceso, quitarMiembro, reclasificar, registrarPago, subirLogo } from "@/lib/operaciones";
import { requerirSuperadmin } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const err = (ruta: string, e: unknown) => redirect(`${ruta}?error=${encodeURIComponent((e as Error).message ?? String(e))}`);

export async function nuevaEmpresa(form: FormData) {
  await requerirSuperadmin();
  let id = "";
  try {
    const plantillas = form.getAll("plantillas").map(String) as Categoria[];
    const e = await crearEmpresa({
      nombre: txt(form, "nombre"),
      slug: txt(form, "slug"),
      plantillas,
      color: txt(form, "color"),
      estado: form.get("estado") === "activa" ? "activa" : "prueba",
      diasPrueba: Number(txt(form, "dias")) || 14,
      precio: txt(form, "precio") === "" ? 100 : Number(txt(form, "precio")),
      contacto_nombre: txt(form, "contacto_nombre"),
      contacto_email: txt(form, "contacto_email"),
      contacto_telefono: txt(form, "contacto_telefono"),
    });
    id = e.id;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) {
      const url = await subirLogo(id, logo);
      await supabaseAdmin().from("empresas").update({ logo_url: url }).eq("id", id);
    }
    if (txt(form, "contacto_email")) await agregarMiembro(id, txt(form, "contacto_email"), "admin", txt(form, "contacto_nombre"));
  } catch (e) {
    if (!id) err("/admin/empresas/nueva", e);
    redirect(`/admin/empresas/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/admin");
  redirect(`/admin/empresas/${id}?ok=${encodeURIComponent("Empresa creada. Genera el enlace de acceso del administrador y envíaselo.")}`);
}

export async function editarEmpresa(form: FormData) {
  await requerirSuperadmin();
  const id = txt(form, "id");
  const ruta = `/admin/empresas/${id}`;
  try {
    const cambios: Record<string, unknown> = {
      nombre: txt(form, "nombre"),
      estado: ["prueba", "activa", "suspendida"].includes(txt(form, "estado")) ? txt(form, "estado") : "prueba",
      vence_en: txt(form, "vence_en") || null,
      precio_mensual_usd: txt(form, "precio") === "" ? 100 : Number(txt(form, "precio")),
      contacto_nombre: txt(form, "contacto_nombre") || null,
      contacto_email: txt(form, "contacto_email").toLowerCase() || null,
      contacto_telefono: txt(form, "contacto_telefono") || null,
      actualizado_en: new Date().toISOString(),
    };
    const color = txt(form, "color");
    if (/^#[0-9a-f]{6}$/i.test(color)) cambios.color_primario = color;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) cambios.logo_url = await subirLogo(id, logo);
    const { error } = await supabaseAdmin().from("empresas").update(cambios).eq("id", id);
    if (error) throw error;
  } catch (e) {
    err(ruta, e);
  }
  revalidatePath("/", "layout");
  redirect(`${ruta}?ok=Guardado`);
}

export async function pago(form: FormData) {
  const s = await requerirSuperadmin();
  const id = txt(form, "id");
  try {
    await registrarPago(
      id,
      {
        fecha: txt(form, "fecha"),
        monto: Number(txt(form, "monto")),
        moneda: txt(form, "moneda") || "USD",
        metodo: txt(form, "metodo"),
        referencia: txt(form, "referencia"),
        periodo_hasta: txt(form, "periodo_hasta"),
      },
      s.email,
    );
  } catch (e) {
    err(`/admin/empresas/${id}`, e);
  }
  revalidatePath("/admin");
  redirect(`/admin/empresas/${id}?ok=${encodeURIComponent("Pago registrado y suscripción extendida.")}`);
}

export async function agregarUsuario(form: FormData) {
  await requerirSuperadmin();
  const id = txt(form, "id");
  try {
    await agregarMiembro(id, txt(form, "email"), form.get("rol") === "admin" ? "admin" : "usuario", txt(form, "nombre"), txt(form, "clave") || undefined);
  } catch (e) {
    err(`/admin/empresas/${id}`, e);
  }
  redirect(`/admin/empresas/${id}?ok=Usuario%20agregado`);
}

export async function quitarUsuario(form: FormData) {
  await requerirSuperadmin();
  const id = txt(form, "id");
  await quitarMiembro(id, txt(form, "user_id"));
  redirect(`/admin/empresas/${id}?ok=Usuario%20quitado`);
}

export async function enlace(_prev: { enlace?: string; error?: string } | null, form: FormData) {
  await requerirSuperadmin();
  try {
    return { enlace: await enlaceAcceso(txt(form, "email")) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** El superadmin pasa a ver la app como esa empresa (cambia su propia membresía). */
export async function verComo(form: FormData) {
  const s = await requerirSuperadmin();
  const id = txt(form, "id");
  await supabaseAdmin().from("miembros").upsert({ user_id: s.userId, empresa_id: id, email: s.email, rol: "admin" });
  revalidatePath("/", "layout");
  redirect("/radar");
}

export async function reclasificarEmpresa(form: FormData) {
  await requerirSuperadmin();
  const id = txt(form, "id");
  const n = await reclasificar(id);
  redirect(`/admin/empresas/${id}?ok=${encodeURIComponent(`Reclasificado: ${n} procesos coinciden.`)}`);
}

export async function eliminarEmpresa(form: FormData) {
  const s = await requerirSuperadmin();
  const id = txt(form, "id");
  if (txt(form, "confirmar") !== "ELIMINAR") err(`/admin/empresas/${id}`, new Error('Escribe ELIMINAR para confirmar.'));
  const { data } = await supabaseAdmin().from("miembros").select("empresa_id").eq("user_id", s.userId).maybeSingle();
  if (data?.empresa_id === id) err(`/admin/empresas/${id}`, new Error("Primero cambia a otra empresa con “Ver como”."));
  await supabaseAdmin().from("empresas").delete().eq("id", id);
  revalidatePath("/admin");
  redirect("/admin?ok=Empresa%20eliminada");
}

export async function marcarSolicitud(form: FormData) {
  await requerirSuperadmin();
  await supabaseAdmin().from("solicitudes_demo").update({ atendida: form.get("atendida") === "1" }).eq("id", Number(form.get("id")));
  revalidatePath("/admin/solicitudes");
}
