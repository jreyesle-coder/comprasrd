import Link from "next/link";
import { requerirSuperadmin } from "@/lib/sesion";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const s = await requerirSuperadmin();
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ ["--marca" as string]: "#0f172a" }}>
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">Radar · Administración</span>
            <Link href="/admin" className="text-slate-300 hover:text-white">Empresas</Link>
            <Link href="/admin/empresas/nueva" className="text-slate-300 hover:text-white">Nueva empresa</Link>
            <Link href="/admin/solicitudes" className="text-slate-300 hover:text-white">Solicitudes de demo</Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{s.email}</span>
            {s.empresa && <Link href="/radar" className="text-white hover:underline">Ir al radar ({s.empresa.nombre})</Link>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5">{children}</main>
    </div>
  );
}
