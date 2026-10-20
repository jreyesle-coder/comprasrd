"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function FormularioClave() {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return setEstado({ tipo: "error", texto: "Usa al menos 8 caracteres." });
    if (clave !== repetir) return setEstado({ tipo: "error", texto: "Las dos contraseñas no coinciden." });
    setEnviando(true);
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return setEstado({ tipo: "error", texto: `No se pudo guardar: ${error.message}` });
    setClave("");
    setRepetir("");
    setEstado({ tipo: "ok", texto: "Contraseña guardada. Desde ahora puedes entrar con tu correo y esta contraseña." });
  }

  return (
    <form onSubmit={guardar} className="mt-3 space-y-3">
      <div>
        <label htmlFor="nueva" className="etiqueta">Nueva contraseña</label>
        <input id="nueva" type="password" value={clave} onChange={(e) => setClave(e.target.value)} className="campo" autoComplete="new-password" required />
      </div>
      <div>
        <label htmlFor="repetir" className="etiqueta">Repítela</label>
        <input id="repetir" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className="campo" autoComplete="new-password" required />
      </div>
      <button disabled={enviando} className="boton-primario w-full">{enviando ? "Guardando…" : "Guardar contraseña"}</button>
      {estado && (
        <p className={`rounded px-3 py-2 text-sm ${estado.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{estado.texto}</p>
      )}
    </form>
  );
}
