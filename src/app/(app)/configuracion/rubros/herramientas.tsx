"use client";

import { useRef, useState, useTransition } from "react";
import { vistaPrevia } from "./acciones";

interface Resultado {
  codigo: string;
  nivel: string;
  descripcion: string;
  ruta: string;
}

/** Busca en el catálogo UNSPSC y agrega el código elegido al campo indicado. */
export function BuscadorUnspsc({ campoId }: { campoId: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(valor: string) {
    setQ(valor);
    if (t.current) clearTimeout(t.current);
    if (valor.trim().length < 3) return setRes([]);
    t.current = setTimeout(async () => {
      setCargando(true);
      const r = await fetch(`/api/catalogo?q=${encodeURIComponent(valor)}`).then((x) => x.json()).catch(() => []);
      setRes(Array.isArray(r) ? r : []);
      setCargando(false);
    }, 300);
  }

  function agregar(codigo: string) {
    const campo = document.getElementById(campoId) as HTMLInputElement | null;
    if (!campo) return;
    const actuales = campo.value.split(/[\s,;]+/).filter(Boolean);
    if (!actuales.includes(codigo)) campo.value = [...actuales, codigo].join(", ");
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <input
        value={q}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar en el catálogo: ej. aire acondicionado, cámaras, software…"
        className="campo"
        aria-label="Buscar código UNSPSC"
      />
      {cargando && <p className="mt-1 text-xs text-slate-500">Buscando…</p>}
      {res.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-y-auto text-xs">
          {res.map((r) => (
            <li key={r.codigo}>
              <button type="button" onClick={() => agregar(r.codigo.replace(/(00)+$/, ""))} className="w-full rounded px-2 py-1 text-left hover:bg-white">
                <span className="font-mono text-marca">{r.codigo}</span> <span className="font-medium text-slate-800">{r.descripcion}</span>
                <span className="ml-1 text-slate-500">({r.nivel})</span>
                <span className="block truncate text-slate-400">{r.ruta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-slate-500">Toca un resultado para agregarlo. Una familia o clase incluye todos sus códigos.</p>
    </div>
  );
}

/** Cuenta cuántos procesos de los últimos 30 días entrarían con lo escrito en el formulario. */
export function VistaPrevia({ unspscId, palabrasId }: { unspscId: string; palabrasId: string }) {
  const [res, setRes] = useState<string>("");
  const [pendiente, iniciar] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="boton-secundario"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const u = (document.getElementById(unspscId) as HTMLInputElement)?.value ?? "";
            const p = (document.getElementById(palabrasId) as HTMLTextAreaElement)?.value ?? "";
            const r = await vistaPrevia(u, p);
            setRes("error" in r ? `Error: ${r.error}` : `${r.total.toLocaleString("es-DO")} procesos en los últimos 30 días`);
          })
        }
      >
        {pendiente ? "Contando…" : "Probar"}
      </button>
      {res && <span className="text-xs text-slate-600">{res}</span>}
    </span>
  );
}
