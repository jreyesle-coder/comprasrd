import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PUBLICAS = ["/login", "/auth/", "/terminos", "/privacidad"];

/** Refresca la sesión de Supabase; manda a /login a quien no la tenga (salvo páginas públicas). */
export async function proxy(request: NextRequest) {
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
  const publica = ruta === "/" || PUBLICAS.some((p) => ruta.startsWith(p));
  if (!data.user && !publica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  if (data.user && ruta === "/") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/radar";
    return NextResponse.redirect(destino);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
