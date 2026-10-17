import ExcelJS from "exceljs";
import { CATEGORIA_ETIQUETA } from "../../../../config/categorias";
import { diasRestantes, fechaRD } from "@/lib/fechas";
import { ETIQUETA_ESTADO_INTERNO, leerFiltros, repo } from "@/lib/repo";
import { usuarioActual } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!(await usuarioActual())) return new Response("No autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { filas } = await repo.listar(leerFiltros(sp), true);

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Procesos");
  hoja.columns = [
    { header: "Código", key: "codigo", width: 30 },
    { header: "Título", key: "titulo", width: 60 },
    { header: "Institución", key: "institucion", width: 40 },
    { header: "Categoría", key: "categoria", width: 18 },
    { header: "Subcategoría", key: "subcategoria", width: 28 },
    { header: "Modalidad", key: "modalidad", width: 28 },
    { header: "Estado", key: "estado", width: 26 },
    { header: "Moneda", key: "moneda", width: 8 },
    { header: "Monto estimado", key: "monto", width: 18, style: { numFmt: "#,##0.00" } },
    { header: "Publicado", key: "publicado", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Cierre de ofertas", key: "cierre", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Días restantes", key: "dias", width: 14 },
    { header: "MIPYME", key: "mipyme", width: 9 },
    { header: "Estado interno", key: "interno", width: 16 },
    { header: "Nota", key: "nota", width: 40 },
    { header: "Motivo", key: "motivo", width: 40 },
    { header: "Enlace al portal", key: "url", width: 50 },
  ];
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  // Excel no maneja zonas horarias: se escribe la hora de RD como si fuera local.
  const enRD = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 4 * 3600_000) : null);
  for (const p of filas) {
    const dias = diasRestantes(p.fecha_cierre_ofertas);
    hoja.addRow({
      codigo: p.codigo_proceso,
      titulo: p.titulo,
      institucion: p.institucion,
      categoria: p.categoria ? CATEGORIA_ETIQUETA[p.categoria] : "",
      subcategoria: p.subcategorias.join(", "),
      modalidad: p.modalidad,
      estado: p.estado,
      moneda: p.moneda,
      monto: p.monto_estimado,
      publicado: enRD(p.fecha_publicacion),
      cierre: enRD(p.fecha_cierre_ofertas),
      dias: dias != null && dias >= 0 ? dias : "Cerrado",
      mipyme: p.es_mipyme ? "Sí" : "No",
      interno: ETIQUETA_ESTADO_INTERNO[p.estado_interno],
      nota: p.nota,
      motivo: p.motivo_match,
      url: p.url_portal ? { text: "Abrir", hyperlink: p.url_portal } : "",
    });
  }
  hoja.autoFilter = { from: "A1", to: "Q1" };

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="radar-compras-${fechaRD()}.xlsx"`,
    },
  });
}
