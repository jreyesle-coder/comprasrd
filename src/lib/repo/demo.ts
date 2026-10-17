/**
 * Modo demo: sin Supabase configurado, la app lee worker/salida/radar-seco.json
 * (lo genera `npm run sync -- --seco`). El seguimiento se guarda solo en memoria.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizar } from "@/lib/clasificador";
import { fechaRD, inicioDiaRD, sumarDias } from "@/lib/fechas";
import { POR_PAGINA, type Detalle, type EstadoInterno, type FilaLista, type Repo } from "./tipos";

interface Seco {
  procesos: {
    id: number;
    fila: Record<string, unknown> & { texto_busqueda: string };
    articulos: Detalle["articulos"];
    documentos: Detalle["documentos"];
  }[];
  sync_log: { fin?: string; exito?: boolean; procesos_relevantes?: number; procesos_nuevos?: number }[];
}

const seguimiento = new Map<number, { estado: EstadoInterno; nota: string; usuario: string; en: string }>();

function cargar(): Seco {
  const archivo = path.join(process.cwd(), "worker", "salida", "radar-seco.json");
  if (!fs.existsSync(archivo)) return { procesos: [], sync_log: [] };
  return JSON.parse(fs.readFileSync(archivo, "utf8"));
}

function aFila(p: Seco["procesos"][number]): FilaLista & { _texto: string; _p: Seco["procesos"][number] } {
  const s = seguimiento.get(p.id);
  return {
    ...(p.fila as unknown as FilaLista),
    id: p.id,
    estado_interno: s?.estado ?? "nuevo",
    nota: s?.nota ?? null,
    _texto: p.fila.texto_busqueda,
    _p: p,
  };
}

const limpiar = ({ _texto, _p, ...f }: ReturnType<typeof aFila>): FilaLista => (void _texto, void _p, f);

export const repoDemo: Repo = {
  async listar(f, todo = false) {
    const ahora = new Date().toISOString();
    const palabras = f.q ? normalizar(f.q).split(" ").filter(Boolean) : [];
    const filas = cargar()
      .procesos.map(aFila)
      .filter(
        (x) =>
          (!f.categoria || x.categoria === f.categoria || x.categoria === "ambas") &&
          (!f.subcategoria || x.subcategorias.includes(f.subcategoria)) &&
          (!f.institucion || x.unidad_compra_codigo === f.institucion) &&
          (!f.modalidad || x.modalidad === f.modalidad) &&
          (!f.estado || x.estado === f.estado) &&
          (!f.estadoInterno || x.estado_interno === f.estadoInterno) &&
          (f.montoMin == null || (x.monto_estimado ?? 0) >= f.montoMin) &&
          (f.montoMax == null || (x.monto_estimado ?? 0) <= f.montoMax) &&
          (!f.desde || (x.fecha_publicacion ?? "") >= inicioDiaRD(f.desde).toISOString()) &&
          (!f.hasta || (x.fecha_publicacion ?? "") < inicioDiaRD(sumarDias(f.hasta, 1)).toISOString()) &&
          (!f.abiertos || (x.fecha_cierre_ofertas ?? "") > ahora) &&
          (!f.mipyme || x.es_mipyme) &&
          palabras.every((w) => x._texto.includes(w)),
      )
      .sort((a, b) => (b.fecha_publicacion ?? "").localeCompare(a.fecha_publicacion ?? ""));
    const pagina = todo ? filas : filas.slice((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA);
    return { filas: pagina.map(limpiar), total: filas.length };
  },

  async contadores() {
    const ahora = new Date().toISOString();
    const hoy = inicioDiaRD(fechaRD()).toISOString();
    const en7 = inicioDiaRD(sumarDias(fechaRD(), 8)).toISOString();
    const fs = cargar().procesos.map(aFila);
    const abiertos = fs.filter((x) => (x.fecha_cierre_ofertas ?? "") > ahora);
    return {
      nuevosHoy: fs.filter((x) => (x.fecha_publicacion ?? "") >= hoy).length,
      abiertos: abiertos.length,
      cierranSemana: abiertos.filter((x) => (x.fecha_cierre_ofertas ?? "") < en7).length,
      tecnologia: abiertos.filter((x) => x.categoria !== "servicios_generales").length,
      servicios: abiertos.filter((x) => x.categoria !== "tecnologia").length,
    };
  },

  async instituciones() {
    const m = new Map<number, string>();
    for (const p of cargar().procesos) m.set(p.fila.unidad_compra_codigo as number, p.fila.institucion as string);
    return [...m].map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async detalle(id) {
    const p = cargar().procesos.find((x) => x.id === id);
    if (!p) return null;
    const s = seguimiento.get(id);
    return {
      ...(p.fila as unknown as Detalle),
      ...limpiar(aFila(p)),
      articulos: p.articulos,
      documentos: p.documentos,
      seguimiento_actualizado_por: s?.usuario ?? null,
      seguimiento_actualizado_en: s?.en ?? null,
    };
  },

  async ultimaSync() {
    const c = cargar().sync_log.filter((x) => x.fin).at(-1);
    return c ? { fin: c.fin ?? null, exito: c.exito ?? null, procesos_relevantes: c.procesos_relevantes ?? null, procesos_nuevos: c.procesos_nuevos ?? null } : null;
  },

  async guardarSeguimiento(id, estado, nota, usuario) {
    seguimiento.set(id, { estado, nota, usuario, en: new Date().toISOString() });
  },
};
