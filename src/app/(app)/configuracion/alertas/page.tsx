import type { Metadata } from "next";
import Link from "next/link";
import { construirResumen } from "@/lib/correo";
import { haceHoras } from "@/lib/fechas";
import { origenApp } from "@/lib/operaciones";
import { procesosDelResumen } from "@/lib/resumen";
import { requerirAdminEmpresa } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { Encabezado } from "@/componentes/comunes";

export const metadata: Metadata = { title: "Ejemplo del resumen diario" };

/** Vista previa del correo con los datos reales de las últimas 24 horas. */
export default async function VistaPreviaAlerta() {
  const s = await requerirAdminEmpresa();
  const db = await supabaseServidor();
  const { nuevos, porCerrar } = await procesosDelResumen(db, s.empresa.id, haceHoras(24));
  const { asunto, html } = construirResumen({ empresa: s.empresa, nuevos, porCerrar, urlApp: await origenApp() });
  return (
    <>
      <Encabezado sesion={s} activo="/configuracion" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">
        <Link href="/configuracion#alertas" className="text-sm text-marca hover:underline">← Volver a Configuración</Link>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Asunto</div>
          <div className="text-sm font-semibold text-slate-900">{asunto}</div>
          <div className="mt-1 text-xs text-slate-500">Para: {s.empresa.alertas_destinatarios.join(", ") || "(sin destinatarios)"}</div>
        </div>
        <iframe title="Ejemplo del correo" srcDoc={html} className="mt-4 h-[900px] w-full rounded-lg border border-slate-200 bg-white" />
      </main>
    </>
  );
}
