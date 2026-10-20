import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin, hayAdmin } from "@/lib/supabase/admin";
import { Logo, NOMBRE_PRODUCTO } from "@/componentes/comunes";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

/** /login?e=slug muestra el logo y color de esa empresa. */
export default async function Login({ searchParams }: PageProps<"/login">) {
  const { e, error } = await searchParams;
  let marca: { nombre: string; logo_url: string | null; color_primario: string } | null = null;
  if (typeof e === "string" && /^[a-z0-9-]{2,40}$/.test(e) && hayAdmin()) {
    const { data } = await supabaseAdmin().from("empresas").select("nombre, logo_url, color_primario").eq("slug", e).maybeSingle();
    marca = data;
  }
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" style={{ ["--marca" as string]: marca?.color_primario ?? "#1d4ed8" }}>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Logo url={marca?.logo_url} nombre={marca?.nombre ?? "Radar Compras"} tam={40} />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{marca?.nombre ?? NOMBRE_PRODUCTO}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {marca ? `${NOMBRE_PRODUCTO} · ` : ""}Te enviaremos un enlace de acceso a tu correo.
        </p>
        {error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">El enlace no es válido o ya venció. Pide uno nuevo.</p>}
        <FormularioLogin />
        <p className="mt-6 text-xs text-slate-500">
          ¿Aún no tienes cuenta? <Link href="/#demo" className="text-marca hover:underline">Solicita una demostración</Link>.
        </p>
      </div>
    </main>
  );
}
