import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sin variables de Supabase la app corre en modo demo (datos del modo seco del sincronizador, sin login). */
export const MODO_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export async function supabaseServidor() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, options);
        } catch {
          // En Server Components no se pueden escribir cookies; el proxy ya refresca la sesión.
        }
      },
    },
  });
}

export async function usuarioActual(): Promise<string | null> {
  if (MODO_DEMO) return "modo demo";
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}
