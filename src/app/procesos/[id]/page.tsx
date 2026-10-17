import Link from "next/link";
import { notFound } from "next/navigation";
import { formatoFecha, formatoFechaHora } from "@/lib/fechas";
import { ESTADOS_INTERNOS, ETIQUETA_ESTADO_INTERNO, repo } from "@/lib/repo";
import { ChipCategoria, DiasRestantes, Encabezado, monto, Pie } from "../../_ui/comunes";
import { guardarSeguimiento } from "./acciones";

export default async function DetalleProceso({ params, searchParams }: PageProps<"/procesos/[id]">) {
  const { id } = await params;
  const { guardado } = await searchParams;
  const [p, sync] = await Promise.all([repo.detalle(Number(id)), repo.ultimaSync()]);
  if (!p) notFound();

  const datos: [string, React.ReactNode][] = [
    ["Institución", p.institucion],
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
      <Encabezado />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Link href="/" className="text-sm text-blue-700 hover:underline">← Volver al listado</Link>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="font-mono text-xs text-slate-500">{p.codigo_proceso}</div>
            <ChipCategoria categoria={p.categoria} subcategoria={p.subcategorias.join(" · ")} />
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

          <div className="mt-5 flex flex-wrap gap-2">
            {p.url_portal && (
              <a href={p.url_portal} target="_blank" rel="noopener noreferrer" className="boton-primario">
                Ver en el portal de Compras ↗
              </a>
            )}
          </div>

          <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">¿Por qué entró? </span>
            {p.motivo_match?.split("; ").map((m) => (
              <code key={m} className="mr-1.5 inline-block rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{m}</code>
            ))}
          </div>
        </div>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Seguimiento interno</h2>
          {guardado && <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Guardado.</p>}
          <form action={guardarSeguimiento} className="mt-3 grid gap-3 sm:grid-cols-[14rem_1fr]">
            <input type="hidden" name="id" value={p.id} />
            <div>
              <label className="etiqueta" htmlFor="estado_interno">Estado</label>
              <select id="estado_interno" name="estado_interno" defaultValue={p.estado_interno} className="campo">
                {ESTADOS_INTERNOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_INTERNO[e]}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="nota">Nota</label>
              <textarea id="nota" name="nota" defaultValue={p.nota ?? ""} rows={2} className="campo" placeholder="Ej.: pedir pliego, visita técnica el lunes…" />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button className="boton-primario">Guardar</button>
              {p.seguimiento_actualizado_en && (
                <span className="text-xs text-slate-500">
                  Última actualización: {formatoFechaHora(p.seguimiento_actualizado_en)}
                  {p.seguimiento_actualizado_por && <> por {p.seguimiento_actualizado_por}</>}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
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
                      {a.descripcion_usuario && a.descripcion_usuario !== a.descripcion && (
                        <div className="text-xs text-slate-500">{a.descripcion_usuario}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      <span className={a.relevante ? "rounded bg-blue-50 px-1 text-blue-800" : "text-slate-500"}>{a.codigo_unspsc}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {a.cantidad?.toLocaleString("es-DO")} {a.unidad}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{monto(a.precio_total, p.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Documentos ({p.documentos.length})</h2>
          {p.documentos.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Aún no cargados (se traen en las próximas sincronizaciones) o el proceso no tiene documentos publicados.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {p.documentos.map((d) => (
                <li key={d.url} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                    {d.titulo ?? "Documento"}
                  </a>
                  <span className="text-xs text-slate-500">
                    {d.tipo && d.tipo !== "Otro" ? `${d.tipo} · ` : ""}
                    {formatoFecha(d.fecha_publicacion)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Pie sync={sync} />
    </>
  );
}
