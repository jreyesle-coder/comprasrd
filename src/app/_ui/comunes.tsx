import Link from "next/link";
import { CATEGORIA_ETIQUETA } from "../../../config/categorias";
import { diasRestantes, formatoFechaHora } from "@/lib/fechas";
import { MODO_DEMO, usuarioActual } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO_INTERNO, type EstadoInterno, type UltimaSync } from "@/lib/repo";

const fmt = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function monto(valor: number | null, moneda: string | null) {
  if (valor == null) return "—";
  const simbolo = moneda === "USD" ? "US$" : "RD$";
  return `${simbolo} ${fmt.format(valor)}`;
}

const COLOR_CAT = {
  tecnologia: "bg-blue-50 text-blue-800 ring-blue-200",
  servicios_generales: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ambas: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;

export function ChipCategoria({ categoria, subcategoria }: { categoria: keyof typeof COLOR_CAT | null; subcategoria?: string | null }) {
  if (!categoria) return null;
  return (
    <span className={`inline-flex max-w-full flex-col rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${COLOR_CAT[categoria]}`}>
      <span className="font-semibold">{CATEGORIA_ETIQUETA[categoria]}</span>
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
  ofertado: "text-emerald-700 font-semibold",
  descartado: "text-slate-400 line-through",
};

export function EstadoInternoTexto({ estado }: { estado: EstadoInterno }) {
  return <span className={`text-xs ${COLOR_EI[estado]}`}>{ETIQUETA_ESTADO_INTERNO[estado]}</span>;
}

export async function Encabezado() {
  const usuario = await usuarioActual();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-700 text-sm font-bold text-white">RC</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">Radar de Compras Públicas RD</span>
            <span className="block text-xs text-slate-500">Tecnología · Servicios generales</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {MODO_DEMO && <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Modo demo</span>}
          {usuario && !MODO_DEMO && (
            <>
              <span className="hidden sm:inline">{usuario}</span>
              <form action="/auth/salir" method="post">
                <button className="text-blue-700 hover:underline">Salir</button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Pie({ sync }: { sync: UltimaSync | null }) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-slate-500">
        Última sincronización: {sync?.fin ? formatoFechaHora(sync.fin) : "nunca"}
        {sync && sync.exito === false && <span className="ml-2 font-semibold text-red-700">(falló — ver sync_log)</span>}
        {sync?.exito && sync.procesos_nuevos != null && <> · {sync.procesos_nuevos} nuevos</>}
        <span className="block sm:inline sm:ml-2">
          Fuente: API de Datos Abiertos de la DGCP (datosabiertos.dgcp.gob.do)
        </span>
      </div>
    </footer>
  );
}
