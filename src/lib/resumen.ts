/** Selección de procesos para el resumen diario de una empresa (la usan el worker y la vista previa). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaRD, inicioDiaRD, sumarDias } from "./fechas";
import type { ProcesoCorreo } from "./correo";

const COLS = "id, codigo_proceso, titulo, institucion, subcategoria, monto_estimado, moneda, fecha_cierre_ofertas, estado_interno";

export async function procesosDelResumen(db: SupabaseClient, empresaId: string, desde: string) {
  const ahora = new Date().toISOString();
  const en7 = inicioDiaRD(sumarDias(fechaRD(), 8)).toISOString();
  const [nuevos, porCerrar] = await Promise.all([
    // nuevos = entraron al radar desde el último envío, publicados hace poco y todavía abiertos
    db.from("procesos_lista").select(COLS).eq("empresa_id", empresaId).gte("detectado_en", desde)
      .gte("fecha_publicacion", new Date(Date.parse(desde) - 3 * 86_400_000).toISOString())
      .or(`fecha_cierre_ofertas.gt.${ahora},fecha_cierre_ofertas.is.null`)
      .neq("estado_interno", "descartado").order("fecha_publicacion", { ascending: false }).limit(200),
    db.from("procesos_lista").select(COLS).eq("empresa_id", empresaId).gt("fecha_cierre_ofertas", ahora).lt("fecha_cierre_ofertas", en7)
      .neq("estado_interno", "descartado").order("fecha_cierre_ofertas").limit(200),
  ]);
  if (nuevos.error) throw new Error(nuevos.error.message);
  if (porCerrar.error) throw new Error(porCerrar.error.message);
  const idsNuevos = new Set((nuevos.data ?? []).map((p) => p.id));
  return {
    nuevos: (nuevos.data ?? []) as ProcesoCorreo[],
    // no repetir en "por cerrar" lo que ya sale como nuevo
    porCerrar: ((porCerrar.data ?? []) as ProcesoCorreo[]).filter((p) => !idsNuevos.has(p.id)),
  };
}
