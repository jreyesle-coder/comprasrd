import Link from "next/link";
import type { Empresa } from "@/lib/sesion";
import { completarBienvenida } from "../configuracion/acciones";

/** Lista de primeros pasos para el administrador de una empresa nueva. */
export function Bienvenida({ empresa }: { empresa: Empresa }) {
  const pasos = [
    { hecho: Boolean(empresa.logo_url), texto: "Sube el logo y elige el color de tu empresa", href: "/configuracion" },
    { hecho: true, texto: "Revisa los rubros que te interesan (ya vienen precargados)", href: "/configuracion/rubros" },
    { hecho: empresa.alertas_destinatarios.length > 0, texto: "Indica quién recibe el resumen diario por correo", href: "/configuracion#alertas" },
    { hecho: false, texto: "Invita a tu equipo", href: "/configuracion#equipo" },
  ];
  return (
    <section className="mb-5 rounded-lg border border-marca/30 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bienvenido a tu Radar, {empresa.nombre}</h2>
          <p className="mt-1 text-sm text-slate-600">Cuatro pasos para dejarlo a tu medida:</p>
        </div>
        <form action={completarBienvenida}>
          <button className="text-xs text-slate-500 hover:underline">Ocultar</button>
        </form>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {pasos.map((p, i) => (
          <li key={p.texto}>
            <Link href={p.href} className="flex items-center gap-3 rounded-md border border-slate-200 p-2.5 text-sm hover:border-marca">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${p.hecho ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {p.hecho ? "✓" : i + 1}
              </span>
              <span className={p.hecho ? "text-slate-500" : "text-slate-800"}>{p.texto}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
