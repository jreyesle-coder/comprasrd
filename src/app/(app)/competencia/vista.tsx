import Link from "next/link";
import { formatoFecha } from "@/lib/fechas";
import { monto, montoCorto, Tarjeta } from "@/componentes/comunes";
import type { Adjudicacion, Proveedor } from "./datos";

export const PERIODOS = [30, 90, 180];

export function SelectorPeriodo({ base, dias, extra = "" }: { base: string; dias: number; extra?: string }) {
  return (
    <div className="flex gap-1 text-sm">
      {PERIODOS.map((d) => (
        <Link key={d} href={`${base}?dias=${d}${extra}`} className={d === dias ? "boton-primario" : "boton-secundario"}>
          {d} días
        </Link>
      ))}
    </div>
  );
}

export function TablaProveedores({ proveedores, dias }: { proveedores: Proveedor[]; dias: number }) {
  const total = proveedores.reduce((a, p) => a + Number(p.monto ?? 0), 0);
  return (
    <Tarjeta titulo="Quién gana en tus rubros">
      {proveedores.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay adjudicaciones en este período. El historial crece con cada sincronización.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Proveedor</th>
                <th className="py-2 pr-3 text-right font-medium">Contratos</th>
                <th className="py-2 pr-3 text-right font-medium">Monto adjudicado</th>
                <th className="py-2 pr-3 text-right font-medium">Participación</th>
                <th className="py-2 font-medium">Último</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proveedores.map((p) => (
                <tr key={p.rpe}>
                  <td className="py-2 pr-3">
                    <Link href={`/competencia?dias=${dias}&rpe=${encodeURIComponent(p.rpe)}`} className="font-medium text-slate-900 hover:text-marca">{p.proveedor}</Link>
                    <div className="text-xs text-slate-500">RPE {p.rpe} · {p.instituciones} institución{p.instituciones === 1 ? "" : "es"}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.contratos}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{montoCorto(Number(p.monto))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{total ? `${((Number(p.monto) / total) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="whitespace-nowrap py-2 text-xs text-slate-500">{formatoFecha(p.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

export function TablaAdjudicaciones({ adjudicaciones, titulo = "Adjudicaciones recientes" }: { adjudicaciones: Adjudicacion[]; titulo?: string }) {
  return (
    <Tarjeta titulo={`${titulo} (${adjudicaciones.length})`}>
      {adjudicaciones.length === 0 ? (
        <p className="text-sm text-slate-500">Sin adjudicaciones en este período.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {adjudicaciones.map((a) => {
            const dif = a.monto_estimado ? ((Number(a.valor_contratado) - a.monto_estimado) / a.monto_estimado) * 100 : null;
            return (
              <li key={a.codigo_contrato} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/radar/${a.proceso_id}`} className="font-medium text-slate-900 hover:text-marca">{a.titulo}</Link>
                  <div className="text-xs text-slate-500">
                    <Link href={`/competencia/institucion/${a.unidad_compra_codigo}`} className="hover:underline">{a.institucion}</Link> · {a.subcategoria} · {formatoFecha(a.fecha_adjudicacion)}
                  </div>
                  <div className="text-xs text-emerald-800">Ganó: {a.proveedor}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{monto(Number(a.valor_contratado), a.moneda)}</div>
                  {dif != null && Number.isFinite(dif) && (
                    <div className={`text-xs ${dif <= 0 ? "text-emerald-700" : "text-red-700"}`}>{dif > 0 ? "+" : ""}{dif.toFixed(1)}% vs. estimado</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
