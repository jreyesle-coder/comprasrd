/** Escrituras del sincronizador en Supabase (service_role). */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  texto_busqueda: string;
  texto_clasif: string;
  raw: null;
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
  coincidencias: number;
  contratos_leidos: number;
  ofertas_leidas: number;
  documentos_cargados: number;
  procesos_borrados: number;
  peticiones_api: number;
  max_peticiones_minuto: number;
  exito: boolean;
  errores: string | null;
}

const trozos = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export class Almacen {
  readonly db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private check<T>(r: { data: T; error: { message: string } | null }, que: string): T {
    if (r.error) throw new Error(`Supabase (${que}): ${r.error.message}`);
    return r.data;
  }

  async ultimaSyncExitosa(): Promise<string | null> {
    const r = await this.db.from("sync_log").select("ventana_hasta").eq("exito", true).order("fin", { ascending: false }).limit(1);
    return this.check(r, "sync_log")?.[0]?.ventana_hasta ?? null;
  }

  async iniciarCorrida(): Promise<number> {
    const r = await this.db.from("sync_log").insert({ inicio: new Date().toISOString() }).select("id").single();
    return (this.check(r, "sync_log insert") as { id: number }).id;
  }

  async cerrarCorrida(id: number, res: ResumenSync) {
    this.check(await this.db.from("sync_log").update({ ...res, fin: new Date().toISOString() }).eq("id", id), "sync_log update");
  }

  async codigosExistentes(codigos: string[]) {
    const set = new Set<string>();
    for (const t of trozos(codigos, 200)) {
      const r = await this.db.from("procesos").select("codigo_proceso").in("codigo_proceso", t);
      for (const f of this.check(r, "procesos existentes") ?? []) set.add(f.codigo_proceso);
    }
    return set;
  }

  /** Upsert por codigo_proceso y reemplazo de artículos. */
  async guardarProcesos(lote: { fila: FilaProceso; articulos: FilaArticulo[] }[], avance?: (n: number) => void) {
    let hechos = 0;
    for (const t of trozos(lote, 200)) {
      const r = await this.db.from("procesos").upsert(t.map((x) => x.fila), { onConflict: "codigo_proceso" }).select("id, codigo_proceso");
      const ids = new Map<string, number>();
      for (const f of this.check(r, "upsert procesos") ?? []) ids.set(f.codigo_proceso, f.id);
      this.check(await this.db.from("proceso_articulos").delete().in("proceso_id", [...ids.values()]), "borrar artículos");
      const arts = t.flatMap((x) => x.articulos.map((a) => ({ ...a, proceso_id: ids.get(x.fila.codigo_proceso) })));
      for (const ta of trozos(arts, 1000)) this.check(await this.db.from("proceso_articulos").insert(ta), "insertar artículos");
      hechos += t.length;
      avance?.(hechos);
    }
  }

  async guardarInstituciones(insts: { codigo_unidad_compra: number; nombre: string }[]) {
    for (const t of trozos(insts, 500)) {
      const filas = t.map((i) => ({ ...i, actualizado_en: new Date().toISOString() }));
      this.check(await this.db.from("instituciones").upsert(filas, { onConflict: "codigo_unidad_compra" }), "instituciones");
    }
  }

  async guardarFilas(tabla: "contratos" | "ofertas", filas: Record<string, unknown>[], clave: string) {
    for (const t of trozos(filas, 500)) this.check(await this.db.from(tabla).upsert(t, { onConflict: clave }), tabla);
  }

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    return this.check(await this.db.rpc(fn, args), fn) as T;
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
