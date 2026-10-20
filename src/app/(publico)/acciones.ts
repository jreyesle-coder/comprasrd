"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

const t = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

export async function solicitarDemo(form: FormData) {
  // trampa para bots: campo oculto que una persona no llena
  if (t(form, "sitio")) redirect("/?demo=ok#demo");
  const fila = {
    nombre: t(form, "nombre", 120),
    empresa: t(form, "empresa", 120),
    email: t(form, "email", 160).toLowerCase(),
    telefono: t(form, "telefono", 40) || null,
    rubros: t(form, "rubros", 500) || null,
    mensaje: t(form, "mensaje", 1000) || null,
  };
  if (!fila.nombre || !fila.empresa || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fila.email)) redirect("/?demo=error#demo");
  const { error } = await supabaseAdmin().from("solicitudes_demo").insert(fila);
  redirect(error ? "/?demo=error#demo" : "/?demo=ok#demo");
}
