/**
 * Recalcula el radar de todas las empresas (o una) con sus rubros actuales, sin llamar a la API.
 * Uso: npm run reclasificar [-- --dias 120] [-- --empresa slug]
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

cargarEnv({ path: [".env.local", ".env"], quiet: true });
const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const dias = Number(arg("dias") ?? 120);
  let q = db.from("empresas").select("id, nombre").neq("estado", "suspendida");
  if (arg("empresa")) q = q.eq("slug", arg("empresa")!);
  const { data: empresas, error } = await q;
  if (error) throw error;
  for (const e of empresas ?? []) {
    const t0 = Date.now();
    const r = await db.rpc("clasificar_procesos", { p_empresa: e.id, p_desde: new Date(Date.now() - dias * 86_400_000).toISOString() });
    if (r.error) throw new Error(`${e.nombre}: ${r.error.message}`);
    console.log(`${e.nombre}: ${r.data} procesos en su radar (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
