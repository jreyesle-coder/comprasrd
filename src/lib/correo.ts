/** Resumen diario por correo: HTML con estilos en línea (compatible con Gmail/Outlook). */
import { diasRestantes, fechaRD, formatoFecha } from "./fechas";

export interface ProcesoCorreo {
  id: number;
  codigo_proceso: string;
  titulo: string | null;
  institucion: string | null;
  subcategoria: string;
  monto_estimado: number | null;
  moneda: string | null;
  fecha_cierre_ofertas: string | null;
}

export interface DatosResumen {
  empresa: { nombre: string; logo_url: string | null; color_primario: string };
  nuevos: ProcesoCorreo[];
  porCerrar: ProcesoCorreo[];
  urlApp: string;
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });
const montoTxt = (v: number | null, m: string | null) => (v == null ? "—" : `${m === "USD" ? "US$" : "RD$"} ${fmt.format(v)}`);

function fila(p: ProcesoCorreo, url: string, color: string) {
  const d = diasRestantes(p.fecha_cierre_ofertas);
  const cierre = d == null ? "—" : d < 0 ? "Cerrado" : d === 0 ? "Cierra hoy" : `${d} día${d === 1 ? "" : "s"}`;
  const colorCierre = d != null && d >= 0 && d <= 3 ? "#b91c1c" : d != null && d <= 7 ? "#b45309" : "#475569";
  return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">
    <a href="${url}/radar/${p.id}" style="color:#0f172a;font-weight:bold;font-size:14px;text-decoration:none;">${esc(p.titulo)}</a>
    <div style="font-size:12px;color:#64748b;margin-top:3px;">${esc(p.institucion)} · <span style="color:${color};">${esc(p.subcategoria)}</span></div>
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:13px;white-space:nowrap;text-align:right;">
    ${montoTxt(p.monto_estimado, p.moneda)}
    <div style="font-size:12px;color:${colorCierre};font-weight:bold;margin-top:3px;">${cierre}</div>
  </td>
</tr>`;
}

function bloque(titulo: string, lista: ProcesoCorreo[], url: string, color: string) {
  if (!lista.length) return "";
  return `<h2 style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;margin:24px 0 8px;">${titulo} (${lista.length})</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:6px;border-collapse:separate;">
${lista.slice(0, 40).map((p) => fila(p, url, color)).join("\n")}
</table>${lista.length > 40 ? `<p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;">…y ${lista.length - 40} más en el radar.</p>` : ""}`;
}

export function construirResumen({ empresa, nuevos, porCerrar, urlApp }: DatosResumen) {
  const color = empresa.color_primario;
  const fecha = formatoFecha(new Date().toISOString());
  const asunto = `Radar de Compras · ${nuevos.length} nuevos y ${porCerrar.length} por cerrar · ${fecha}`;
  const encabezado = empresa.logo_url
    ? `<img src="${esc(empresa.logo_url)}" alt="${esc(empresa.nombre)}" height="36" style="height:36px;max-width:160px;">`
    : `<span style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:${color};">${esc(empresa.nombre)}</span>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:8px;">
<tr><td style="padding:20px 24px;border-bottom:4px solid ${color};">${encabezado}
  <div style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;margin-top:6px;">Radar de Compras Públicas · resumen del ${fecha}</div></td></tr>
<tr><td style="padding:8px 24px 24px;">
${nuevos.length || porCerrar.length ? "" : `<p style="font-family:Arial,sans-serif;font-size:14px;color:#334155;">Hoy no hay procesos nuevos en tus rubros.</p>`}
${bloque("Nuevos en tus rubros", nuevos, urlApp, color)}
${bloque("Cierran en los próximos 7 días", porCerrar, urlApp, color)}
<p style="margin-top:24px;"><a href="${urlApp}/radar" style="background:${color};color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Abrir el radar</a></p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;">
Datos: API de Datos Abiertos de la Dirección General de Contrataciones Públicas (DGCP). Para dejar de recibir este correo, pide a tu administrador que te quite de los destinatarios en Configuración.
</td></tr></table></td></tr></table></body></html>`;
  const texto = [
    `${empresa.nombre} — Radar de Compras (${fechaRD()})`,
    "",
    `NUEVOS (${nuevos.length})`,
    ...nuevos.map((p) => `- ${p.titulo} · ${p.institucion} · ${montoTxt(p.monto_estimado, p.moneda)} · ${urlApp}/radar/${p.id}`),
    "",
    `CIERRAN EN 7 DÍAS (${porCerrar.length})`,
    ...porCerrar.map((p) => `- ${p.titulo} · cierra ${formatoFecha(p.fecha_cierre_ofertas)} · ${urlApp}/radar/${p.id}`),
  ].join("\n");
  return { asunto, html, texto };
}
