import type { Metadata } from "next";
import { formatoFechaHora } from "@/lib/fechas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Tarjeta } from "@/componentes/comunes";
import { marcarSolicitud } from "../acciones";

export const metadata: Metadata = { title: "Solicitudes de demo" };

export default async function Solicitudes() {
  const { data } = await supabaseAdmin().from("solicitudes_demo").select("*").order("creado_en", { ascending: false }).limit(200);
  return (
    <Tarjeta titulo={`Solicitudes de demo (${data?.length ?? 0})`}>
      {!data?.length ? (
        <p className="text-sm text-slate-500">Todavía no hay solicitudes. Llegan desde el formulario de la página principal.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {data.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${s.atendida ? "opacity-60" : ""}`}>
              <div>
                <div className="font-semibold text-slate-900">{s.empresa} · {s.nombre}</div>
                <div className="text-xs text-slate-600">
                  <a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a>
                  {s.telefono && <> · <a href={`https://wa.me/${String(s.telefono).replace(/\D/g, "")}`} className="hover:underline">{s.telefono}</a></>}
                  {" · "}{formatoFechaHora(s.creado_en)}
                </div>
                {s.rubros && <div className="mt-1 text-xs text-slate-700">Rubros: {s.rubros}</div>}
                {s.mensaje && <div className="mt-1 text-xs text-slate-700">{s.mensaje}</div>}
              </div>
              <form action={marcarSolicitud}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="atendida" value={s.atendida ? "0" : "1"} />
                <button className="boton-secundario text-xs">{s.atendida ? "Marcar pendiente" : "Marcar atendida"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
