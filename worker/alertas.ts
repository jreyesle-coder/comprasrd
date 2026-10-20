/**
 * Envía el resumen diario a cada empresa habilitada con alertas activas.
 * - "Nuevos": procesos que entraron a su radar desde el último envío (o 24 h).
 * - "Por cerrar": abiertos que cierran en los próximos 7 días.
 * Con RESEND_API_KEY envía por Resend; sin ella solo simula y guarda el HTML en worker/salida/alertas/.
 *
 * Uso: npm run alertas            (todas)
 *      npm run alertas -- --empresa piloto --forzar   (una, aunque ya se haya enviado hoy)
 */
import { config as cargarEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { construirResumen } from "../src/lib/correo";
import { fechaRD, inicioDiaRD } from "../src/lib/fechas";
import { procesosDelResumen } from "../src/lib/resumen";

cargarEnv({ path: [".env.local", ".env"], quiet: true });

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const RESEND = process.env.RESEND_API_KEY;
const REMITENTE = process.env.ALERTAS_REMITENTE || "Radar de Compras <onboarding@resend.dev>";
const URL_APP = (process.env.URL_APP || "https://comprasrd.vercel.app").replace(/\/$/, "");

async function enviar(para: string[], asunto: string, html: string, texto: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to: para, subject: asunto, html, text: texto }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

async function main() {
  let q = db.from("empresas").select("id, nombre, slug, logo_url, color_primario, estado, vence_en, alertas_activas, alertas_destinatarios");
  if (arg("empresa")) q = q.eq("slug", arg("empresa")!);
  const { data: empresas, error } = await q;
  if (error) throw error;
  const hoy = fechaRD();
  let fallos = 0;

  for (const e of empresas ?? []) {
    const habilitada = e.estado !== "suspendida" && (!e.vence_en || e.vence_en >= hoy);
    if (!habilitada || !e.alertas_activas || !e.alertas_destinatarios.length) {
      console.log(`· ${e.nombre}: omitida (${!habilitada ? "no habilitada" : !e.alertas_activas ? "alertas apagadas" : "sin destinatarios"})`);
      continue;
    }
    const { data: ultimo } = await db.from("alertas_envios").select("enviado_en").eq("empresa_id", e.id)
      .in("estado", ["enviado", "simulado", "sin_novedades"]).order("enviado_en", { ascending: false }).limit(1).maybeSingle();
    if (ultimo && ultimo.enviado_en >= inicioDiaRD(hoy).toISOString() && !args.includes("--forzar")) {
      console.log(`· ${e.nombre}: ya se envió hoy`);
      continue;
    }
    const desde = ultimo?.enviado_en ?? new Date(Date.now() - 86_400_000).toISOString();
    try {
      const { nuevos, porCerrar } = await procesosDelResumen(db, e.id, desde);
      const { asunto, html, texto } = construirResumen({ empresa: e, nuevos, porCerrar, urlApp: URL_APP });
      let estado = "simulado";
      if (!nuevos.length && !porCerrar.length) estado = "sin_novedades";
      else if (RESEND) {
        await enviar(e.alertas_destinatarios, asunto, html, texto);
        estado = "enviado";
      } else {
        const dir = path.join("worker", "salida", "alertas");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${e.slug}-${hoy}.html`), html);
      }
      await db.from("alertas_envios").insert({
        empresa_id: e.id, destinatarios: e.alertas_destinatarios, nuevos: nuevos.length, por_cerrar: porCerrar.length, estado,
      });
      console.log(`✓ ${e.nombre}: ${estado} · ${nuevos.length} nuevos · ${porCerrar.length} por cerrar → ${e.alertas_destinatarios.join(", ")}`);
    } catch (err) {
      fallos++;
      await db.from("alertas_envios").insert({
        empresa_id: e.id, destinatarios: e.alertas_destinatarios, estado: "error", detalle: (err as Error).message.slice(0, 500),
      });
      console.error(`✗ ${e.nombre}: ${(err as Error).message}`);
    }
  }
  if (!RESEND) console.log("(Sin RESEND_API_KEY: los correos se simularon y quedaron en worker/salida/alertas/)");
  if (fallos) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
