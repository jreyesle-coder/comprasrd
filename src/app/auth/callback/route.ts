import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/** Destino del enlace mágico: canjea el código por una sesión y entra a la app. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const sb = await supabaseServidor();

  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace incompleto") };

  return NextResponse.redirect(new URL(error ? "/login?error=enlace" : "/", url.origin));
}
