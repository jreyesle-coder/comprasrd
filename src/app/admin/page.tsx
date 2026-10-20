import type { Metadata } from "next";
import Link from "next/link";
import { formatoFecha, formatoFechaHora, fechaRD } from "@/lib/fechas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Aviso, Tarjeta } from "@/componentes/comunes";

export const metadata: Metadata = { title: "Administración" };

const ESTILO_ESTADO = { prueba: "bg-amber-100 text-amber-800", activa: "bg-emerald-100 text-emerald-800", suspendida: "bg-red-100 text-red-800" } as const;

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const { ok } = await searchParams;
  const db = supabaseAdmin();
  const [{ data: empresas }, { data: miembros }, { count: solicitudes }, { data: sync }] = await Promise.all([
    db.from("empresas").select("id, nombre, slug, estado, vence_en, precio_mensual_usd, contacto_email, creado_en").order("creado_en"),
    db.from("miembros").select("empresa_id"),
    db.from("solicitudes_demo").select("id", { count: "exact", head: true }).eq("atendida", false),
    db.from("sync_log").select("fin, exito, procesos_leidos, coincidencias, peticiones_api, errores").order("id", { ascending: false }).limit(5),
  ]);
  const contar = (lista: { empresa_id: string }[] | null) => (lista ?? []).reduce<Record<string, number>>((a, x) => ((a[x.empresa_id] = (a[x.empresa_id] ?? 0) + 1), a), {});
  const nMiembros = contar(miembros);
  const nCoinc: Record<string, number> = Object.fromEntries(
    await Promise.all(
      (empresas ?? []).map(async (e) => [e.id, (await db.from("coincidencias").select("proceso_id", { count: "exact", head: true }).eq("empresa_id", e.id)).count ?? 0]),
    ),
  );
  const hoy = fechaRD();
  const activas = (empresas ?? []).filter((e) => e.estado === "activa" && (!e.vence_en || e.vence_en >= hoy));
  const mrr = activas.reduce((a, e) => a + Number(e.precio_mensual_usd), 0);

  return (
    <>
      {ok && <Aviso>{String(ok)}</Aviso>}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Empresas", empresas?.length ?? 0],
          ["Activas (pagando)", activas.length],
          ["Ingreso mensual", `US$ ${mrr.toLocaleString("es-DO")}`],
          ["Solicitudes de demo", solicitudes ?? 0],
        ].map(([t, v]) => (
          <div key={t} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-xs text-slate-500">{t}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </section>

      <Tarjeta titulo="Empresas" accion={<Link href="/admin/empresas/nueva" className="boton-primario">Nueva empresa</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Empresa</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Vence</th>
                <th className="py-2 pr-3 text-right font-medium">Usuarios</th>
                <th className="py-2 pr-3 text-right font-medium">Procesos en su radar</th>
                <th className="py-2 text-right font-medium">US$/mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(empresas ?? []).map((e) => {
                const vencida = e.vence_en && e.vence_en < hoy;
                return (
                  <tr key={e.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/empresas/${e.id}`} className="font-medium text-slate-900 hover:underline">{e.nombre}</Link>
                      <div className="text-xs text-slate-500">{e.contacto_email ?? e.slug}</div>
                    </td>
                    <td className="py-2 pr-3"><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[e.estado as keyof typeof ESTILO_ESTADO]}`}>{e.estado}</span></td>
                    <td className={`whitespace-nowrap py-2 pr-3 ${vencida ? "font-semibold text-red-700" : "text-slate-600"}`}>
                      {e.vence_en ? formatoFecha(`${e.vence_en}T12:00:00Z`) : "—"}{vencida && " (vencida)"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nMiembros[e.id] ?? 0}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{(nCoinc[e.id] ?? 0).toLocaleString("es-DO")}</td>
                    <td className="py-2 text-right tabular-nums">{e.precio_mensual_usd}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Últimas sincronizaciones">
        <ul className="divide-y divide-slate-100 text-sm">
          {(sync ?? []).map((x, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span className={x.exito ? "text-slate-700" : "font-semibold text-red-700"}>{x.fin ? formatoFechaHora(x.fin) : "en curso"} · {x.exito ? "OK" : x.fin ? "falló" : "…"}</span>
              <span className="text-xs text-slate-500">{x.procesos_leidos ?? 0} procesos · {x.coincidencias ?? 0} coincidencias · {x.peticiones_api ?? 0} peticiones{x.errores ? " · con errores" : ""}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </>
  );
}
