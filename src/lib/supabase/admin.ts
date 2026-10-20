import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role: salta RLS. Solo para acciones de administración en el servidor
 * (crear empresas, invitar usuarios, subir logos, reclasificar). Nunca llega al navegador.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const hayAdmin = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
