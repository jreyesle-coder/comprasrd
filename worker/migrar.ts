/**
 * Aplica las migraciones pendientes de supabase/migraciones usando la función exec_sql
 * (se crea una sola vez con 000_permitir_migraciones.sql en el SQL Editor).
 *
 * Uso: npm run migrar
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(url, key, { auth: { persistSession: false } });

async function sql(texto: string) {
  const { error } = await db.rpc("exec_sql", { sql: texto });
  if (error) throw new Error(error.message);
}

async function aplicadas(): Promise<Set<string>> {
  const r = await db.from("_migraciones").select("nombre");
  if (!r.error) return new Set((r.data ?? []).map((x) => x.nombre));
  // Antes de 002 no existía la tabla: 000 y 001 se aplicaron a mano en el SQL Editor.
  const p = await db.from("procesos").select("id", { head: true, count: "exact" });
  return new Set(p.error ? ["000_permitir_migraciones.sql"] : ["000_permitir_migraciones.sql", "001_inicial.sql"]);
}

async function main() {
  const prueba = await db.rpc("exec_sql", { sql: "select 1" });
  if (prueba.error) {
    console.error(
      "No existe la función exec_sql. Pega supabase/migraciones/000_permitir_migraciones.sql en Supabase → SQL Editor → Run.\n" +
        `Detalle: ${prueba.error.message}`,
    );
    process.exit(1);
  }
  const hechas = await aplicadas();
  const dir = path.join("supabase", "migraciones");
  const pendientes = fs.readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f) && !hechas.has(f)).sort();
  if (!pendientes.length) return console.log("Base de datos al día.");
  for (const f of pendientes) {
    process.stdout.write(`Aplicando ${f}… `);
    await sql(fs.readFileSync(path.join(dir, f), "utf8"));
    await sql(`insert into _migraciones (nombre) values ('${f}') on conflict do nothing`);
    console.log("ok");
  }
  // asegurar que el registro incluya las previas
  for (const f of hechas) await sql(`insert into _migraciones (nombre) values ('${f}') on conflict do nothing`);
  await sql("notify pgrst, 'reload schema'");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
