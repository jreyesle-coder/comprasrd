import Link from "next/link";
import { diasRestantes, formatoFechaHora } from "@/lib/fechas";
import { ETIQUETA_ESTADO_INTERNO, type EstadoInterno, type UltimaSync } from "@/lib/repo";
import type { Sesion } from "@/lib/sesion";

export const NOMBRE_PRODUCTO = "Radar de Compras Públicas";

const fmt = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCorto = new Intl.NumberFormat("es-DO", { notation: "compact", maximumFractionDigits: 1 });

export function monto(valor: number | null | undefined, moneda?: string | null) {
  if (valor == null) return "—";
  return `${moneda === "USD" ? "US$" : "RD$"} ${fmt.format(valor)}`;
}

export function montoCorto(valor: number | null | undefined) {
  if (valor == null) return "—";
  return `RD$ ${fmtCorto.format(valor)}`;
}

// Colores estables por nombre de grupo
const PALETA = [
  "bg-blue-50 text-blue-800 ring-blue-200",
  "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "bg-amber-50 text-amber-800 ring-amber-200",
  "bg-rose-50 text-rose-800 ring-rose-200",
  "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "bg-lime-50 text-lime-800 ring-lime-200",
];
const colorGrupo = (g: string) => {
  if (g === "Tecnología") return PALETA[0];
  if (g === "Servicios generales") return PALETA[1];
  let h = 0;
  for (const c of g) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[2 + (h % (PALETA.length - 2))];
};

export function ChipGrupo({ grupos, subcategoria }: { grupos: string[]; subcategoria?: string | null }) {
  if (!grupos?.length) return null;
  const color = grupos.length > 1 ? "bg-violet-50 text-violet-800 ring-violet-200" : colorGrupo(grupos[0]);
  return (
    <span className={`inline-flex max-w-full flex-col rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${color}`}>
      <span className="font-semibold">{grupos.join(" + ")}</span>
      {subcategoria && <span className="truncate opacity-80">{subcategoria}</span>}
    </span>
  );
}

export function DiasRestantes({ cierre }: { cierre: string | null }) {
  const d = diasRestantes(cierre);
  if (d == null) return <span className="text-slate-400">—</span>;
  if (d < 0 || new Date(cierre!) < new Date()) return <span className="text-xs text-slate-400">Cerrado</span>;
  const color = d <= 3 ? "bg-red-100 text-red-800" : d <= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  const texto = d === 0 ? "Cierra hoy" : d === 1 ? "1 día" : `${d} días`;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>{texto}</span>;
}

const COLOR_EI: Record<EstadoInterno, string> = {
  nuevo: "text-slate-500",
  interesa: "text-blue-700 font-semibold",
  en_preparacion: "text-amber-700 font-semibold",
  ofertado: "text-violet-700 font-semibold",
  ganado: "text-emerald-700 font-semibold",
  perdido: "text-red-700",
  descartado: "text-slate-400 line-through",
};

export function EstadoInternoTexto({ estado }: { estado: EstadoInterno }) {
  return <span className={`text-xs ${COLOR_EI[estado]}`}>{ETIQUETA_ESTADO_INTERNO[estado]}</span>;
}

export function Logo({ url, nombre, tam = 32 }: { url?: string | null; nombre: string; tam?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} style={{ height: tam, maxWidth: tam * 4 }} className="w-auto object-contain" />;
  }
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <span style={{ height: tam, width: tam }} className="grid shrink-0 place-items-center rounded-md bg-marca text-sm font-bold text-white">
      {iniciales || "RC"}
    </span>
  );
}

export function Encabezado({ sesion, activo }: { sesion: Sesion; activo?: string }) {
  const empresa = sesion.empresa;
  const enlaces = [
    { href: "/radar", texto: "Radar" },
    { href: "/pipeline", texto: "Pipeline" },
    { href: "/competencia", texto: "Competencia" },
    ...(sesion.rol === "admin" || sesion.superadmin ? [{ href: "/configuracion", texto: "Configuración" }] : []),
    ...(sesion.superadmin ? [{ href: "/admin", texto: "Admin" }] : []),
  ];
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/radar" className="flex min-w-0 items-center gap-2.5">
          <Logo url={empresa?.logo_url} nombre={empresa?.nombre ?? NOMBRE_PRODUCTO} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">{empresa?.nombre ?? NOMBRE_PRODUCTO}</span>
            <span className="block text-xs text-slate-500">{NOMBRE_PRODUCTO}</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/cuenta" className="hover:text-slate-900 hover:underline" title="Mi cuenta">
            <span className="hidden md:inline">{sesion.email}</span>
            <span className="md:hidden">Mi cuenta</span>
          </Link>
          <form action="/auth/salir" method="post">
            <button className="text-marca hover:underline">Salir</button>
          </form>
        </div>
        <nav className="-mb-3 flex w-full gap-1 overflow-x-auto text-sm">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 ${
                activo === e.href ? "border-marca font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {e.texto}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Pie({ sync }: { sync: UltimaSync | null }) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-slate-500">
        Última sincronización: {sync?.fin ? formatoFechaHora(sync.fin) : "nunca"}
        {sync && sync.exito === false && <span className="ml-2 font-semibold text-red-700">(falló)</span>}
        <span className="block sm:ml-2 sm:inline">Fuente: API de Datos Abiertos de la DGCP · {NOMBRE_PRODUCTO}</span>
      </div>
    </footer>
  );
}

export function Tarjeta({ titulo, children, accion }: { titulo?: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {(titulo || accion) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({ tipo = "ok", children }: { tipo?: "ok" | "error" | "info"; children: React.ReactNode }) {
  const c = tipo === "ok" ? "bg-emerald-50 text-emerald-800" : tipo === "error" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800";
  return <p className={`rounded px-3 py-2 text-sm ${c}`}>{children}</p>;
}
