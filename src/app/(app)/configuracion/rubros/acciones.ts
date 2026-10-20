"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reclasificar } from "@/lib/operaciones";
import { normalizarCodigos, normalizarPalabras } from "@/lib/plantillas";
import { requerirAdminEmpresa } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";

const lista = (v: FormDataEntryValue | null) => String(v ?? "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

async function terminar(empresaId: string, msg: string) {
  const n = await reclasificar(empresaId);
  revalidatePath("/", "layout");
  redirect(`/configuracion/rubros?ok=${encodeURIComponent(`${msg} Tu radar tiene ahora ${n.toLocaleString("es-DO")} procesos (últimos 120 días).`)}`);
}

export async function guardarRegla(form: FormData) {
  const s = await requerirAdminEmpresa();
  const id = String(form.get("id") ?? "");
  const fila = {
    empresa_id: s.empresa.id,
    grupo: String(form.get("grupo") ?? "").trim().slice(0, 60) || "General",
    nombre: String(form.get("nombre") ?? "").trim().slice(0, 80),
    unspsc: normalizarCodigos(lista(form.get("unspsc")).flatMap((x) => x.split(/\s+/))),
    palabras: normalizarPalabras(lista(form.get("palabras"))),
    activa: form.get("activa") === "1",
  };
  if (!fila.nombre) redirect(`/configuracion/rubros?error=${encodeURIComponent("La subcategoría necesita un nombre.")}`);
  if (!fila.unspsc.length && !fila.palabras.length)
    redirect(`/configuracion/rubros?error=${encodeURIComponent("Agrega al menos un código UNSPSC o una palabra clave.")}`);
  const db = supabaseAdmin();
  const r = id
    ? await db.from("reglas").update(fila).eq("id", id).eq("empresa_id", s.empresa.id)
    : await db.from("reglas").insert({ ...fila, orden: 1000 });
  if (r.error) redirect(`/configuracion/rubros?error=${encodeURIComponent(/duplicate/.test(r.error.message) ? "Ya existe una subcategoría con ese nombre." : r.error.message)}`);
  await terminar(s.empresa.id, id ? `“${fila.nombre}” actualizada.` : `“${fila.nombre}” creada.`);
}

export async function eliminarRegla(form: FormData) {
  const s = await requerirAdminEmpresa();
  await supabaseAdmin().from("reglas").delete().eq("id", String(form.get("id"))).eq("empresa_id", s.empresa.id);
  await terminar(s.empresa.id, "Subcategoría eliminada.");
}

export async function guardarExclusiones(form: FormData) {
  const s = await requerirAdminEmpresa();
  await supabaseAdmin()
    .from("empresas")
    .update({
      exclusiones_palabras: normalizarPalabras(lista(form.get("palabras"))),
      exclusiones_unspsc: normalizarCodigos(lista(form.get("unspsc")).flatMap((x) => x.split(/\s+/))),
    })
    .eq("id", s.empresa.id);
  await terminar(s.empresa.id, "Exclusiones guardadas.");
}

/** Vista previa: cuántos procesos de los últimos 30 días entrarían con estos códigos/palabras. */
export async function vistaPrevia(unspsc: string, palabras: string) {
  await requerirAdminEmpresa();
  const { data, error } = await supabaseAdmin().rpc("contar_coincidencias", {
    p_unspsc: normalizarCodigos(lista(unspsc).flatMap((x) => x.split(/\s+/))),
    p_palabras: normalizarPalabras(lista(palabras)),
    p_dias: 30,
  });
  if (error) return { error: error.message };
  return { total: data as number };
}
