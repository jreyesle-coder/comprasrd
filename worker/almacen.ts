/**
 * Dónde guarda el sincronizador: Supabase (normal) o un archivo JSON (modo --seco, sin base de datos).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

export interface FilaProceso {
  codigo_proceso: string;
  ocid: string;
  titulo: string | null;
  descripcion: string | null;
  unidad_compra_codigo: number | null;
  institucion: string | null;
  modalidad: string | null;
  tipo_excepcion: string | null;
  estado: string | null;
  objeto_proceso: string | null;
  fecha_publicacion: string | null;
  fecha_cierre_ofertas: string | null;
  fecha_apertura_ofertas: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  es_mipyme: boolean;
  es_mipyme_mujer: boolean;
  url_portal: string | null;
  categoria: string | null;
  subcategoria: string | null;
  subcategorias: string[];
  motivo_match: string | null;
  texto_busqueda: string;
  raw: unknown;
  actualizado_en: string;
}

export interface FilaArticulo {
  descripcion: string | null;
  descripcion_usuario: string | null;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  precio_total: number | null;
  codigo_unspsc: string | null;
  familia: string | null;
  clase: string | null;
  relevante: boolean;
}

export interface FilaDocumento {
  titulo: string | null;
  tipo: string | null;
  url: string;
  fecha_publicacion: string | null;
}

export interface ResumenSync {
  estrategia: string;
  ventana_desde: string;
  ventana_hasta: string;
  procesos_leidos: number;
  articulos_leidos: number;
  procesos_nuevos: number;
  procesos_relevantes: number;
  documentos_cargados: number;
  peticiones_api: number;
  max_peticiones_minuto: number;
  exito: boolean;
  errores: string | null;
}

export interface Almacen {
  /** ventana_hasta de la última corrida exitosa, o null si nunca corrió. */
  ultimaSyncExitosa(): Promise<string | null>;
  iniciarCorrida(): Promise<number | null>;
  cerrarCorrida(id: number | null, r: ResumenSync): Promise<void>;
  codigosExistentes(codigos: string[]): Promise<Set<string>>;
  /** Upsert por codigo_proceso y reemplaza sus artículos. Devuelve id por código. */
  guardarProcesos(lote: { fila: FilaProceso; articulos: FilaArticulo[] }[]): Promise<Map<string, number>>;
  guardarInstituciones(insts: { codigo_unidad_compra: number; nombre: string }[]): Promise<void>;
  /** Procesos a los que hay que (re)cargar documentos: primero los nunca cargados, luego abiertos con docs de > 24 h. */
  pendientesDeDocumentos(tope: number): Promise<{ id: number; codigo_proceso: string }[]>;
  guardarDocumentos(procesoId: number, docs: FilaDocumento[]): Promise<void>;
}

const LOTE = 200;
const trozos = <T>(xs: T[], n = LOTE) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export class AlmacenSupabase implements Almacen {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private check<T>(r: { data: T; error: { message: string } | null }, que: string): T {
    if (r.error) throw new Error(`Supabase (${que}): ${r.error.message}`);
    return r.data;
  }

  async ultimaSyncExitosa() {
    const r = await this.db.from("sync_log").select("ventana_hasta").eq("exito", true).order("fin", { ascending: false }).limit(1);
    return this.check(r, "sync_log")?.[0]?.ventana_hasta ?? null;
  }

  async iniciarCorrida() {
    const r = await this.db.from("sync_log").insert({ inicio: new Date().toISOString() }).select("id").single();
    return (this.check(r, "sync_log insert") as { id: number }).id;
  }

  async cerrarCorrida(id: number | null, res: ResumenSync) {
    const r = await this.db.from("sync_log").update({ ...res, fin: new Date().toISOString() }).eq("id", id);
    this.check(r, "sync_log update");
  }

  async codigosExistentes(codigos: string[]) {
    const set = new Set<string>();
    for (const t of trozos(codigos)) {
      const r = await this.db.from("procesos").select("codigo_proceso").in("codigo_proceso", t);
      for (const f of this.check(r, "procesos existentes") ?? []) set.add(f.codigo_proceso);
    }
    return set;
  }

  async guardarProcesos(lote: { fila: FilaProceso; articulos: FilaArticulo[] }[]) {
    const ids = new Map<string, number>();
    for (const t of trozos(lote)) {
      const r = await this.db.from("procesos").upsert(t.map((x) => x.fila), { onConflict: "codigo_proceso" }).select("id, codigo_proceso");
      for (const f of this.check(r, "upsert procesos") ?? []) ids.set(f.codigo_proceso, f.id);
      const idsLote = t.map((x) => ids.get(x.fila.codigo_proceso)!).filter(Boolean);
      this.check(await this.db.from("proceso_articulos").delete().in("proceso_id", idsLote), "borrar artículos");
      const arts = t.flatMap((x) => x.articulos.map((a) => ({ ...a, proceso_id: ids.get(x.fila.codigo_proceso) })));
      for (const ta of trozos(arts, 1000)) this.check(await this.db.from("proceso_articulos").insert(ta), "insertar artículos");
    }
    return ids;
  }

  async guardarInstituciones(insts: { codigo_unidad_compra: number; nombre: string }[]) {
    for (const t of trozos(insts, 500)) {
      const filas = t.map((i) => ({ ...i, actualizado_en: new Date().toISOString() }));
      this.check(await this.db.from("instituciones").upsert(filas, { onConflict: "codigo_unidad_compra" }), "instituciones");
    }
  }

  async pendientesDeDocumentos(tope: number) {
    const nunca = this.check(
      await this.db.from("procesos").select("id, codigo_proceso").is("documentos_actualizados_en", null)
        .order("fecha_publicacion", { ascending: false }).limit(tope),
      "pendientes docs",
    ) ?? [];
    if (nunca.length >= tope) return nunca;
    const hace24h = new Date(Date.now() - 86_400_000).toISOString();
    const viejos = this.check(
      await this.db.from("procesos").select("id, codigo_proceso").gt("fecha_cierre_ofertas", new Date().toISOString())
        .lt("documentos_actualizados_en", hace24h).order("documentos_actualizados_en", { ascending: true }).limit(tope - nunca.length),
      "docs viejos",
    ) ?? [];
    return [...nunca, ...viejos];
  }

  async guardarDocumentos(procesoId: number, docs: FilaDocumento[]) {
    if (docs.length) {
      const filas = docs.map((d) => ({ ...d, proceso_id: procesoId }));
      this.check(await this.db.from("proceso_documentos").upsert(filas, { onConflict: "proceso_id,url" }), "documentos");
    }
    this.check(
      await this.db.from("procesos").update({ documentos_actualizados_en: new Date().toISOString() }).eq("id", procesoId),
      "marcar documentos",
    );
  }
}

/** Modo --seco: todo queda en worker/salida/radar-seco.json (lo usa también el modo demo de la app). */
export class AlmacenArchivo implements Almacen {
  private procesos = new Map<string, { id: number; fila: FilaProceso; articulos: FilaArticulo[]; documentos: FilaDocumento[]; docsEn: string | null }>();
  private corridas: (ResumenSync & { id: number; inicio: string; fin?: string })[] = [];
  private instituciones = new Map<number, string>();

  constructor(private archivo: string) {
    if (fs.existsSync(archivo)) {
      const d = JSON.parse(fs.readFileSync(archivo, "utf8"));
      for (const p of d.procesos ?? []) this.procesos.set(p.fila.codigo_proceso, p);
      this.corridas = d.sync_log ?? [];
      for (const i of d.instituciones ?? []) this.instituciones.set(i.codigo_unidad_compra, i.nombre);
    }
  }

  private escribir() {
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true });
    const instituciones = [...this.instituciones].map(([codigo_unidad_compra, nombre]) => ({ codigo_unidad_compra, nombre }));
    const tmp = `${this.archivo}.tmp`; // escribir y renombrar: la app nunca lee un archivo a medias
    fs.writeFileSync(tmp, JSON.stringify({ procesos: [...this.procesos.values()], sync_log: this.corridas, instituciones }));
    fs.renameSync(tmp, this.archivo);
  }

  async ultimaSyncExitosa() {
    return this.corridas.filter((c) => c.exito).at(-1)?.ventana_hasta ?? null;
  }
  async iniciarCorrida() {
    const id = this.corridas.length + 1;
    this.corridas.push({ id, inicio: new Date().toISOString() } as never);
    return id;
  }
  async cerrarCorrida(id: number | null, r: ResumenSync) {
    const c = this.corridas.find((x) => x.id === id);
    if (c) Object.assign(c, r, { fin: new Date().toISOString() });
    this.escribir();
  }
  async codigosExistentes(codigos: string[]) {
    return new Set(codigos.filter((c) => this.procesos.has(c)));
  }
  async guardarProcesos(lote: { fila: FilaProceso; articulos: FilaArticulo[] }[]) {
    const ids = new Map<string, number>();
    for (const { fila, articulos } of lote) {
      const previo = this.procesos.get(fila.codigo_proceso);
      const id = previo?.id ?? this.procesos.size + 1;
      this.procesos.set(fila.codigo_proceso, { id, fila, articulos, documentos: previo?.documentos ?? [], docsEn: previo?.docsEn ?? null });
      ids.set(fila.codigo_proceso, id);
    }
    this.escribir();
    return ids;
  }
  async guardarInstituciones(insts: { codigo_unidad_compra: number; nombre: string }[]) {
    for (const i of insts) this.instituciones.set(i.codigo_unidad_compra, i.nombre);
  }
  async pendientesDeDocumentos(tope: number) {
    return [...this.procesos.values()]
      .filter((p) => !p.docsEn)
      .sort((a, b) => (b.fila.fecha_publicacion ?? "").localeCompare(a.fila.fecha_publicacion ?? ""))
      .slice(0, tope)
      .map((p) => ({ id: p.id, codigo_proceso: p.fila.codigo_proceso }));
  }
  async guardarDocumentos(procesoId: number, docs: FilaDocumento[]) {
    const p = [...this.procesos.values()].find((x) => x.id === procesoId);
    if (p) {
      p.documentos = docs;
      p.docsEn = new Date().toISOString();
    }
    this.escribir();
  }
}
