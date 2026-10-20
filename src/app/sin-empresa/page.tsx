import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Sin empresa" };

export default async function SinEmpresa() {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  if (s.empresa) redirect("/radar");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Tu usuario no está asignado a una empresa</h1>
        <p className="mt-2 text-sm text-slate-600">Entraste como <b>{s.email}</b>. Pide al administrador de tu empresa que te agregue al equipo.</p>
        <form action="/auth/salir" method="post" className="mt-5"><button className="boton-secundario">Salir</button></form>
      </div>
    </main>
  );
}
