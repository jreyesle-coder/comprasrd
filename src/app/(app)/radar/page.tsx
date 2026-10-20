import type { Metadata } from "next";
import Link from "next/link";
import { fechaRD, formatoFecha, sumarDias } from "@/lib/fechas";
import { aQuery, type ColumnaOrden, ESTADOS_INTERNOS, ESTADOS_PROCESO, ETIQUETA_ESTADO_INTERNO, leerFiltros, MODALIDADES, POR_PAGINA, repo } from "@/lib/repo";
import { requerirEmpresa } from "@/lib/sesion";
import { ChipGrupo, DiasRestantes, Encabezado, EstadoInternoTexto, monto, Pie } from "@/componentes/comunes";
import { Bienvenida } from "./bienvenida";

export const metadata: Metadata = { title: "Radar" };

const COLUMNAS: [ColumnaOrden, string, boolean?][] = [
  ["proceso", "Proceso"],
  ["institucion", "Institución"],
  ["categoria", "Categoría"],
  ["modalidad", "Modalidad"],
  ["monto", "Monto estimado", true],
  ["publicado", "Publicado"],
  ["cierre", "Cierre"],
  ["interno", "Interno"],
];

export default async function Radar({ searchParams }: PageProps<"/radar">) {
  const s = await requerirEmpresa();
  const sp = await searchParams;
  const f = leerFiltros(sp);
  const reglas = await repo.reglas(s.empresa.id);
  const grupos = [...new Set(reglas.filter((r) => r.activa).map((r) => r.grupo))];
  const [{ filas, total }, cont, instituciones, sync] = await Promise.all([
    repo.listar(s.empresa.id, f),
    repo.contadores(s.empresa.id, grupos),
    repo.instituciones(s.empresa.id),
    repo.ultimaSync(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Object.keys(sp).some((k) => !["pagina", "orden", "dir"].includes(k));
  const subcats = reglas.filter((r) => r.activa && (!f.grupo || r.grupo === f.grupo));
  const hoy = fechaRD();

  const tarjetas = [
    { titulo: "Nuevos (ayer y hoy)", valor: cont.nuevosHoy, href: `/radar?desde=${sumarDias(hoy, -1)}` },
    { titulo: "Abiertos", valor: cont.abiertos, href: "/radar?abiertos=1" },
    { titulo: "Cierran en ≤ 7 días", valor: cont.cierranSemana, href: "/radar?abiertos=1", alerta: true },
    ...cont.porGrupo.map((g) => ({
      titulo: `${g.grupo} (abiertos)`,
      valor: g.abiertos,
      href: `/radar?abiertos=1&grupo=${encodeURIComponent(g.grupo)}`,
      alerta: false,
    })),
  ];

  return (
    <>
      <Encabezado sesion={s} activo="/radar" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        {(s.rol === "admin" || s.superadmin) && !s.empresa.onboarding_completado && <Bienvenida empresa={s.empresa} />}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tarjetas.map((t) => (
            <Link key={t.titulo} href={t.href} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-marca">
              <div className="text-xs text-slate-500">{t.titulo}</div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${t.alerta && t.valor ? "text-amber-700" : "text-slate-900"}`}>
                {t.valor.toLocaleString("es-DO")}
              </div>
            </Link>
          ))}
        </section>

        <details className="group mt-5 rounded-lg border border-slate-200 bg-white shadow-sm" open={hayFiltros}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800">
            <span>Filtros {hayFiltros && <span className="ml-1 font-normal text-marca">(activos)</span>}</span>
            <span className="text-slate-400 group-open:rotate-180">▾</span>
          </summary>
          <form method="get" className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="q">Buscar</label>
              <input id="q" name="q" defaultValue={f.q} placeholder="Título, institución o código…" className="campo" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="grupo">Categoría</label>
              <select id="grupo" name="grupo" defaultValue={f.grupo ?? ""} className="campo">
                <option value="">Todas</option>
                {grupos.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="subcategoria">Subcategoría</label>
              <select id="subcategoria" name="subcategoria" defaultValue={f.subcategoria ?? ""} className="campo">
                <option value="">Todas</option>
                {subcats.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="institucion">Institución</label>
              <select id="institucion" name="institucion" defaultValue={f.institucion ?? ""} className="campo">
                <option value="">Todas</option>
                {instituciones.map((i) => <option key={i.codigo} value={i.codigo}>{i.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="modalidad">Modalidad</label>
              <select id="modalidad" name="modalidad" defaultValue={f.modalidad ?? ""} className="campo">
                <option value="">Todas</option>
                {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="estado">Estado del proceso</label>
              <select id="estado" name="estado" defaultValue={f.estado ?? ""} className="campo">
                <option value="">Todos</option>
                {ESTADOS_PROCESO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta">Monto estimado (RD$)</label>
              <div className="flex gap-2">
                <input name="monto_min" defaultValue={f.montoMin} inputMode="numeric" placeholder="Desde" className="campo" />
                <input name="monto_max" defaultValue={f.montoMax} inputMode="numeric" placeholder="Hasta" className="campo" />
              </div>
            </div>
            <div>
              <label className="etiqueta">Publicado entre</label>
              <div className="flex gap-2">
                <input type="date" name="desde" defaultValue={f.desde} className="campo" aria-label="Desde" />
                <input type="date" name="hasta" defaultValue={f.hasta} className="campo" aria-label="Hasta" />
              </div>
            </div>
            <div>
              <label className="etiqueta" htmlFor="estado_interno">Estado interno</label>
              <select id="estado_interno" name="estado_interno" defaultValue={f.estadoInterno ?? ""} className="campo">
                <option value="">Todos</option>
                {ESTADOS_INTERNOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_INTERNO[e]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-4 pb-1.5 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="abiertos" value="1" defaultChecked={f.abiertos} className="h-4 w-4" /> Solo abiertos
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="mipyme" value="1" defaultChecked={f.mipyme} className="h-4 w-4" /> Solo MIPYME
              </label>
            </div>
            <div>
              <label className="etiqueta" htmlFor="orden">Ordenar por</label>
              <div className="flex gap-2">
                <select id="orden" name="orden" defaultValue={f.orden} className="campo">
                  {COLUMNAS.map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
                </select>
                <select name="dir" defaultValue={f.dir} className="campo w-28" aria-label="Dirección">
                  <option value="desc">Mayor a menor</option>
                  <option value="asc">Menor a mayor</option>
                </select>
              </div>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <button className="boton-primario">Aplicar filtros</button>
              <Link href="/radar" className="boton-secundario">Limpiar</Link>
            </div>
          </form>
        </details>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{total.toLocaleString("es-DO")}</span> procesos
            {paginas > 1 && <> · página {f.pagina} de {paginas}</>}
          </p>
          <a href={`/api/exportar${aQuery(sp, { pagina: undefined })}`} className="boton-secundario">Exportar a Excel</a>
        </div>

        {filas.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No hay procesos con estos filtros.
          </div>
        ) : (
          <>
            <div className="mt-3 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {COLUMNAS.map(([clave, texto, derecha]) => {
                      const activa = f.orden === clave;
                      const dir = activa ? (f.dir === "asc" ? "desc" : "asc") : clave === "publicado" || clave === "monto" ? "desc" : "asc";
                      return (
                        <th key={clave} className={`px-3 py-2 font-medium ${derecha ? "text-right" : ""}`} aria-sort={activa ? (f.dir === "asc" ? "ascending" : "descending") : undefined}>
                          <Link
                            href={`/radar${aQuery(sp, { orden: clave, dir, pagina: undefined })}`}
                            className={`inline-flex items-center gap-1 hover:text-slate-900 ${activa ? "text-slate-900" : ""}`}
                            title={`Ordenar por ${texto.toLowerCase()}`}
                          >
                            {texto}
                            <span className={activa ? "text-marca" : "text-slate-300"}>{activa ? (f.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((p) => (
                    <tr key={p.id} className="align-top hover:bg-slate-50">
                      <td className="max-w-sm px-3 py-2.5">
                        <Link href={`/radar/${p.id}`} className="font-medium text-slate-900 hover:text-marca hover:underline">{p.titulo}</Link>
                        <div className="mt-0.5 font-mono text-xs text-slate-500">{p.codigo_proceso}</div>
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 text-slate-700">{p.institucion}</td>
                      <td className="max-w-[12rem] px-3 py-2.5"><ChipGrupo grupos={p.grupos} subcategoria={p.subcategoria} /></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{p.modalidad}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{monto(p.monto_estimado, p.moneda)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatoFecha(p.fecha_publicacion)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="text-slate-600">{formatoFecha(p.fecha_cierre_ofertas)}</div>
                        <div className="mt-0.5"><DiasRestantes cierre={p.fecha_cierre_ofertas} /></div>
                      </td>
                      <td className="px-3 py-2.5"><EstadoInternoTexto estado={p.estado_interno} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-3 space-y-3 lg:hidden">
              {filas.map((p) => (
                <li key={p.id}>
                  <Link href={`/radar/${p.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <ChipGrupo grupos={p.grupos} subcategoria={p.subcategoria} />
                      <DiasRestantes cierre={p.fecha_cierre_ofertas} />
                    </div>
                    <div className="mt-2 font-medium text-slate-900">{p.titulo}</div>
                    <div className="mt-1 text-sm text-slate-600">{p.institucion}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono">{p.codigo_proceso}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{monto(p.monto_estimado, p.moneda)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-slate-500">
                      <span>Publicado {formatoFecha(p.fecha_publicacion)} · cierra {formatoFecha(p.fecha_cierre_ofertas)}</span>
                      <EstadoInternoTexto estado={p.estado_interno} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {paginas > 1 && (
          <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
            {f.pagina > 1 && <Link className="boton-secundario" href={`/radar${aQuery(sp, { pagina: String(f.pagina - 1) })}`}>← Anterior</Link>}
            <span className="text-slate-500">{f.pagina} / {paginas}</span>
            {f.pagina < paginas && <Link className="boton-secundario" href={`/radar${aQuery(sp, { pagina: String(f.pagina + 1) })}`}>Siguiente →</Link>}
          </nav>
        )}
      </main>
      <Pie sync={sync} />
    </>
  );
}
