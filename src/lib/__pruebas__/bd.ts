/** Postgres en memoria (PGlite) con el esquema real de supabase/migraciones, para pruebas. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const STUB_SUPABASE = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('prueba.email', true)) $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function bdDePrueba() {
  const db = new PGlite();
  await db.exec(STUB_SUPABASE);
  const dir = path.join(process.cwd(), "supabase", "migraciones");
  for (const f of fs.readdirSync(dir).filter((x) => /^\d{3}_.*\.sql$/.test(x)).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return db;
}
