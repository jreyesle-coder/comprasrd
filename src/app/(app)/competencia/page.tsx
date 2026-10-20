import type { Metadata } from "next";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";
import { Encabezado, Pie } from "@/componentes/comunes";
import { competencia } from "./datos";
import { PERIODOS, SelectorPeriodo, TablaAdjudicaciones, TablaProveedores } from "./vista";

export const metadata: Metadata = { title: "Competencia" };

export default async function Competencia({ searchParams }: PageProps<"/competencia">) {
  const s = await requerirEmpresa();
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 90;
  const rpe = typeof sp.rpe === "string" ? sp.rpe : undefined;
  const [{ proveedores, adjudicaciones }, sync] = await Promise.all([competencia(dias, undefined, rpe), repo.ultimaSync()]);
  const nombreRpe = rpe ? adjudicaciones[0]?.proveedor ?? `RPE ${rpe}` : null;

  return (
    <>
      <Encabezado sesion={s} activo="/competencia" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{nombreRpe ? `Contratos de ${nombreRpe}` : "Competencia"}</h1>
            <p className="text-sm text-slate-600">Adjudicaciones del Estado en tus rubros: quién gana, dónde y a qué precio.</p>
            {rpe && <Link href={`/competencia?dias=${dias}`} className="text-sm text-marca hover:underline">← Ver todos los proveedores</Link>}
          </div>
          <SelectorPeriodo base="/competencia" dias={dias} extra={rpe ? `&rpe=${encodeURIComponent(rpe)}` : ""} />
        </div>
        {!rpe && <TablaProveedores proveedores={proveedores} dias={dias} />}
        <TablaAdjudicaciones adjudicaciones={adjudicaciones} />
      </main>
      <Pie sync={sync} />
    </>
  );
}
