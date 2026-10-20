import type { Metadata } from "next";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { Encabezado, Pie } from "@/componentes/comunes";
import { competencia } from "../../datos";
import { PERIODOS, SelectorPeriodo, TablaAdjudicaciones, TablaProveedores } from "../../vista";

export const metadata: Metadata = { title: "Historial por institución" };

export default async function Institucion({ params, searchParams }: PageProps<"/competencia/institucion/[codigo]">) {
  const s = await requerirEmpresa();
  const { codigo } = await params;
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 180;
  const cod = Number(codigo);
  const sb = await supabaseServidor();
  const [{ proveedores, adjudicaciones }, { data: inst }, sync] = await Promise.all([
    competencia(dias, cod),
    sb.from("instituciones").select("nombre").eq("codigo_unidad_compra", cod).maybeSingle(),
    repo.ultimaSync(),
  ]);

  return (
    <>
      <Encabezado sesion={s} activo="/competencia" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/competencia" className="text-sm text-marca hover:underline">← Competencia</Link>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{inst?.nombre ?? `Institución ${cod}`}</h1>
            <p className="text-sm text-slate-600">
              Historial en tus rubros ·{" "}
              <Link href={`/radar?institucion=${cod}&abiertos=1`} className="text-marca hover:underline">ver sus procesos abiertos</Link>
            </p>
          </div>
          <SelectorPeriodo base={`/competencia/institucion/${cod}`} dias={dias} />
        </div>
        <TablaProveedores proveedores={proveedores} dias={dias} />
        <TablaAdjudicaciones adjudicaciones={adjudicaciones} titulo="Contratos adjudicados" />
      </main>
      <Pie sync={sync} />
    </>
  );
}
