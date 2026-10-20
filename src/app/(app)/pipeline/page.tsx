import type { Metadata } from "next";
import Link from "next/link";
import { formatoFecha } from "@/lib/fechas";
import { ESTADOS_INTERNOS, ESTADOS_PIPELINE, ETIQUETA_ESTADO_INTERNO, repo } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";
import { DiasRestantes, Encabezado, montoCorto, Pie } from "@/componentes/comunes";
import { guardarSeguimiento } from "../radar/[id]/acciones";

export const metadata: Metadata = { title: "Pipeline" };

const COLOR_COL: Record<(typeof ESTADOS_PIPELINE)[number], string> = {
  interesa: "border-t-blue-500",
  en_preparacion: "border-t-amber-500",
  ofertado: "border-t-violet-500",
  ganado: "border-t-emerald-500",
  perdido: "border-t-red-400",
};

export default async function Pipeline() {
  const s = await requerirEmpresa();
  const [filas, sync] = await Promise.all([repo.porEstados(s.empresa.id, ESTADOS_PIPELINE), repo.ultimaSync()]);
  const ganado = filas.filter((f) => f.estado_interno === "ganado");
  const cerrados = filas.filter((f) => f.estado_interno === "ganado" || f.estado_interno === "perdido").length;
  const tasa = cerrados ? Math.round((ganado.length / cerrados) * 100) : null;

  return (
    <>
      <Encabezado sesion={s} activo="/pipeline" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pipeline comercial</h1>
            <p className="text-sm text-slate-600">Marca un proceso como &quot;Interesa&quot; desde el radar y muévelo aquí según avance.</p>
          </div>
          <div className="flex gap-4 text-sm">
            <div><div className="text-xs text-slate-500">Ganado</div><div className="font-semibold text-emerald-700">{montoCorto(ganado.reduce((a, f) => a + (f.monto_ofertado ?? f.monto_estimado ?? 0), 0))}</div></div>
            <div><div className="text-xs text-slate-500">Tasa de éxito</div><div className="font-semibold">{tasa == null ? "—" : `${tasa}%`}</div></div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {ESTADOS_PIPELINE.map((estado) => {
            const col = filas.filter((f) => f.estado_interno === estado);
            const total = col.reduce((a, f) => a + (f.monto_ofertado ?? f.monto_estimado ?? 0), 0);
            return (
              <section key={estado} className={`rounded-lg border border-t-4 border-slate-200 bg-slate-50 ${COLOR_COL[estado]}`}>
                <header className="flex items-baseline justify-between px-3 py-2">
                  <h2 className="text-sm font-semibold text-slate-900">{ETIQUETA_ESTADO_INTERNO[estado]} <span className="text-slate-500">({col.length})</span></h2>
                  <span className="text-xs text-slate-500">{montoCorto(total)}</span>
                </header>
                <ul className="space-y-2 px-2 pb-2">
                  {col.length === 0 && <li className="px-1 pb-2 text-xs text-slate-400">Vacío</li>}
                  {col.map((p) => (
                    <li key={p.id} className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
                      <Link href={`/radar/${p.id}`} className="line-clamp-3 text-sm font-medium text-slate-900 hover:text-marca">{p.titulo}</Link>
                      <div className="mt-1 truncate text-xs text-slate-500">{p.institucion}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold tabular-nums">{montoCorto(p.monto_ofertado ?? p.monto_estimado)}</span>
                        {["interesa", "en_preparacion"].includes(estado) ? <DiasRestantes cierre={p.fecha_cierre_ofertas} /> : <span className="text-slate-400">{formatoFecha(p.fecha_cierre_ofertas)}</span>}
                      </div>
                      <form action={guardarSeguimiento} className="mt-2 flex gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="volver" value="pipeline" />
                        <select name="estado_interno" defaultValue={estado} className="campo py-0.5 text-xs" aria-label="Mover a">
                          {ESTADOS_INTERNOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_INTERNO[e]}</option>)}
                        </select>
                        <button className="boton-secundario px-2 py-0.5 text-xs">Mover</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
      <Pie sync={sync} />
    </>
  );
}
