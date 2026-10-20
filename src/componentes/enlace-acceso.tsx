"use client";

import { useActionState, useState } from "react";

type Estado = { enlace?: string; error?: string } | null;

/** Botón que genera un enlace de acceso de un solo uso y permite copiarlo o mandarlo por WhatsApp. */
export function EnlaceAcceso({ email, accion }: { email: string; accion: (prev: Estado, form: FormData) => Promise<Estado> }) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null);
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="text-xs">
      <form action={ejecutar}>
        <input type="hidden" name="email" value={email} />
        <button disabled={pendiente} className="text-marca hover:underline disabled:opacity-50">
          {pendiente ? "Generando…" : "Enlace de acceso"}
        </button>
      </form>
      {estado?.error && <p className="mt-1 text-red-700">{estado.error}</p>}
      {estado?.enlace && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200"
            onClick={() => navigator.clipboard.writeText(estado.enlace!).then(() => setCopiado(true))}
          >
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
          <a
            className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 hover:bg-emerald-100"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Tu acceso al Radar de Compras (válido 1 hora, un solo uso): ${estado.enlace}`)}`}
          >
            WhatsApp
          </a>
          <span className="text-slate-500">Vence en 1 hora · un solo uso</span>
        </div>
      )}
    </div>
  );
}
