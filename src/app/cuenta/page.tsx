import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioClave } from "./formulario";

export const metadata: Metadata = { title: "Mi cuenta" };

/** Fuera del layout de empresa para que también funcione si la suscripción está pausada. */
export default async function Cuenta() {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" style={{ ["--marca" as string]: s.empresa?.color_primario ?? "#1d4ed8" }}>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/radar" className="text-sm text-marca hover:underline">← Volver al radar</Link>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Mi cuenta</h1>
        <p className="mt-1 text-sm text-slate-600">{s.email}{s.empresa ? ` · ${s.empresa.nombre}` : ""}</p>
        <h2 className="mt-5 text-sm font-semibold text-slate-900">Contraseña</h2>
        <p className="mt-1 text-xs text-slate-500">Con ella entras con tu correo y contraseña, sin esperar el enlace.</p>
        <FormularioClave />
      </div>
    </main>
  );
}
