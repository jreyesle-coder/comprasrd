/**
 * Sincronizador del Radar (estrategia C, ver docs/campos-api.md). Guarda TODOS los procesos
 * y la base de datos los clasifica para cada empresa (función SQL clasificar_todas).
 *   1. /procesos por rango de fechas (todas las páginas).
 *   2. /procesos/articulos sin filtro (orden descendente por publicación) hasta salir de la ventana.
 *   3. Procesos sin artículos en el lote → /procesos/articulos?proceso=X (con tope).
 *   4. Guardar procesos + artículos; clasificar por empresa.
 *   5. /contratos y /ofertas en lote (orden descendente) hasta salir de la ventana.
 *   6. Documentos de los procesos que le interesan a alguna empresa (con tope por corrida).
 *   7. Limpieza de procesos viejos que no le interesan a nadie.
 *
 * Uso:
 *   npm run sync                    → ventana automática (última sync − 2 días; primera vez 30 días)
 *   npm run sync -- --dias 7        → fuerza ventana de N días
 *   npm run sync -- --tope-docs 50  → máximo de procesos a los que pedir documentos
 */
import { config as cargarEnv } from "dotenv";
import { normalizar } from "../src/lib/clasificador";
import { fechaRD, inicioDiaRD, sumarDias } from "../src/lib/fechas";
import { Almacen, type FilaArticulo, type FilaProceso, type ResumenSync } from "./almacen";
import { ClienteDgcp, type ArticuloApi, type DocumentoApi, type ProcesoApi } from "./dgcp";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DIAS_PRIMERA_CARGA = 30;
const SOLAPE_DIAS = 2;
const LIMITE = 1000;
const TOPE_PAGINAS = Number(arg("tope-paginas") ?? 400);
const TOPE_FALTANTES = Number(arg("tope-faltantes") ?? 150);
const TOPE_DOCS = Number(arg("tope-docs") ?? 400);
const DIAS_RETENCION = Number(process.env.DIAS_RETENCION ?? 120);

const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function aFila(p: ProcesoApi): FilaProceso {
  return {
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
    texto_busqueda: normalizar(`${p.codigo_proceso} ${p.titulo} ${p.descripcion ?? ""} ${p.unidad_compra}`),
    texto_clasif: normalizar(`${p.titulo ?? ""} ${p.descripcion ?? ""}`),
    raw: null,
    actualizado_en: new Date().toISOString(),
  };
}

const aArticulo = (a: ArticuloApi): FilaArticulo => ({
  descripcion: a.descripcion_articulo ?? null,
  descripcion_usuario: a.descripcion_usuario ?? null,
  cantidad: a.cantidad ?? null,
  unidad: a.unidad_medida ?? null,
  precio_unitario: a.precio_unitario_estimado ?? null,
  precio_total: a.precio_total_estimado ?? null,
  codigo_unspsc: a.subclase_unspsc ?? null,
  familia: a.familia_unspsc ?? null,
  clase: a.clase_unspsc ?? null,
});

interface ContratoApi {
  codigo_contrato: string; codigo_proceso: string; estado_contrato?: string; estado_adjudicacion?: string;
  fecha_adjudicacion?: string; divisa?: string; valor_contratado?: number; descripcion?: string; url_contrato?: string;
  unidad_compra?: string; codigo_unidad_compra?: string | number; rpe?: string; razon_social?: string;
}
interface OfertaApi {
  id_oferta: string; codigo_proceso: string; rpe?: string; razon_social?: string; valor_oferta?: number;
  estado_oferta?: string; estado_evaluacion?: string; fecha_creacion?: string;
}

/** Pagina un endpoint ordenado por fecha descendente hasta que una página completa quede antes de `desdeMs`. */
async function enLote<T>(api: ClienteDgcp, ruta: string, campoFecha: keyof T, desdeMs: number, alPagina: (filas: T[]) => void) {
  let total = 0;
  for (let page = 1, pages = 1; page <= Math.min(pages, TOPE_PAGINAS); page++) {
    const r = await api.get<T>(ruta, { limit: LIMITE, page });
    pages = r.pages ?? 1;
    const filas = r.payload.content ?? [];
    total += filas.length;
    alPagina(filas);
    const max = Math.max(0, ...filas.map((f) => Date.parse(String(f[campoFecha] ?? "")) || 0));
    log(`${ruta} página ${page} · hasta ${String(filas.at(-1)?.[campoFecha] ?? "").slice(0, 10)}`);
    if (!filas.length || max < desdeMs) break;
  }
  return total;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  const almacen = new Almacen(url, key);
  const api = new ClienteDgcp({ base: process.env.DGCP_API_BASE || undefined, log });

  const hoy = fechaRD();
  const ultima = await almacen.ultimaSyncExitosa();
  const desde = arg("dias") ? sumarDias(hoy, -Number(arg("dias"))) : ultima ? sumarDias(ultima, -SOLAPE_DIAS) : sumarDias(hoy, -DIAS_PRIMERA_CARGA);
  const desdeMs = inicioDiaRD(desde).getTime();

  const resumen: ResumenSync = {
    estrategia: "C: /procesos + artículos, contratos y ofertas en lote",
    ventana_desde: desde, ventana_hasta: hoy,
    procesos_leidos: 0, articulos_leidos: 0, procesos_nuevos: 0, procesos_relevantes: 0, coincidencias: 0,
    contratos_leidos: 0, ofertas_leidas: 0, documentos_cargados: 0, procesos_borrados: 0,
    peticiones_api: 0, max_peticiones_minuto: 0, exito: false, errores: null,
  };
  const errores: string[] = [];
  const idCorrida = await almacen.iniciarCorrida();
  log(`Ventana ${desde} → ${hoy}${ultima ? ` (última sync ${ultima}, solape ${SOLAPE_DIAS} días)` : " (primera carga)"}`);

  try {
    // 1. Procesos
    const procesos = new Map<string, ProcesoApi>();
    for (let page = 1, pages = 1; page <= pages; page++) {
      const r = await api.get<ProcesoApi>("/procesos", { startdate: desde, enddate: sumarDias(hoy, 1), limit: LIMITE, page });
      pages = r.pages ?? 1;
      for (const p of r.payload.content ?? []) procesos.set(p.codigo_proceso, p);
      log(`procesos página ${page}/${pages} · acumulados ${procesos.size}`);
    }
    resumen.procesos_leidos = procesos.size;

    // 2. Artículos en lote
    const articulos = new Map<string, ArticuloApi[]>();
    resumen.articulos_leidos = await enLote<ArticuloApi>(api, "/procesos/articulos", "fecha_publicacion", desdeMs, (filas) => {
      for (const a of filas) {
        if (!procesos.has(a.codigo_proceso)) continue;
        (articulos.get(a.codigo_proceso) ?? articulos.set(a.codigo_proceso, []).get(a.codigo_proceso)!).push(a);
      }
    });

    // 3. Faltantes, uno por uno
    const faltantes = [...procesos.keys()].filter((c) => !articulos.has(c));
    const ordenRoto = procesos.size > 50 && faltantes.length > procesos.size / 2;
    if (ordenRoto) errores.push("El orden de /procesos/articulos parece haber cambiado; se usó el respaldo por proceso.");
    const aPedir = faltantes.slice(0, ordenRoto ? Math.max(TOPE_FALTANTES, 600) : TOPE_FALTANTES);
    if (faltantes.length) log(`${faltantes.length} procesos sin artículos en el lote; se piden ${aPedir.length} uno por uno`);
    for (const codigo of aPedir) {
      try {
        const r = await api.get<ArticuloApi>("/procesos/articulos", { proceso: codigo, limit: LIMITE });
        articulos.set(codigo, r.payload.content ?? []);
      } catch (e) {
        errores.push(`artículos ${codigo}: ${(e as Error).message}`);
      }
    }

    // 4. Guardar todo y clasificar por empresa
    const existentes = await almacen.codigosExistentes([...procesos.keys()]);
    resumen.procesos_nuevos = procesos.size - existentes.size;
    const lote = [...procesos.values()].map((p) => ({ fila: aFila(p), articulos: (articulos.get(p.codigo_proceso) ?? []).map(aArticulo) }));
    await almacen.guardarProcesos(lote, (n) => n % 2000 === 0 && log(`guardados ${n}/${lote.length}`));
    const insts = new Map<number, string>();
    for (const p of procesos.values()) if (p.codigo_unidad_compra != null) insts.set(p.codigo_unidad_compra, p.unidad_compra);
    await almacen.guardarInstituciones([...insts].map(([codigo_unidad_compra, nombre]) => ({ codigo_unidad_compra, nombre })));
    resumen.coincidencias = await clasificarEnTramos(almacen, desdeMs);
    log(`Guardados ${procesos.size} procesos (${resumen.procesos_nuevos} nuevos) · coincidencias por empresa: ${resumen.coincidencias}`);

    // 5. Contratos y ofertas
    const contratos: Record<string, unknown>[] = [];
    resumen.contratos_leidos = await enLote<ContratoApi>(api, "/contratos", "fecha_adjudicacion", desdeMs, (filas) => {
      for (const c of filas)
        contratos.push({
          codigo_contrato: c.codigo_contrato, codigo_proceso: c.codigo_proceso,
          unidad_compra_codigo: c.codigo_unidad_compra != null ? Number(c.codigo_unidad_compra) : null,
          institucion: c.unidad_compra ?? null, rpe: c.rpe ?? null, proveedor: c.razon_social ?? null,
          estado_contrato: c.estado_contrato ?? null, estado_adjudicacion: c.estado_adjudicacion ?? null,
          fecha_adjudicacion: c.fecha_adjudicacion ?? null, valor_contratado: c.valor_contratado ?? null,
          moneda: c.divisa ?? null, descripcion: c.descripcion ?? null, url_contrato: c.url_contrato ?? null,
          actualizado_en: new Date().toISOString(),
        });
    });
    await almacen.guardarFilas("contratos", dedupe(contratos, "codigo_contrato"), "codigo_contrato");

    const ofertas: Record<string, unknown>[] = [];
    resumen.ofertas_leidas = await enLote<OfertaApi>(api, "/ofertas", "fecha_creacion", desdeMs, (filas) => {
      for (const o of filas)
        ofertas.push({
          id_oferta: o.id_oferta, codigo_proceso: o.codigo_proceso, rpe: o.rpe ?? null, proveedor: o.razon_social ?? null,
          valor_oferta: o.valor_oferta ?? null, estado_oferta: o.estado_oferta ?? null,
          estado_evaluacion: o.estado_evaluacion ?? null, fecha_creacion: o.fecha_creacion ?? null,
          actualizado_en: new Date().toISOString(),
        });
    });
    await almacen.guardarFilas("ofertas", dedupe(ofertas, "id_oferta"), "id_oferta");
    log(`Contratos ${contratos.length} · ofertas ${ofertas.length}`);

    // 6. Documentos
    const pendientes = await almacen.rpc<{ id: number; codigo_proceso: string }[]>("pendientes_documentos", { p_tope: TOPE_DOCS });
    if (pendientes.length) log(`Documentos: ${pendientes.length} procesos (tope ${TOPE_DOCS})`);
    for (const p of pendientes) {
      try {
        const r = await api.get<DocumentoApi>("/procesos/documentos", { proceso: p.codigo_proceso });
        const docs = (r.payload.content ?? [])
          .filter((d) => d.url_documento)
          .map((d) => ({ titulo: d.nombre_documento ?? null, tipo: d.tipo_documento ?? null, url: d.url_documento, fecha_publicacion: d.fecha_carga_archivo ?? null }));
        await almacen.guardarDocumentos(p.id, dedupe(docs, "url"));
        resumen.documentos_cargados++;
      } catch (e) {
        errores.push(`documentos ${p.codigo_proceso}: ${(e as Error).message}`);
      }
    }

    // 7. Limpieza
    resumen.procesos_borrados = await almacen.rpc<number>("limpiar_procesos_viejos", { p_dias: DIAS_RETENCION });
    const { count: relevantes } = await almacen.db.from("coincidencias").select("proceso_id", { count: "exact", head: true });
    resumen.procesos_relevantes = relevantes ?? 0;
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
        `procesos ${resumen.procesos_leidos} (${resumen.procesos_nuevos} nuevos) · coincidencias ${resumen.coincidencias} · ` +
        `contratos ${resumen.contratos_leidos} · ofertas ${resumen.ofertas_leidas} · docs ${resumen.documentos_cargados} · ` +
        `borrados ${resumen.procesos_borrados} · errores ${errores.length}`,
    );
  }
  if (!resumen.exito) process.exit(1);
}

/** Clasifica la ventana para cada empresa (la base de datos hace el trabajo; ~10 s por empresa y 120 días). */
async function clasificarEnTramos(almacen: Almacen, desdeMs: number) {
  const { data: empresas, error } = await almacen.db.from("empresas").select("id, nombre").neq("estado", "suspendida");
  if (error) throw new Error(error.message);
  let total = 0;
  for (const e of empresas ?? []) {
    const n = await almacen.rpc<number>("clasificar_procesos", { p_empresa: e.id, p_desde: new Date(desdeMs).toISOString() });
    log(`  ${e.nombre}: ${n} procesos en la ventana`);
    total += n;
  }
  return total;
}

function dedupe<T extends Record<string, unknown>>(filas: T[], clave: string): T[] {
  return [...new Map(filas.map((f) => [String(f[clave]), f])).values()];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
