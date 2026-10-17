import { normalizar } from "@/lib/clasificador";
import { fechaRD, inicioDiaRD, sumarDias } from "@/lib/fechas";
import { supabaseServidor } from "@/lib/supabase/server";
import { POR_PAGINA, type Detalle, type EstadoInterno, type FilaLista, type Filtros, type Repo } from "./tipos";

const COLUMNAS =
  "id, codigo_proceso, titulo, unidad_compra_codigo, institucion, modalidad, estado, fecha_publicacion, " +
  "fecha_cierre_ofertas, monto_estimado, moneda, es_mipyme, url_portal, categoria, subcategoria, subcategorias, " +
  "motivo_match, estado_interno, nota";

function falla(error: { message: string } | null, que: string) {
  if (error) throw new Error(`Supabase (${que}): ${error.message}`);
}

export const repoSupabase: Repo = {
  async listar(f: Filtros, todo = false) {
    const sb = await supabaseServidor();
    let q = sb.from("procesos_lista").select(COLUMNAS, { count: "exact" });
    if (f.categoria) q = q.in("categoria", [f.categoria, "ambas"]);
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
    if (f.q) {
      for (const palabra of normalizar(f.q).split(" ").filter(Boolean)) q = q.ilike("texto_busqueda", `%${palabra}%`);
    }
    q = q.order("fecha_publicacion", { ascending: false });
    q = todo ? q.limit(5000) : q.range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);
    const { data, count, error } = await q;
    falla(error, "listar");
    return { filas: (data ?? []) as unknown as FilaLista[], total: count ?? 0 };
  },

  async contadores() {
    const sb = await supabaseServidor();
    const ahora = new Date().toISOString();
    const en7 = inicioDiaRD(sumarDias(fechaRD(), 8)).toISOString();
    const contar = async (aplicar: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
      const { count, error } = await aplicar(base());
      falla(error, "contadores");
      return count ?? 0;
    };
    const base = () => sb.from("procesos").select("id", { count: "exact", head: true });
    const [nuevosHoy, abiertos, cierranSemana, tecnologia, servicios] = await Promise.all([
      contar((q) => q.gte("fecha_publicacion", inicioDiaRD(fechaRD()).toISOString())),
      contar((q) => q.gt("fecha_cierre_ofertas", ahora)),
      contar((q) => q.gt("fecha_cierre_ofertas", ahora).lt("fecha_cierre_ofertas", en7)),
      contar((q) => q.gt("fecha_cierre_ofertas", ahora).in("categoria", ["tecnologia", "ambas"])),
      contar((q) => q.gt("fecha_cierre_ofertas", ahora).in("categoria", ["servicios_generales", "ambas"])),
    ]);
    return { nuevosHoy, abiertos, cierranSemana, tecnologia, servicios };
  },

  async instituciones() {
    const sb = await supabaseServidor();
    const { data, error } = await sb.from("instituciones_con_procesos").select("codigo, nombre").order("nombre");
    falla(error, "instituciones");
    return (data ?? []) as { codigo: number; nombre: string }[];
  },

  async detalle(id: number) {
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("procesos")
      .select(
        "*, proceso_articulos(descripcion, descripcion_usuario, cantidad, unidad, precio_total, codigo_unspsc, relevante), " +
          "proceso_documentos(titulo, tipo, url, fecha_publicacion), seguimiento(estado_interno, nota, actualizado_por, actualizado_en)",
      )
      .eq("id", id)
      .maybeSingle();
    falla(error, "detalle");
    if (!data) return null;
    const d = data as unknown as Record<string, unknown> & {
      proceso_articulos: Detalle["articulos"];
      proceso_documentos: Detalle["documentos"];
      seguimiento: { estado_interno: EstadoInterno; nota: string | null; actualizado_por: string | null; actualizado_en: string } | null;
    };
    const { proceso_articulos, proceso_documentos, seguimiento, ...p } = d;
    return {
      ...(p as unknown as Detalle),
      articulos: proceso_articulos ?? [],
      documentos: (proceso_documentos ?? []).sort((a, b) => (a.fecha_publicacion ?? "").localeCompare(b.fecha_publicacion ?? "")),
      estado_interno: seguimiento?.estado_interno ?? "nuevo",
      nota: seguimiento?.nota ?? null,
      seguimiento_actualizado_por: seguimiento?.actualizado_por ?? null,
      seguimiento_actualizado_en: seguimiento?.actualizado_en ?? null,
    };
  },

  async ultimaSync() {
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("sync_log")
      .select("fin, exito, procesos_relevantes, procesos_nuevos")
      .not("fin", "is", null)
      .order("fin", { ascending: false })
      .limit(1);
    falla(error, "sync_log");
    return data?.[0] ?? null;
  },

  async guardarSeguimiento(id, estado, nota, usuario) {
    const sb = await supabaseServidor();
    const { error } = await sb.from("seguimiento").upsert({
      proceso_id: id,
      estado_interno: estado,
      nota: nota || null,
      actualizado_por: usuario,
      actualizado_en: new Date().toISOString(),
    });
    falla(error, "seguimiento");
  },
};
