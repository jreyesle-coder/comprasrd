import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatoFecha, formatoFechaHora } from "@/lib/fechas";
import { ESTADOS_INTERNOS, ETIQUETA_ESTADO_INTERNO, repo } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";
import { Aviso, ChipGrupo, DiasRestantes, Encabezado, monto, Pie, Tarjeta } from "@/componentes/comunes";
import { guardarSeguimiento } from "./acciones";

export const metadata: Metadata = { title: "Detalle del proceso" };

export default async function DetalleProceso({ params, searchParams }: PageProps<"/radar/[id]">) {
  const s = await requerirEmpresa();
  const { id } = await params;
  const { guardado } = await searchParams;
  const [p, sync] = await Promise.all([repo.detalle(s.empresa.id, Number(id)), repo.ultimaSync()]);
  if (!p) notFound();

  const datos: [string, React.ReactNode][] = [
    ["Institución", p.unidad_compra_codigo ? <Link key="i" href={`/competencia/institucion/${p.unidad_compra_codigo}`} className="text-marca hover:underline">{p.institucion}</Link> : p.institucion],
    ["Modalidad", [p.modalidad, p.tipo_excepcion && p.tipo_excepcion !== "Proceso ordinario" ? p.tipo_excepcion : null].filter(Boolean).join(" · ")],
    ["Estado en el SECP", p.estado],
    ["Objeto", p.objeto_proceso],
    ["Monto estimado", <span key="m" className="font-semibold tabular-nums">{monto(p.monto_estimado, p.moneda)}</span>],
    ["Publicado", formatoFechaHora(p.fecha_publicacion)],
    ["Cierre de ofertas", <span key="c">{formatoFechaHora(p.fecha_cierre_ofertas)} <DiasRestantes cierre={p.fecha_cierre_ofertas} /></span>],
    ["Apertura de ofertas", formatoFechaHora(p.fecha_apertura_ofertas)],
    ["MIPYME", p.es_mipyme ? "Sí, dirigido a MIPYME" : "No"],
  ];

  return (
    <>
      <Encabezado sesion={s} activo="/radar" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <Link href="/radar" className="text-sm text-marca hover:underline">← Volver al listado</Link>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="font-mono text-xs text-slate-500">{p.codigo_proceso}</div>
            <ChipGrupo grupos={p.grupos} subcategoria={p.subcategorias.join(" · ")} />
          </div>
          <h1 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">{p.titulo}</h1>
          {p.descripcion && p.descripcion !== p.titulo && <p className="mt-2 text-sm text-slate-700">{p.descripcion}</p>}
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {datos.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-slate-800">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {p.url_portal && (
            <a href={p.url_portal} target="_blank" rel="noopener noreferrer" className="boton-primario mt-5">Ver en el portal de Compras ↗</a>
          )}
          <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">¿Por qué entró? </span>
            {p.motivo_match?.split("; ").map((m) => (
              <code key={m} className="mr-1.5 inline-block rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{m}</code>
            ))}
          </div>
        </div>

        <Tarjeta titulo="Seguimiento interno">
          {guardado && <div className="mb-3"><Aviso>Guardado.</Aviso></div>}
          <form action={guardarSeguimiento} className="grid gap-3 sm:grid-cols-[13rem_11rem_1fr]">
            <input type="hidden" name="id" value={p.id} />
            <div>
              <label className="etiqueta" htmlFor="estado_interno">Estado</label>
              <select id="estado_interno" name="estado_interno" defaultValue={p.estado_interno} className="campo">
                {ESTADOS_INTERNOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_INTERNO[e]}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="monto_ofertado">Monto ofertado (RD$)</label>
              <input id="monto_ofertado" name="monto_ofertado" inputMode="decimal" defaultValue={p.monto_ofertado ?? ""} className="campo" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="nota">Nota</label>
              <textarea id="nota" name="nota" defaultValue={p.nota ?? ""} rows={2} className="campo" placeholder="Ej.: pedir pliego, visita técnica el lunes…" />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <button className="boton-primario">Guardar</button>
              {p.seguimiento_actualizado_en && (
                <span className="text-xs text-slate-500">
                  Última actualización: {formatoFechaHora(p.seguimiento_actualizado_en)}
                  {p.seguimiento_actualizado_por && <> por {p.seguimiento_actualizado_por}</>}
                </span>
              )}
            </div>
          </form>
        </Tarjeta>

        {(p.contratos.length > 0 || p.ofertas.length > 0) && (
          <Tarjeta titulo="Adjudicación y ofertas">
            {p.contratos.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {p.contratos.map((c) => (
                  <li key={c.codigo_contrato} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2">
                    <span>
                      <span className="font-semibold text-emerald-900">Adjudicado a {c.proveedor ?? "—"}</span>
                      <span className="ml-2 text-xs text-emerald-800">{formatoFecha(c.fecha_adjudicacion)} · {c.estado_adjudicacion}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-900">{monto(c.valor_contratado, c.moneda)}</span>
                  </li>
                ))}
              </ul>
            )}
            {p.ofertas.length > 0 && (
              <>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ofertas recibidas ({p.ofertas.length})</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {p.ofertas.map((o, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span className="text-slate-800">{o.proveedor} <span className="text-xs text-slate-500">· {o.estado_evaluacion}</span></span>
                      <span className="tabular-nums text-slate-700">{monto(o.valor_oferta, p.moneda)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>
        )}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900 sm:px-6">Artículos ({p.articulos.length})</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-6">Descripción</th>
                  <th className="px-3 py-2 font-medium">UNSPSC</th>
                  <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2 text-right font-medium">Total estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.articulos.map((a, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-4 py-2 sm:px-6">
                      <div className="text-slate-800">{a.descripcion}</div>
                      {a.descripcion_usuario && a.descripcion_usuario !== a.descripcion && <div className="text-xs text-slate-500">{a.descripcion_usuario}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      <span className={a.relevante ? "rounded bg-marca/10 px-1 text-marca" : "text-slate-500"}>{a.codigo_unspsc}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{a.cantidad?.toLocaleString("es-DO")} {a.unidad}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{monto(a.precio_total, p.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Tarjeta titulo={`Documentos (${p.documentos.length})`}>
          {p.documentos.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no cargados (se traen en las próximas sincronizaciones) o el proceso no tiene documentos publicados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {p.documentos.map((d) => (
                <li key={d.url} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-marca hover:underline">{d.titulo ?? "Documento"}</a>
                  <span className="text-xs text-slate-500">{d.tipo && d.tipo !== "Otro" ? `${d.tipo} · ` : ""}{formatoFecha(d.fecha_publicacion)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </main>
      <Pie sync={sync} />
    </>
  );
}
