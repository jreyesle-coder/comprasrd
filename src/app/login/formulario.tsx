"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function FormularioLogin() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<string>("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (!error) return setEstado("enviado");
    setEstado(
      /signups not allowed|not found/i.test(error.message)
        ? "Ese correo no tiene acceso. Pide a tu administrador que te invite."
        : /rate limit|seconds/i.test(error.message)
          ? "Se enviaron demasiados enlaces. Espera unos minutos e inténtalo de nuevo."
          : `No se pudo enviar el enlace: ${error.message}`,
    );
  }

  if (estado === "enviado")
    return (
      <p className="mt-5 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Listo. Revisa tu correo <b>{email}</b> y abre el enlace para entrar.
      </p>
    );

  return (
    <form onSubmit={enviar} className="mt-5 space-y-3">
      <div>
        <label htmlFor="email" className="etiqueta">Correo</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="campo" autoComplete="email" />
      </div>
      <button disabled={estado === "enviando"} className="boton-primario w-full">
        {estado === "enviando" ? "Enviando…" : "Enviar enlace de acceso"}
      </button>
      {estado && estado !== "enviando" && <p className="text-sm text-red-700">{estado}</p>}
    </form>
  );
}
