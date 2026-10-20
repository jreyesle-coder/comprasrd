/**
 * Siembra / actualiza la empresa piloto y el superadministrador. Se puede correr varias veces.
 *
 * Uso: npm run sembrar -- --superadmin correo@dominio.com [--empresa piloto]
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { EXCLUSIONES_POR_DEFECTO, reglasDePlantillas } from "../src/lib/plantillas";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const ok = <T>(r: { data: T; error: { message: string } | null }, que: string) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data;
};

async function main() {
  const slug = arg("empresa") ?? "piloto";
  const email = arg("superadmin")?.toLowerCase();

  const empresa = ok(await db.from("empresas").select("id, nombre").eq("slug", slug).single(), "empresa") as { id: string; nombre: string };
  console.log(`Empresa: ${empresa.nombre} (${slug})`);

  const { count } = await db.from("reglas").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id);
  if (!count) {
    const reglas = reglasDePlantillas(["tecnologia", "servicios_generales"]).map((r) => ({ ...r, empresa_id: empresa.id }));
    ok(await db.from("reglas").insert(reglas), "insertar reglas");
    ok(await db.from("empresas").update(EXCLUSIONES_POR_DEFECTO).eq("id", empresa.id), "exclusiones");
    console.log(`  ${reglas.length} rubros de las plantillas Tecnología + Servicios generales`);
  }

  if (email) {
    ok(await db.from("superadmins").upsert({ email }), "superadmin");
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    let user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      const r = await db.auth.admin.createUser({ email, email_confirm: true });
      if (r.error || !r.data.user) throw new Error(`crear usuario: ${r.error?.message}`);
      user = r.data.user;
    }
    ok(await db.from("miembros").upsert({ user_id: user.id, empresa_id: empresa.id, email, rol: "admin" }), "miembro");
    console.log(`  Superadmin y administrador de la empresa: ${email}`);
  }

  const n = ok(await db.rpc("clasificar_procesos", { p_empresa: empresa.id, p_desde: new Date(Date.now() - 400 * 86_400_000).toISOString() }), "clasificar");
  console.log(`  Clasificados: ${n} procesos coinciden`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
