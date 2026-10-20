import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServidor } from "./supabase/server";

export interface Empresa {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  estado: "prueba" | "activa" | "suspendida";
  plan: string;
  precio_mensual_usd: number;
  vence_en: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  exclusiones_unspsc: string[];
  exclusiones_palabras: string[];
  alertas_activas: boolean;
  alertas_destinatarios: string[];
  onboarding_completado: boolean;
}

export interface Sesion {
  userId: string;
  email: string;
  rol: "admin" | "usuario" | null;
  superadmin: boolean;
  empresa: Empresa | null;
  habilitada: boolean;
}

/** Sesión del usuario actual (una vez por petición). null si no ha iniciado sesión. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const email = (data.user.email ?? "").toLowerCase();
  const [{ data: miembro }, { data: sa }] = await Promise.all([
    sb.from("miembros").select("rol, empresas(*)").eq("user_id", data.user.id).maybeSingle(),
    sb.from("superadmins").select("email").eq("email", email).maybeSingle(),
  ]);
  const empresa = (miembro?.empresas ?? null) as unknown as Empresa | null;
  const hoy = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
  const habilitada = Boolean(empresa && empresa.estado !== "suspendida" && (!empresa.vence_en || empresa.vence_en >= hoy));
  return {
    userId: data.user.id,
    email,
    rol: (miembro?.rol as Sesion["rol"]) ?? null,
    superadmin: Boolean(sa),
    empresa,
    habilitada: habilitada || Boolean(sa),
  };
});

/** Exige sesión con empresa habilitada; si no, redirige a donde corresponda. */
export async function requerirEmpresa(): Promise<Sesion & { empresa: Empresa }> {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  if (!s.empresa) redirect(s.superadmin ? "/admin" : "/sin-empresa");
  if (!s.habilitada) redirect("/suspendida");
  return s as Sesion & { empresa: Empresa };
}

export async function requerirAdminEmpresa() {
  const s = await requerirEmpresa();
  if (s.rol !== "admin" && !s.superadmin) redirect("/radar");
  return s;
}

export async function requerirSuperadmin() {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  if (!s.superadmin) redirect("/radar");
  return s;
}
