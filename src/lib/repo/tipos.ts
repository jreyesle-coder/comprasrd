export const ESTADOS_INTERNOS = ["nuevo", "interesa", "en_preparacion", "ofertado", "ganado", "perdido", "descartado"] as const;
/** Columnas del pipeline comercial */
export const ESTADOS_PIPELINE = ["interesa", "en_preparacion", "ofertado", "ganado", "perdido"] as const;
export type EstadoInterno = (typeof ESTADOS_INTERNOS)[number];
export const ETIQUETA_ESTADO_INTERNO: Record<EstadoInterno, string> = {
  nuevo: "Nuevo",
  interesa: "Interesa",
  en_preparacion: "En preparación",
  ofertado: "Ofertado",
  ganado: "Ganado",
  perdido: "Perdido",
  descartado: "Descartado",
};

/** Valores vistos en la API (docs/campos-api.md). */
export const MODALIDADES = [
  "Compras por Debajo del Umbral",
  "Contratación Menor",
  "Comparación de Precios",
  "Licitación Pública Nacional",
  "Licitación Pública Internacional",
  "Licitación Pública Abreviada",
  "Licitación Restringida",
  "Sorteo de Obras",
  "Subasta Inversa",
  "Procesos de Excepción",
];
export const ESTADOS_PROCESO = [
  "Proceso publicado",
  "Proceso con etapa cerrada",
  "Sobres estan abriendose",
  "Sobres abiertos o aperturados",
  "Proceso adjudicado y celebrado",
  "Proceso desierto",
  "Cancelado",
];

export interface Filtros {
  grupo?: string;
  subcategoria?: string;
  institucion?: number;
  modalidad?: string;
  estado?: string;
  estadoInterno?: EstadoInterno;
  montoMin?: number;
  montoMax?: number;
  desde?: string;
  hasta?: string;
  abiertos?: boolean;
  mipyme?: boolean;
  q?: string;
  pagina: number;
  orden: ColumnaOrden;
  dir: "asc" | "desc";
}

export interface FilaLista {
  id: number;
  codigo_proceso: string;
  titulo: string | null;
  unidad_compra_codigo: number | null;
  institucion: string | null;
  modalidad: string | null;
  estado: string | null;
  fecha_publicacion: string | null;
  fecha_cierre_ofertas: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  es_mipyme: boolean;
  url_portal: string | null;
  grupo: string;
  grupos: string[];
  subcategoria: string;
  subcategorias: string[];
  detectado_en: string | null;
  monto_ofertado: number | null;
  motivo_match: string | null;
  estado_interno: EstadoInterno;
  nota: string | null;
}

export interface Detalle extends FilaLista {
  descripcion: string | null;
  tipo_excepcion: string | null;
  objeto_proceso: string | null;
  fecha_apertura_ofertas: string | null;
  articulos: {
    descripcion: string | null;
    descripcion_usuario: string | null;
    cantidad: number | null;
    unidad: string | null;
    precio_total: number | null;
    codigo_unspsc: string | null;
    relevante: boolean;
  }[];
  documentos: { titulo: string | null; tipo: string | null; url: string; fecha_publicacion: string | null }[];
  contratos: { codigo_contrato: string; proveedor: string | null; rpe: string | null; valor_contratado: number | null; moneda: string | null; fecha_adjudicacion: string | null; estado_adjudicacion: string | null; url_contrato: string | null }[];
  ofertas: { proveedor: string | null; rpe: string | null; valor_oferta: number | null; estado_evaluacion: string | null }[];
  seguimiento_actualizado_por: string | null;
  seguimiento_actualizado_en: string | null;
}

export interface Contadores {
  nuevosHoy: number;
  abiertos: number;
  cierranSemana: number;
  porGrupo: { grupo: string; abiertos: number }[];
}

export interface UltimaSync {
  fin: string | null;
  exito: boolean | null;
  procesos_relevantes: number | null;
  procesos_nuevos: number | null;
}

export const POR_PAGINA = 50;

/** Columnas por las que se puede ordenar el listado (clave en la URL → columna de procesos_lista). */
export const COLUMNAS_ORDEN = {
  proceso: "titulo",
  institucion: "institucion",
  categoria: "subcategoria",
  modalidad: "modalidad",
  monto: "monto_estimado",
  publicado: "fecha_publicacion",
  cierre: "fecha_cierre_ofertas",
  interno: "estado_interno",
} as const;
export type ColumnaOrden = keyof typeof COLUMNAS_ORDEN;

type Params = Record<string, string | string[] | undefined>;

export function leerFiltros(sp: Params): Filtros {
  const s = (k: string) => {
    const v = sp[k];
    const x = Array.isArray(v) ? v[0] : v;
    return x && x.trim() ? x.trim() : undefined;
  };
  const n = (k: string) => {
    const v = s(k)?.replace(/[^\d.]/g, "");
    return v ? Number(v) : undefined;
  };
  const ei = s("estado_interno");
  return {
    grupo: s("grupo"),
    subcategoria: s("subcategoria"),
    institucion: n("institucion"),
    modalidad: s("modalidad"),
    estado: s("estado"),
    estadoInterno: ESTADOS_INTERNOS.includes(ei as EstadoInterno) ? (ei as EstadoInterno) : undefined,
    montoMin: n("monto_min"),
    montoMax: n("monto_max"),
    desde: s("desde")?.match(/^\d{4}-\d{2}-\d{2}$/) ? s("desde") : undefined,
    hasta: s("hasta")?.match(/^\d{4}-\d{2}-\d{2}$/) ? s("hasta") : undefined,
    abiertos: s("abiertos") === "1",
    mipyme: s("mipyme") === "1",
    q: s("q"),
    pagina: Math.max(1, n("pagina") ?? 1),
    orden: (s("orden") ?? "") in COLUMNAS_ORDEN ? (s("orden") as ColumnaOrden) : "publicado",
    dir: s("dir") === "asc" ? "asc" : s("dir") === "desc" ? "desc" : s("orden") && !["publicado", "monto"].includes(s("orden")!) ? "asc" : "desc",
  };
}

/** Querystring con los filtros actuales (para paginar y exportar). */
export function aQuery(sp: Params, cambios: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const x = Array.isArray(v) ? v[0] : v;
    if (x) qs.set(k, x);
  }
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) qs.delete(k);
    else qs.set(k, v);
  }
  const t = qs.toString();
  return t ? `?${t}` : "";
}
