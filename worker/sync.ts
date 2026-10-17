/**
 * Sincronizador del Radar (estrategia C, ver docs/campos-api.md):
 *   1. /procesos por rango de fechas (todas las páginas).
 *   2. /procesos/articulos sin filtro, que viene ordenado por fecha de publicación descendente,
 *      paginando hasta salir de la ventana. Así la clasificación UNSPSC llega en lote.
 *   3. Procesos sin artículos en el lote → /procesos/articulos?proceso=X (con tope).
 *   4. Clasificar, guardar solo los relevantes (upsert por codigo_proceso).
 *   5. Documentos de los relevantes nuevos (y refresco de los abiertos), con tope por corrida.
 *
 * Uso:
 *   npm run sync                         → normal (Supabase)
 *   npm run sync -- --seco               → sin base de datos, guarda en worker/salida/radar-seco.json
 *   npm run sync -- --dias 7             → fuerza una ventana de N días hacia atrás desde hoy
 *   npm run sync -- --tope-docs 50       → máximo de procesos a los que pedir documentos
 */
import { config as cargarEnv } from "dotenv";
import path from "node:path";
import { clasificar, normalizar, subcategoriaPorUnspsc } from "../src/lib/clasificador";
import { fechaRD, inicioDiaRD, sumarDias } from "../src/lib/fechas";
import { AlmacenArchivo, AlmacenSupabase, type Almacen, type FilaArticulo, type FilaProceso, type ResumenSync } from "./almacen";
import { ClienteDgcp, type ArticuloApi, type DocumentoApi, type ProcesoApi } from "./dgcp";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SECO = args.includes("--seco");
const DIAS_PRIMERA_CARGA = 30;
const SOLAPE_DIAS = 2;
const LIMITE = 1000;
const TOPE_PAGINAS_ARTICULOS = Number(arg("tope-paginas") ?? 400);
const TOPE_ARTICULOS_POR_PROCESO = Number(arg("tope-faltantes") ?? 150);
const TOPE_DOCS = Number(arg("tope-docs") ?? (SECO ? 20 : 400));

const hora = () => new Date().toISOString().slice(11, 19);
const log = (m: string) => console.log(`[${hora()}] ${m}`);

function filaDesde(p: ProcesoApi, arts: ArticuloApi[]): { fila: FilaProceso; articulos: FilaArticulo[]; relevante: boolean } {
  const c = clasificar(p, arts);
  const fila: FilaProceso = {
    codigo_proceso: p.codigo_proceso,
    ocid: `ocds-6550wx-${p.codigo_proceso}`,
    titulo: p.titulo ?? null,
    descripcion: p.descripcion ?? null,
    unidad_compra_codigo: p.codigo_unidad_compra ?? null,
    institucion: p.unidad_compra ?? null,
    modalidad: p.modalidad ?? null,
    tipo_excepcion: p.tipo_excepcion ?? null,
    estado: p.estado_proceso ?? null,
    objeto_proceso: p.objeto_proceso ?? null,
    fecha_publicacion: p.fecha_publicacion ?? null,
    fecha_cierre_ofertas: p.fecha_fin_recepcion_ofertas ?? null,
    fecha_apertura_ofertas: p.fecha_apertura_ofertas ?? null,
    monto_estimado: typeof p.monto_estimado === "number" ? p.monto_estimado : null,
    moneda: p.divisa ?? null,
    es_mipyme: p.dirigido_mipymes === "Si",
    es_mipyme_mujer: p.dirigido_mipymes_mujeres === "Si",
    url_portal: p.url ? p.url.replace("gob.do//", "gob.do/") : null,
    categoria: c.categoria,
    subcategoria: c.subcategoria,
    subcategorias: c.subcategorias,
    motivo_match: c.motivo_match,
    texto_busqueda: normalizar(`${p.codigo_proceso} ${p.titulo} ${p.descripcion ?? ""} ${p.unidad_compra}`),
    raw: { proceso: p, articulos: arts },
    actualizado_en: new Date().toISOString(),
  };
  const articulos: FilaArticulo[] = arts.map((a) => ({
    descripcion: a.descripcion_articulo ?? null,
    descripcion_usuario: a.descripcion_usuario ?? null,
    cantidad: a.cantidad ?? null,
    unidad: a.unidad_medida ?? null,
    precio_unitario: a.precio_unitario_estimado ?? null,
    precio_total: a.precio_total_estimado ?? null,
    codigo_unspsc: a.subclase_unspsc ?? null,
    familia: a.familia_unspsc ?? null,
    clase: a.clase_unspsc ?? null,
    relevante: subcategoriaPorUnspsc(a.subclase_unspsc) !== null,
  }));
  return { fila, articulos, relevante: c.relevante };
}

async function main() {
  const almacen: Almacen = SECO
    ? new AlmacenArchivo(path.join("worker", "salida", "radar-seco.json"))
    : (() => {
        const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o usa --seco).");
        return new AlmacenSupabase(url, key);
      })();
  const api = new ClienteDgcp({ base: process.env.DGCP_API_BASE || undefined, log });

  const hoy = fechaRD();
  const ultima = await almacen.ultimaSyncExitosa();
  const desde = arg("dias")
    ? sumarDias(hoy, -Number(arg("dias")))
    : ultima
      ? sumarDias(ultima, -SOLAPE_DIAS)
      : sumarDias(hoy, -DIAS_PRIMERA_CARGA);
  const hasta = sumarDias(hoy, 1); // enddate inclusivo + margen
  const desdeMs = inicioDiaRD(desde).getTime();

  const resumen: ResumenSync = {
    estrategia: "C: /procesos + /procesos/articulos en lote",
    ventana_desde: desde, ventana_hasta: hoy,
    procesos_leidos: 0, articulos_leidos: 0, procesos_nuevos: 0, procesos_relevantes: 0, documentos_cargados: 0,
    peticiones_api: 0, max_peticiones_minuto: 0, exito: false, errores: null,
  };
  const errores: string[] = [];
  const idCorrida = await almacen.iniciarCorrida();
  log(`Ventana ${desde} → ${hoy}${ultima ? ` (última sync ${ultima}, solape ${SOLAPE_DIAS} días)` : " (primera carga)"}${SECO ? " · MODO SECO" : ""}`);

  try {
    // 1. Procesos
    const procesos = new Map<string, ProcesoApi>();
    for (let page = 1, pages = 1; page <= pages; page++) {
      const r = await api.get<ProcesoApi>("/procesos", { startdate: desde, enddate: hasta, limit: LIMITE, page });
      pages = r.pages ?? 1;
      for (const p of r.payload.content ?? []) procesos.set(p.codigo_proceso, p);
      log(`procesos página ${page}/${pages} · acumulados ${procesos.size}`);
    }
    resumen.procesos_leidos = procesos.size;

    // 2. Artículos en lote (orden descendente por fecha de publicación)
    const articulos = new Map<string, ArticuloApi[]>();
    let ordenRoto = false;
    for (let page = 1, pages = 1; page <= Math.min(pages, TOPE_PAGINAS_ARTICULOS); page++) {
      const r = await api.get<ArticuloApi>("/procesos/articulos", { limit: LIMITE, page });
      pages = r.pages ?? 1;
      const filas = r.payload.content ?? [];
      let maxMs = 0;
      for (const a of filas) {
        resumen.articulos_leidos++;
        maxMs = Math.max(maxMs, Date.parse(a.fecha_publicacion));
        if (!procesos.has(a.codigo_proceso)) continue;
        (articulos.get(a.codigo_proceso) ?? articulos.set(a.codigo_proceso, []).get(a.codigo_proceso)!).push(a);
      }
      const minFecha = filas.at(-1)?.fecha_publicacion?.slice(0, 10);
      log(`artículos página ${page} · hasta ${minFecha} · procesos con artículos ${articulos.size}/${procesos.size}`);
      if (page === 1 && maxMs < desdeMs && procesos.size > 0) {
        ordenRoto = true; // la primera página ya está fuera de la ventana: el orden cambió
        break;
      }
      if (filas.length === 0 || maxMs < desdeMs) break;
    }
    if (ordenRoto) {
      errores.push("El orden de /procesos/articulos cambió; se usó el respaldo por proceso.");
      resumen.estrategia = "B (respaldo): /procesos/articulos?proceso=X";
    }

    // 3. Faltantes: por proceso, con tope
    const faltantes = [...procesos.keys()].filter((c) => !articulos.has(c));
    const aPedir = faltantes.slice(0, ordenRoto ? Math.max(TOPE_ARTICULOS_POR_PROCESO, 600) : TOPE_ARTICULOS_POR_PROCESO);
    if (faltantes.length) log(`${faltantes.length} procesos sin artículos en el lote; se piden ${aPedir.length} uno por uno`);
    for (const codigo of aPedir) {
      try {
        const r = await api.get<ArticuloApi>("/procesos/articulos", { proceso: codigo, limit: LIMITE });
        articulos.set(codigo, r.payload.content ?? []);
      } catch (e) {
        errores.push(`artículos ${codigo}: ${(e as Error).message}`);
      }
    }

    // 4. Clasificar y guardar relevantes
    const relevantes = [...procesos.values()].map((p) => filaDesde(p, articulos.get(p.codigo_proceso) ?? [])).filter((x) => x.relevante);
    const existentes = await almacen.codigosExistentes(relevantes.map((x) => x.fila.codigo_proceso));
    await almacen.guardarProcesos(relevantes);
    resumen.procesos_relevantes = relevantes.length;
    resumen.procesos_nuevos = relevantes.filter((x) => !existentes.has(x.fila.codigo_proceso)).length;
    const insts = new Map<number, string>();
    for (const p of procesos.values()) if (p.codigo_unidad_compra != null) insts.set(p.codigo_unidad_compra, p.unidad_compra);
    await almacen.guardarInstituciones([...insts].map(([codigo_unidad_compra, nombre]) => ({ codigo_unidad_compra, nombre })));
    log(`Relevantes ${relevantes.length} de ${procesos.size} (${resumen.procesos_nuevos} nuevos)`);

    // 5. Documentos
    const pendientes = await almacen.pendientesDeDocumentos(TOPE_DOCS);
    if (pendientes.length) log(`Documentos: ${pendientes.length} procesos (tope ${TOPE_DOCS})`);
    for (const p of pendientes) {
      try {
        const r = await api.get<DocumentoApi>("/procesos/documentos", { proceso: p.codigo_proceso });
        const docs = (r.payload.content ?? []).map((d) => ({
          titulo: d.nombre_documento ?? null,
          tipo: d.tipo_documento ?? null,
          url: d.url_documento,
          fecha_publicacion: d.fecha_carga_archivo ?? null,
        }));
        await almacen.guardarDocumentos(p.id, docs.filter((d) => d.url));
        resumen.documentos_cargados++;
      } catch (e) {
        errores.push(`documentos ${p.codigo_proceso}: ${(e as Error).message}`);
      }
    }
    resumen.exito = true;
  } catch (e) {
    errores.push((e as Error).message);
    log(`ERROR: ${(e as Error).message}`);
  } finally {
    resumen.peticiones_api = api.peticiones;
    resumen.max_peticiones_minuto = api.maxPorMinuto;
    resumen.errores = errores.length ? errores.slice(0, 50).join("\n") : null;
    await almacen.cerrarCorrida(idCorrida, resumen);
    log(
      `Fin · ${resumen.exito ? "OK" : "FALLÓ"} · peticiones ${resumen.peticiones_api} · máx/min ${resumen.max_peticiones_minuto} · ` +
        `leídos ${resumen.procesos_leidos} · relevantes ${resumen.procesos_relevantes} · nuevos ${resumen.procesos_nuevos} · ` +
        `docs ${resumen.documentos_cargados} · errores ${errores.length}`,
    );
  }
  if (!resumen.exito) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
