import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PUBLICAS = ["/login", "/auth/"];

/** Refresca la sesión de Supabase y manda a /login a quien no haya iniciado sesión. */
export async function proxy(request: NextRequest) {
  if (!URL_SB || !ANON) return NextResponse.next(); // modo demo

  let response = NextResponse.next({ request });
  const sb = createServerClient(URL_SB, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of lista) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const ruta = request.nextUrl.pathname;
  if (!data.user && !PUBLICAS.some((p) => ruta.startsWith(p))) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
