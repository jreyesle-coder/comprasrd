import "server-only";
import { normalizar } from "@/lib/clasificador";
import { fechaRD, inicioDiaRD, sumarDias } from "@/lib/fechas";
import { supabaseServidor } from "@/lib/supabase/server";
import { POR_PAGINA, type Contadores, type Detalle, type EstadoInterno, type FilaLista, type Filtros, type UltimaSync } from "./tipos";

const COLUMNAS =
  "id, codigo_proceso, titulo, unidad_compra_codigo, institucion, modalidad, estado, fecha_publicacion, " +
  "fecha_cierre_ofertas, monto_estimado, moneda, es_mipyme, url_portal, grupo, grupos, subcategoria, subcategorias, " +
  "motivo_match, detectado_en, estado_interno, nota, monto_ofertado";

function falla(error: { message: string } | null, que: string) {
  if (error) throw new Error(`Supabase (${que}): ${error.message}`);
}

/** Todas las consultas van acotadas a la empresa (además de RLS). */
export const repo = {
  async listar(empresaId: string, f: Filtros, todo = false) {
    const sb = await supabaseServidor();
    let q = sb.from("procesos_lista").select(COLUMNAS, { count: "exact" }).eq("empresa_id", empresaId);
    if (f.grupo) q = q.contains("grupos", [f.grupo]);
    if (f.subcategoria) q = q.contains("subcategorias", [f.subcategoria]);
    if (f.institucion) q = q.eq("unidad_compra_codigo", f.institucion);
    if (f.modalidad) q = q.eq("modalidad", f.modalidad);
    if (f.estado) q = q.eq("estado", f.estado);
    if (f.estadoInterno) q = q.eq("estado_interno", f.estadoInterno);
    if (f.montoMin != null) q = q.gte("monto_estimado", f.montoMin);
    if (f.montoMax != null) q = q.lte("monto_estimado", f.montoMax);
    if (f.desde) q = q.gte("fecha_publicacion", inicioDiaRD(f.desde).toISOString());
    if (f.hasta) q = q.lt("fecha_publicacion", inicioDiaRD(sumarDias(f.hasta, 1)).toISOString());
    if (f.abiertos) q = q.gt("fecha_cierre_ofertas", new Date().toISOString());
    if (f.mipyme) q = q.eq("es_mipyme", true);
    if (f.q) for (const w of normalizar(f.q).split(" ").filter(Boolean)) q = q.ilike("texto_busqueda", `%${w}%`);
    q = q.order("fecha_publicacion", { ascending: false }).order("id");
    if (!todo) {
      const { data, count, error } = await q.range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);
      falla(error, "listar");
      return { filas: (data ?? []) as unknown as FilaLista[], total: count ?? 0 };
    }
    // Exportación: PostgREST entrega máximo 1,000 filas por consulta → paginar hasta 5,000
    const filas: FilaLista[] = [];
    let total = 0;
    for (let ini = 0; ini < 5000; ini += 1000) {
      const { data, count, error } = await q.range(ini, ini + 999);
      falla(error, "exportar");
      total = count ?? total;
      filas.push(...((data ?? []) as unknown as FilaLista[]));
      if (!data || data.length < 1000) break;
    }
    return { filas, total };
  },

  async porEstados(empresaId: string, estados: readonly EstadoInterno[]) {
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("procesos_lista")
      .select(COLUMNAS)
      .eq("empresa_id", empresaId)
      .in("estado_interno", estados as EstadoInterno[])
      .order("fecha_cierre_ofertas", { ascending: true })
      .limit(500);
    falla(error, "pipeline");
    return (data ?? []) as unknown as FilaLista[];
  },

  async contadores(empresaId: string, grupos: string[]): Promise<Contadores> {
    const sb = await supabaseServidor();
    const ahora = new Date().toISOString();
    const en7 = inicioDiaRD(sumarDias(fechaRD(), 8)).toISOString();
    const base = () => sb.from("procesos_lista").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
    const contar = async (q: ReturnType<typeof base>) => {
      const { count, error } = await q;
      falla(error, "contadores");
      return count ?? 0;
    };
    const [nuevosHoy, abiertos, cierranSemana, ...porGrupo] = await Promise.all([
      contar(base().gte("fecha_publicacion", inicioDiaRD(sumarDias(fechaRD(), -1)).toISOString())), // la DGCP publica con ~1 día de atraso
      contar(base().gt("fecha_cierre_ofertas", ahora)),
      contar(base().gt("fecha_cierre_ofertas", ahora).lt("fecha_cierre_ofertas", en7)),
      ...grupos.map((g) => contar(base().gt("fecha_cierre_ofertas", ahora).contains("grupos", [g]))),
    ]);
    return { nuevosHoy, abiertos, cierranSemana, porGrupo: grupos.map((grupo, i) => ({ grupo, abiertos: porGrupo[i] })) };
  },

  async reglas(empresaId: string) {
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("reglas")
      .select("id, grupo, nombre, unspsc, palabras, activa, orden")
      .eq("empresa_id", empresaId)
      .order("grupo")
      .order("orden");
    falla(error, "reglas");
    return (data ?? []) as { id: string; grupo: string; nombre: string; unspsc: string[]; palabras: string[]; activa: boolean; orden: number }[];
  },

  async instituciones(empresaId: string) {
    const sb = await supabaseServidor();
    const { data, error } = await sb.from("instituciones_con_procesos").select("codigo, nombre").eq("empresa_id", empresaId).order("nombre");
    falla(error, "instituciones");
    return (data ?? []) as { codigo: number; nombre: string }[];
  },

  async detalle(empresaId: string, id: number): Promise<Detalle | null> {
    const sb = await supabaseServidor();
    const [{ data: fila, error }, { data: p }, { data: seg }] = await Promise.all([
      sb.from("procesos_lista").select(COLUMNAS).eq("empresa_id", empresaId).eq("id", id).maybeSingle(),
      sb.from("procesos")
        .select("descripcion, tipo_excepcion, objeto_proceso, fecha_apertura_ofertas, proceso_articulos(descripcion, descripcion_usuario, cantidad, unidad, precio_total, codigo_unspsc), proceso_documentos(titulo, tipo, url, fecha_publicacion)")
        .eq("id", id)
        .maybeSingle(),
      sb.from("seguimiento").select("actualizado_por, actualizado_en").eq("empresa_id", empresaId).eq("proceso_id", id).maybeSingle(),
    ]);
    falla(error, "detalle");
    if (!fila || !p) return null;
    const f = fila as unknown as FilaLista;
    const [{ data: contratos }, { data: ofertas }] = await Promise.all([
      sb.from("contratos").select("codigo_contrato, proveedor, rpe, valor_contratado, moneda, fecha_adjudicacion, estado_adjudicacion, url_contrato").eq("codigo_proceso", f.codigo_proceso),
      sb.from("ofertas").select("proveedor, rpe, valor_oferta, estado_evaluacion").eq("codigo_proceso", f.codigo_proceso).order("valor_oferta"),
    ]);
    const { proceso_articulos, proceso_documentos, ...resto } = p as unknown as {
      proceso_articulos: Omit<Detalle["articulos"][number], "relevante">[];
      proceso_documentos: Detalle["documentos"];
    } & Record<string, unknown>;
    const codigos = new Set(f.motivo_match?.split("; ").filter((m) => m.startsWith("unspsc:")).map((m) => m.slice(7)));
    return {
      ...f,
      ...(resto as object),
      articulos: (proceso_articulos ?? []).map((a) => ({ ...a, relevante: codigos.has(a.codigo_unspsc ?? "") })),
      documentos: (proceso_documentos ?? []).sort((a, b) => (a.fecha_publicacion ?? "").localeCompare(b.fecha_publicacion ?? "")),
      contratos: (contratos ?? []) as Detalle["contratos"],
      ofertas: (ofertas ?? []) as Detalle["ofertas"],
      seguimiento_actualizado_por: seg?.actualizado_por ?? null,
      seguimiento_actualizado_en: seg?.actualizado_en ?? null,
    } as Detalle;
  },

  async ultimaSync(): Promise<UltimaSync | null> {
    const sb = await supabaseServidor();
    const { data } = await sb
      .from("sync_log")
      .select("fin, exito, procesos_relevantes, procesos_nuevos")
      .not("fin", "is", null)
      .order("fin", { ascending: false })
      .limit(1);
    return data?.[0] ?? null;
  },

  async guardarSeguimiento(empresaId: string, id: number, estado: EstadoInterno, nota: string | null, monto: number | null, usuario: string) {
    const sb = await supabaseServidor();
    const fila: Record<string, unknown> = {
      empresa_id: empresaId, proceso_id: id, estado_interno: estado, actualizado_por: usuario, actualizado_en: new Date().toISOString(),
    };
    if (nota !== null) fila.nota = nota || null;
    if (monto !== null) fila.monto_ofertado = monto;
    const { error } = await sb.from("seguimiento").upsert(fila, { onConflict: "empresa_id,proceso_id" });
    falla(error, "seguimiento");
  },
};
