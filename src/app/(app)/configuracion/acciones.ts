"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agregarMiembro, enlaceAcceso, quitarMiembro, subirLogo } from "@/lib/operaciones";
import { requerirAdminEmpresa } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";

const volver = (msg: string, ancla = "") => redirect(`/configuracion?ok=${encodeURIComponent(msg)}${ancla}`);
const fallo = (e: unknown, ancla = "") =>
  redirect(`/configuracion?error=${encodeURIComponent((e as Error).message ?? String(e))}${ancla}`);

export async function guardarMarca(form: FormData) {
  const s = await requerirAdminEmpresa();
  try {
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
    const nombre = String(form.get("nombre") ?? "").trim();
    if (nombre) cambios.nombre = nombre.slice(0, 80);
    const color = String(form.get("color") ?? "");
    if (/^#[0-9a-f]{6}$/i.test(color)) cambios.color_primario = color;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) cambios.logo_url = await subirLogo(s.empresa.id, logo);
    if (form.get("quitar_logo") === "1") cambios.logo_url = null;
    const { error } = await supabaseAdmin().from("empresas").update(cambios).eq("id", s.empresa.id);
    if (error) throw error;
  } catch (e) {
    fallo(e, "#marca");
  }
  revalidatePath("/", "layout");
  volver("Marca actualizada", "#marca");
}

export async function invitar(form: FormData) {
  const s = await requerirAdminEmpresa();
  try {
    const rol = form.get("rol") === "admin" ? "admin" : "usuario";
    await agregarMiembro(s.empresa.id, String(form.get("email") ?? ""), rol, String(form.get("nombre") ?? ""));
  } catch (e) {
    fallo(e, "#equipo");
  }
  revalidatePath("/configuracion");
  volver("Usuario agregado. Genera su enlace de acceso o pídele que entre con su correo.", "#equipo");
}

export async function quitar(form: FormData) {
  const s = await requerirAdminEmpresa();
  const userId = String(form.get("user_id"));
  if (userId === s.userId) fallo(new Error("No puedes quitarte a ti mismo."), "#equipo");
  await quitarMiembro(s.empresa.id, userId);
  revalidatePath("/configuracion");
  volver("Usuario quitado", "#equipo");
}

export async function cambiarRol(form: FormData) {
  const s = await requerirAdminEmpresa();
  const userId = String(form.get("user_id"));
  const rol = form.get("rol") === "admin" ? "admin" : "usuario";
  if (userId === s.userId && rol !== "admin") fallo(new Error("No puedes quitarte el rol de administrador."), "#equipo");
  await supabaseAdmin().from("miembros").update({ rol }).eq("user_id", userId).eq("empresa_id", s.empresa.id);
  revalidatePath("/configuracion");
  volver("Rol actualizado", "#equipo");
}

/** Devuelve el enlace en el estado del formulario (no en la URL). */
export async function generarEnlace(_prev: { enlace?: string; error?: string } | null, form: FormData) {
  const s = await requerirAdminEmpresa();
  const email = String(form.get("email") ?? "");
  const { data } = await supabaseAdmin().from("miembros").select("email").eq("empresa_id", s.empresa.id).eq("email", email).maybeSingle();
  if (!data && !s.superadmin) return { error: "Ese usuario no es de tu empresa." };
  try {
    return { enlace: await enlaceAcceso(email) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function guardarAlertas(form: FormData) {
  const s = await requerirAdminEmpresa();
  const lista = String(form.get("destinatarios") ?? "")
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  await supabaseAdmin()
    .from("empresas")
    .update({ alertas_activas: form.get("activas") === "1", alertas_destinatarios: [...new Set(lista)].slice(0, 20) })
    .eq("id", s.empresa.id);
  revalidatePath("/configuracion");
  volver("Alertas guardadas", "#alertas");
}

export async function completarBienvenida() {
  const s = await requerirAdminEmpresa();
  await supabaseAdmin().from("empresas").update({ onboarding_completado: true }).eq("id", s.empresa.id);
  revalidatePath("/radar");
}
