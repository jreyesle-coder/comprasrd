import { normalizar } from "@/lib/clasificador";
import { obtenerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";

/** Búsqueda en el catálogo UNSPSC para el editor de rubros: /api/catalogo?q=aire acondicionado */
export async function GET(request: Request) {
  if (!(await obtenerSesion())) return Response.json([], { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const sb = await supabaseServidor();
  const soloDigitos = q.replace(/\D/g, "");
  let consulta = sb.from("catalogo_unspsc").select("codigo, nivel, descripcion, ruta");
  if (soloDigitos.length >= 2 && soloDigitos.length === q.trim().length) consulta = consulta.like("codigo", `${soloDigitos}%`);
  else for (const w of normalizar(q).split(" ").filter((x) => x.length >= 2)) consulta = consulta.ilike("busqueda", `%${w}%`);
  // primero los niveles más generales (segmento → familia → clase → subclase)
  const { data } = await consulta.order("codigo").limit(200);
  const peso = { segmento: 0, familia: 1, clase: 2, subclase: 3 } as Record<string, number>;
  const orden = (data ?? []).sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.codigo.localeCompare(b.codigo)).slice(0, 25);
  return Response.json(orden);
}
