import type { Metadata } from "next";
import Link from "next/link";
import { formatoFecha, formatoFechaHora } from "@/lib/fechas";
import { repo } from "@/lib/repo";
import { requerirAdminEmpresa } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/server";
import { Aviso, Encabezado, Logo, monto, Pie, Tarjeta } from "@/componentes/comunes";
import { EnlaceAcceso } from "@/componentes/enlace-acceso";
import { cambiarRol, generarEnlace, guardarAlertas, guardarMarca, invitar, quitar } from "./acciones";

export const metadata: Metadata = { title: "Configuración" };

const ESTADO_SUSC = { prueba: "Período de prueba", activa: "Activa", suspendida: "Suspendida" } as const;

export default async function Configuracion({ searchParams }: PageProps<"/configuracion">) {
  const s = await requerirAdminEmpresa();
  const { ok, error } = await searchParams;
  const e = s.empresa;
  const sb = await supabaseServidor();
  const [{ data: miembros }, { data: pagos }, { data: envios }, reglas, sync] = await Promise.all([
    sb.from("miembros").select("user_id, email, nombre, rol, creado_en").eq("empresa_id", e.id).order("creado_en"),
    sb.from("pagos").select("fecha, monto, moneda, metodo, periodo_hasta").eq("empresa_id", e.id).order("fecha", { ascending: false }).limit(6),
    sb.from("alertas_envios").select("enviado_en, estado, nuevos, por_cerrar").eq("empresa_id", e.id).order("enviado_en", { ascending: false }).limit(5),
    repo.reglas(e.id),
    repo.ultimaSync(),
  ]);
  const activas = reglas.filter((r) => r.activa);

  return (
    <>
      <Encabezado sesion={s} activo="/configuracion" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">
        <h1 className="text-lg font-semibold text-slate-900">Configuración de {e.nombre}</h1>
        {ok && <Aviso>{String(ok)}</Aviso>}
        {error && <Aviso tipo="error">{String(error)}</Aviso>}

        <Tarjeta titulo="Rubros que vigila tu radar" accion={<Link href="/configuracion/rubros" className="boton-primario">Editar rubros</Link>}>
          <p className="text-sm text-slate-600">
            {activas.length} subcategorías activas en {new Set(activas.map((r) => r.grupo)).size} categorías:{" "}
            <span className="text-slate-800">{activas.map((r) => r.nombre).join(" · ")}</span>
          </p>
        </Tarjeta>

        <div id="marca">
          <Tarjeta titulo="Marca">
            <form action={guardarMarca} className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div>
                  <label className="etiqueta" htmlFor="nombre">Nombre de la empresa</label>
                  <input id="nombre" name="nombre" defaultValue={e.nombre} className="campo" required />
                </div>
                <div>
                  <label className="etiqueta" htmlFor="logo">Logo (PNG, JPG, SVG o WEBP, menos de 1 MB)</label>
                  <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm" />
                  {e.logo_url && (
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" name="quitar_logo" value="1" /> Quitar el logo actual
                    </label>
                  )}
                </div>
                <div>
                  <label className="etiqueta" htmlFor="color">Color principal</label>
                  <input id="color" name="color" type="color" defaultValue={e.color_primario} className="h-9 w-20 cursor-pointer rounded border border-slate-300" />
                </div>
                <button className="boton-primario">Guardar marca</button>
              </div>
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-center">
                <div className="text-xs text-slate-500">Vista actual</div>
                <div className="mt-3 flex justify-center"><Logo url={e.logo_url} nombre={e.nombre} tam={48} /></div>
                <div className="mt-2 text-sm font-semibold">{e.nombre}</div>
                <p className="mt-3 break-all text-xs text-slate-500">
                  Enlace de entrada con tu marca:<br />
                  <code>/login?e={e.slug}</code>
                </p>
              </div>
            </form>
          </Tarjeta>
        </div>

        <div id="equipo">
          <Tarjeta titulo={`Equipo (${miembros?.length ?? 0})`}>
            <ul className="divide-y divide-slate-100 text-sm">
              {(miembros ?? []).map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <div className="text-slate-900">{m.nombre || m.email}</div>
                    {m.nombre && <div className="text-xs text-slate-500">{m.email}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <EnlaceAcceso email={m.email} accion={generarEnlace} />
                    <form action={cambiarRol} className="flex items-center gap-1">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <select name="rol" defaultValue={m.rol} className="campo w-auto py-1 text-xs">
                        <option value="usuario">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <button className="text-xs text-marca hover:underline">Cambiar</button>
                    </form>
                    {m.user_id !== s.userId && (
                      <form action={quitar}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button className="text-xs text-red-700 hover:underline">Quitar</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <form action={invitar} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_10rem_auto]">
              <input name="email" type="email" required placeholder="correo@empresa.com" className="campo" aria-label="Correo" />
              <input name="nombre" placeholder="Nombre (opcional)" className="campo" aria-label="Nombre" />
              <select name="rol" className="campo" aria-label="Rol">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="boton-primario">Agregar</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">
              Cada persona entra con su correo en la página de acceso. Si el correo tarda, usa &quot;Enlace de acceso&quot; y envíaselo por WhatsApp.
            </p>
          </Tarjeta>
        </div>

        <div id="alertas">
          <Tarjeta titulo="Resumen diario por correo" accion={<Link href="/configuracion/alertas" className="text-sm text-marca hover:underline">Ver ejemplo del correo</Link>}>
            <form action={guardarAlertas} className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="activas" value="1" defaultChecked={e.alertas_activas} className="h-4 w-4" />
                Enviar cada mañana (8:00 a. m.) los procesos nuevos y los que cierran en los próximos 7 días
              </label>
              <div>
                <label className="etiqueta" htmlFor="destinatarios">Destinatarios (separados por coma o en líneas)</label>
                <textarea id="destinatarios" name="destinatarios" rows={3} defaultValue={e.alertas_destinatarios.join("\n")} className="campo font-mono" />
              </div>
              <button className="boton-primario">Guardar alertas</button>
            </form>
            {envios && envios.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                {envios.map((x, i) => (
                  <li key={i}>{formatoFechaHora(x.enviado_en)} · {x.estado} · {x.nuevos} nuevos · {x.por_cerrar} por cerrar</li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Suscripción">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Estado</dt><dd className="font-semibold">{ESTADO_SUSC[e.estado]}</dd></div>
            <div><dt className="text-xs text-slate-500">Vigente hasta</dt><dd>{e.vence_en ? formatoFecha(`${e.vence_en}T12:00:00Z`) : "Sin vencimiento"}</dd></div>
            <div><dt className="text-xs text-slate-500">Plan</dt><dd>US$ {e.precio_mensual_usd} / mes</dd></div>
          </dl>
          {pagos && pagos.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
              {pagos.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>{formatoFecha(`${p.fecha}T12:00:00Z`)} · {p.metodo}</span>
                  <span className="tabular-nums">{p.moneda === "USD" ? `US$ ${p.monto}` : monto(p.monto)} · hasta {formatoFecha(`${p.periodo_hasta}T12:00:00Z`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </main>
      <Pie sync={sync} />
    </>
  );
}
