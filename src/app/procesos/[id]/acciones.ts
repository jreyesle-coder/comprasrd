"use server";

import { redirect } from "next/navigation";
import { ESTADOS_INTERNOS, repo, type EstadoInterno } from "@/lib/repo";
import { usuarioActual } from "@/lib/supabase/server";

export async function guardarSeguimiento(form: FormData) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");
  const id = Number(form.get("id"));
  const estado = String(form.get("estado_interno")) as EstadoInterno;
  if (!id || !ESTADOS_INTERNOS.includes(estado)) throw new Error("Datos inválidos");
  const nota = String(form.get("nota") ?? "").slice(0, 2000);
  await repo.guardarSeguimiento(id, estado, nota, usuario);
  redirect(`/procesos/${id}?guardado=1`);
}
