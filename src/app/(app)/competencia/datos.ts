import "server-only";
import { supabaseServidor } from "@/lib/supabase/server";

export interface Proveedor {
  rpe: string;
  proveedor: string;
  contratos: number;
  monto: number;
  instituciones: number;
  ultimo: string;
}

export interface Adjudicacion {
  codigo_contrato: string;
  codigo_proceso: string;
  proceso_id: number;
  titulo: string;
  institucion: string;
  unidad_compra_codigo: number;
  proveedor: string;
  rpe: string;
  valor_contratado: number;
  moneda: string;
  fecha_adjudicacion: string;
  subcategoria: string;
  monto_estimado: number | null;
}

export async function competencia(dias: number, institucion?: number, rpe?: string) {
  const sb = await supabaseServidor();
  const [rank, adj] = await Promise.all([
    sb.rpc("ranking_proveedores", { p_dias: dias, p_institucion: institucion ?? null }),
    sb.rpc("adjudicaciones_recientes", { p_dias: dias, p_institucion: institucion ?? null, p_rpe: rpe ?? null }),
  ]);
  if (rank.error) throw new Error(rank.error.message);
  if (adj.error) throw new Error(adj.error.message);
  return { proveedores: (rank.data ?? []) as Proveedor[], adjudicaciones: (adj.data ?? []) as Adjudicacion[] };
}
