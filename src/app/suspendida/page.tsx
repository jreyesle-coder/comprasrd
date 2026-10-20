import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { formatoFecha } from "@/lib/fechas";
import { Logo } from "@/componentes/comunes";

export const metadata: Metadata = { title: "Cuenta suspendida" };

export default async function Suspendida() {
  const s = await obtenerSesion();
  if (!s) redirect("/login");
  if (s.habilitada) redirect("/radar");
  const e = s.empresa;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" style={{ ["--marca" as string]: e?.color_primario ?? "#1d4ed8" }}>
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="flex justify-center"><Logo url={e?.logo_url} nombre={e?.nombre ?? "Radar"} tam={40} /></div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">El acceso de {e?.nombre} está pausado</h1>
        <p className="mt-2 text-sm text-slate-600">
          {e?.estado === "suspendida"
            ? "La cuenta fue suspendida."
            : `La suscripción venció el ${formatoFecha(e?.vence_en ? `${e.vence_en}T12:00:00Z` : null)}.`}{" "}
          Tus datos y seguimientos se conservan. Para reactivarla, escribe a tu proveedor del servicio.
        </p>
        <form action="/auth/salir" method="post" className="mt-5">
          <button className="boton-secundario">Salir</button>
        </form>
      </div>
    </main>
  );
}
