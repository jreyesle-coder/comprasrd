/**
 * Vuelve a clasificar los procesos ya guardados con la configuración actual de config/categorias.ts,
 * usando el `raw` guardado (no llama a la API de la DGCP).
 * - Actualiza categoría/subcategoría/motivo.
 * - Los que dejan de ser relevantes se borran, salvo que tengan seguimiento interno.
 * Para que entren procesos que antes NO eran relevantes, corre: npm run sync -- --dias 30
 *
 * Uso: npm run reclasificar            (Supabase)
 *      npm run reclasificar -- --seco  (worker/salida/radar-seco.json)
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { clasificar } from "../src/lib/clasificador";
import type { ArticuloApi, ProcesoApi } from "./dgcp";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

type Raw = { proceso: ProcesoApi; articulos: ArticuloApi[] };
const campos = (raw: Raw) => {
  const c = clasificar(raw.proceso, raw.articulos);
  return { relevante: c.relevante, categoria: c.categoria, subcategoria: c.subcategoria, subcategorias: c.subcategorias, motivo_match: c.motivo_match };
};

async function seco() {
  const archivo = path.join("worker", "salida", "radar-seco.json");
  const d = JSON.parse(fs.readFileSync(archivo, "utf8"));
  const antes = d.procesos.length;
  d.procesos = d.procesos.filter((p: { fila: Record<string, unknown> & { raw: Raw } }) => {
    const { relevante, ...c } = campos(p.fila.raw);
    Object.assign(p.fila, c);
    return relevante;
  });
  fs.writeFileSync(archivo, JSON.stringify(d));
  console.log(`Reclasificados ${antes} · siguen relevantes ${d.procesos.length} · quitados ${antes - d.procesos.length}`);
}

async function supabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  let total = 0, quitados = 0, cambiados = 0;
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await db.from("procesos").select("id, categoria, subcategoria, motivo_match, raw, seguimiento(proceso_id)").order("id").range(desde, desde + 499);
    if (error) throw error;
    if (!data?.length) break;
    for (const p of data as unknown as { id: number; categoria: string; subcategoria: string; motivo_match: string; raw: Raw; seguimiento: unknown }[]) {
      total++;
      const { relevante, ...c } = campos(p.raw);
      if (!relevante && !p.seguimiento) {
        await db.from("procesos").delete().eq("id", p.id);
        quitados++;
        desde--; // la página se corre una fila
      } else if (c.categoria !== p.categoria || c.subcategoria !== p.subcategoria || c.motivo_match !== p.motivo_match) {
        await db.from("procesos").update(relevante ? c : { ...c, motivo_match: `(ya no coincide) ${p.motivo_match}` }).eq("id", p.id);
        cambiados++;
      }
    }
  }
  console.log(`Revisados ${total} · actualizados ${cambiados} · quitados ${quitados}`);
}

(process.argv.includes("--seco") ? seco() : supabase()).catch((e) => {
  console.error(e);
  process.exit(1);
});
