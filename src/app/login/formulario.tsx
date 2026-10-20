"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";

const cliente = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function FormularioLogin() {
  const router = useRouter();
  const [modo, setModo] = useState<"clave" | "enlace">("clave");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [estado, setEstado] = useState<string>("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const { error } = await cliente().auth.signInWithPassword({ email: email.trim(), password: clave });
    if (!error) {
      router.replace("/radar");
      router.refresh();
      return;
    }
    setEstado(
      /invalid login credentials/i.test(error.message)
        ? "Correo o contraseña incorrectos. Si aún no tienes contraseña, entra con un enlace por correo y créala en Mi cuenta."
        : `No se pudo entrar: ${error.message}`,
    );
  }

  async function enviarEnlace(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const { error } = await cliente().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (!error) return setEstado("enviado");
    setEstado(
      /signups not allowed|not found/i.test(error.message)
        ? "Ese correo no tiene acceso. Pide a tu administrador que te invite."
        : /rate limit|seconds/i.test(error.message)
          ? "Se enviaron demasiados enlaces. Espera unos minutos o entra con tu contraseña."
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
    <form onSubmit={modo === "clave" ? entrar : enviarEnlace} className="mt-5 space-y-3">
      <div>
        <label htmlFor="email" className="etiqueta">Correo</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="campo" autoComplete="email" />
      </div>
      {modo === "clave" && (
        <div>
          <label htmlFor="clave" className="etiqueta">Contraseña</label>
          <input id="clave" type="password" required value={clave} onChange={(e) => setClave(e.target.value)} className="campo" autoComplete="current-password" />
        </div>
      )}
      <button disabled={estado === "enviando"} className="boton-primario w-full">
        {estado === "enviando" ? "Un momento…" : modo === "clave" ? "Entrar" : "Enviar enlace de acceso"}
      </button>
      {estado && estado !== "enviando" && <p className="text-sm text-red-700">{estado}</p>}
      <button
        type="button"
        onClick={() => {
          setModo(modo === "clave" ? "enlace" : "clave");
          setEstado("");
        }}
        className="w-full text-center text-xs text-marca hover:underline"
      >
        {modo === "clave" ? "¿No tienes contraseña? Recibe un enlace por correo" : "Entrar con contraseña"}
      </button>
    </form>
  );
}
