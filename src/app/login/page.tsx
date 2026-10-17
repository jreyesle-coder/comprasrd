"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | string>("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setEstado(error ? `No se pudo enviar el enlace: ${error.message}` : "enviado");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-700 font-bold text-white">RC</div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Radar de Compras Públicas RD</h1>
        <p className="mt-1 text-sm text-slate-600">Acceso interno. Te enviaremos un enlace a tu correo.</p>
        {estado === "enviado" ? (
          <p className="mt-5 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Listo. Revisa tu correo <b>{email}</b> y abre el enlace para entrar.
          </p>
        ) : (
          <form onSubmit={enviar} className="mt-5 space-y-3">
            <div>
              <label htmlFor="email" className="etiqueta">Correo</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="campo" autoComplete="email" />
            </div>
            <button disabled={estado === "enviando"} className="boton-primario w-full disabled:opacity-60">
              {estado === "enviando" ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
            {estado && estado !== "enviando" && <p className="text-sm text-red-700">{estado}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
