"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ESTADOS_INTERNOS, repo, type EstadoInterno } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";

const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").replace(/[^\d.]/g, "");
  return t ? Number(t) : null;
};

export async function guardarSeguimiento(form: FormData) {
  const s = await requerirEmpresa();
  const id = Number(form.get("id"));
  const estado = String(form.get("estado_interno")) as EstadoInterno;
  if (!id || !ESTADOS_INTERNOS.includes(estado)) throw new Error("Datos inválidos");
  const nota = form.has("nota") ? String(form.get("nota") ?? "").slice(0, 2000) : null;
  await repo.guardarSeguimiento(s.empresa.id, id, estado, nota, numero(form.get("monto_ofertado")), s.email);
  if (form.get("volver") === "pipeline") {
    revalidatePath("/pipeline");
    redirect("/pipeline");
  }
  redirect(`/radar/${id}?guardado=1`);
}
