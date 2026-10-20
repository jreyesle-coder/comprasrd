import Link from "next/link";

export function PiePublico() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500">
        <span>
          © {new Date().getFullYear()} Radar de Compras Públicas RD. Datos: API de Datos Abiertos de la DGCP. Servicio independiente, sin
          vínculo oficial con la DGCP.
        </span>
        <span className="flex gap-4">
          <Link href="/terminos" className="hover:underline">Términos</Link>
          <Link href="/privacidad" className="hover:underline">Privacidad</Link>
          <Link href="/login" className="hover:underline">Entrar</Link>
        </span>
      </div>
    </footer>
  );
}

export function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white" style={{ ["--marca" as string]: "#1d4ed8" }}>
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-semibold text-slate-900">Radar de Compras Públicas</Link>
          <Link href="/login" className="boton-secundario">Entrar</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Texto de ejemplo. Revísalo con tu asesor legal antes de publicarlo como definitivo.
        </p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900">
          {children}
        </div>
      </main>
      <PiePublico />
    </div>
  );
}
