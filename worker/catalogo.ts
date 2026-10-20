/**
 * Carga el catálogo UNSPSC de la DGCP (GET /catalogo, ~17 páginas) en la tabla catalogo_unspsc
 * para el buscador del editor de rubros. Correr una vez (o cuando la DGCP actualice el catálogo).
 *
 * Uso: npm run catalogo
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { normalizar } from "../src/lib/clasificador";
import { ClienteDgcp } from "./dgcp";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

interface FilaCatalogo {
  segmento: string; descripcion_segmento: string; familia: string; descripcion_familia: string;
  clase: string; descripcion_clase: string; subclase: string; descripcion_subclase: string; sinonimos_subclase?: string;
}

async function main() {
  const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const api = new ClienteDgcp({ base: process.env.DGCP_API_BASE || undefined });
  const filas = new Map<string, { codigo: string; nivel: string; descripcion: string; ruta: string; busqueda: string }>();
  const poner = (codigo: string, nivel: string, descripcion: string, ruta: string[], extra = "") => {
    if (!codigo || filas.has(codigo)) return;
    filas.set(codigo, { codigo, nivel, descripcion: descripcion.trim(), ruta: ruta.join(" › "), busqueda: normalizar(`${descripcion} ${extra} ${ruta.join(" ")}`) });
  };
  for (let page = 1, pages = 1; page <= pages; page++) {
    const r = await api.get<FilaCatalogo>("/catalogo", { limit: 1000, page });
    pages = r.pages ?? 1;
    for (const c of r.payload.content ?? []) {
      poner(c.segmento, "segmento", c.descripcion_segmento, []);
      poner(c.familia, "familia", c.descripcion_familia, [c.descripcion_segmento]);
      poner(c.clase, "clase", c.descripcion_clase, [c.descripcion_segmento, c.descripcion_familia]);
      poner(c.subclase, "subclase", c.descripcion_subclase, [c.descripcion_familia, c.descripcion_clase], (c.sinonimos_subclase ?? "").replace(/\|\|/g, " "));
    }
    console.log(`página ${page}/${pages} · ${filas.size} códigos`);
  }
  const todas = [...filas.values()];
  for (let i = 0; i < todas.length; i += 1000) {
    const { error } = await db.from("catalogo_unspsc").upsert(todas.slice(i, i + 1000), { onConflict: "codigo" });
    if (error) throw new Error(error.message);
  }
  console.log(`Catálogo cargado: ${todas.length} códigos · ${api.peticiones} peticiones (máx/min ${api.maxPorMinuto})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
