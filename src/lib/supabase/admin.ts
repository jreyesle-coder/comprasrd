import "server-only";
import { createClient } from "@supabase/supabase-js";

const claveServicio = () => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim().replace(/^["']|["']$/g, "");

/** Rol que trae la clave (las claves de Supabase son JWT con "role" adentro). */
function rolDeClave(clave: string): string | null {
  try {
    const parte = clave.split(".")[1];
    return JSON.parse(Buffer.from(parte, "base64url").toString("utf8")).role ?? null;
  } catch {
    return clave.startsWith("sb_secret_") ? "service_role" : null;
  }
}

/**
 * Cliente con service_role: salta RLS. Solo para acciones de administración en el servidor
 * (crear empresas, invitar usuarios, subir logos, reclasificar). Nunca llega al navegador.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = claveServicio();
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  const rol = rolDeClave(key);
  if (rol !== "service_role")
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY no es la clave service_role (es "${rol ?? "desconocida"}"). ` +
        "Cópiala de Supabase → Project Settings → API keys → service_role y vuelve a desplegar en Vercel.",
    );
  return createClient(url, key, { auth: { persistSession: false } });
}

export const hayAdmin = () => Boolean(claveServicio());
