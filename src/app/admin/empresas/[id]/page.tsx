import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fechaRD, formatoFecha, formatoFechaHora, sumarDias } from "@/lib/fechas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Aviso, Logo, Tarjeta } from "@/componentes/comunes";
import { EnlaceAcceso } from "@/componentes/enlace-acceso";
import { agregarUsuario, editarEmpresa, eliminarEmpresa, enlace, pago, quitarUsuario, reclasificarEmpresa, verComo } from "../../acciones";

export const metadata: Metadata = { title: "Empresa" };

export default async function EmpresaAdmin({ params, searchParams }: PageProps<"/admin/empresas/[id]">) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const db = supabaseAdmin();
  const [{ data: e }, { data: miembros }, { data: pagos }, { count: coinc }, { count: reglas }, { data: envios }] = await Promise.all([
    db.from("empresas").select("*").eq("id", id).maybeSingle(),
    db.from("miembros").select("user_id, email, nombre, rol").eq("empresa_id", id).order("creado_en"),
    db.from("pagos").select("fecha, monto, moneda, metodo, referencia, periodo_hasta, registrado_por").eq("empresa_id", id).order("fecha", { ascending: false }),
    db.from("coincidencias").select("proceso_id", { count: "exact", head: true }).eq("empresa_id", id),
    db.from("reglas").select("id", { count: "exact", head: true }).eq("empresa_id", id).eq("activa", true),
    db.from("alertas_envios").select("enviado_en, estado, nuevos, por_cerrar, detalle").eq("empresa_id", id).order("enviado_en", { ascending: false }).limit(5),
  ]);
  if (!e) notFound();
  const base = e.vence_en && e.vence_en > fechaRD() ? e.vence_en : fechaRD();
  const siguiente = sumarDias(base, 30);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3" style={{ ["--marca" as string]: e.color_primario }}>
          <Logo url={e.logo_url} nombre={e.nombre} tam={40} />
          <div>
            <h1 className="text-lg font-semibold">{e.nombre}</h1>
            <p className="text-xs text-slate-500">{coinc?.toLocaleString("es-DO")} procesos en su radar · {reglas} rubros activos · acceso: <code>/login?e={e.slug}</code></p>
          </div>
        </div>
        <div className="flex gap-2">
          <form action={reclasificarEmpresa}><input type="hidden" name="id" value={id} /><button className="boton-secundario">Recalcular radar</button></form>
          <form action={verComo}><input type="hidden" name="id" value={id} /><button className="boton-primario">Ver como esta empresa</button></form>
        </div>
      </div>
      {ok && <Aviso>{String(ok)}</Aviso>}
      {error && <Aviso tipo="error">{String(error)}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Datos y suscripción">
          <form action={editarEmpresa} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="sm:col-span-2"><label className="etiqueta">Nombre</label><input name="nombre" defaultValue={e.nombre} className="campo" required /></div>
            <div>
              <label className="etiqueta">Estado</label>
              <select name="estado" defaultValue={e.estado} className="campo">
                <option value="prueba">Prueba</option><option value="activa">Activa</option><option value="suspendida">Suspendida</option>
              </select>
            </div>
            <div><label className="etiqueta">Vigente hasta</label><input type="date" name="vence_en" defaultValue={e.vence_en ?? ""} className="campo" /></div>
            <div><label className="etiqueta">Precio US$/mes</label><input name="precio" type="number" defaultValue={e.precio_mensual_usd} className="campo" /></div>
            <div><label className="etiqueta">Color</label><input type="color" name="color" defaultValue={e.color_primario} className="h-9 w-20 rounded border border-slate-300" /></div>
            <div><label className="etiqueta">Contacto</label><input name="contacto_nombre" defaultValue={e.contacto_nombre ?? ""} className="campo" /></div>
            <div><label className="etiqueta">Correo de contacto</label><input name="contacto_email" defaultValue={e.contacto_email ?? ""} className="campo" /></div>
            <div><label className="etiqueta">Teléfono</label><input name="contacto_telefono" defaultValue={e.contacto_telefono ?? ""} className="campo" /></div>
            <div><label className="etiqueta">Logo</label><input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="block w-full text-sm" /></div>
            <div className="sm:col-span-2"><button className="boton-primario">Guardar</button></div>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Registrar pago">
          <form action={pago} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div><label className="etiqueta">Fecha</label><input type="date" name="fecha" defaultValue={fechaRD()} className="campo" required /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="etiqueta">Monto</label><input name="monto" type="number" step="0.01" defaultValue={e.precio_mensual_usd} className="campo" required /></div>
              <div className="w-24"><label className="etiqueta">Moneda</label><select name="moneda" className="campo"><option>USD</option><option>DOP</option></select></div>
            </div>
            <div>
              <label className="etiqueta">Método</label>
              <select name="metodo" className="campo"><option>Transferencia</option><option>Depósito</option><option>Tarjeta</option><option>Efectivo</option><option>Otro</option></select>
            </div>
            <div><label className="etiqueta">Referencia</label><input name="referencia" className="campo" /></div>
            <div><label className="etiqueta">Cubre hasta</label><input type="date" name="periodo_hasta" defaultValue={siguiente} className="campo" required /></div>
            <div className="flex items-end"><button className="boton-primario">Registrar y activar</button></div>
          </form>
          {pagos && pagos.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
              {pagos.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>{formatoFecha(`${p.fecha}T12:00:00Z`)} · {p.metodo}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                  <span className="tabular-nums">{p.moneda} {Number(p.monto).toLocaleString("es-DO")} → {formatoFecha(`${p.periodo_hasta}T12:00:00Z`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo={`Usuarios (${miembros?.length ?? 0})`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {(miembros ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{m.nombre || m.email} {m.nombre && <span className="text-xs text-slate-500">{m.email}</span>} <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs">{m.rol}</span></span>
              <span className="flex items-center gap-3">
                <EnlaceAcceso email={m.email} accion={enlace} />
                <form action={quitarUsuario}><input type="hidden" name="id" value={id} /><input type="hidden" name="user_id" value={m.user_id} /><button className="text-xs text-red-700 hover:underline">Quitar</button></form>
              </span>
            </li>
          ))}
        </ul>
        <form action={agregarUsuario} className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_1fr_9rem_auto]">
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required placeholder="correo@empresa.com" className="campo" />
          <input name="nombre" placeholder="Nombre" className="campo" />
          <select name="rol" className="campo"><option value="admin">Administrador</option><option value="usuario">Usuario</option></select>
          <button className="boton-primario">Agregar</button>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Últimos resúmenes por correo">
        {envios?.length ? (
          <ul className="space-y-1 text-sm">
            {envios.map((x, i) => <li key={i}>{formatoFechaHora(x.enviado_en)} · {x.estado} · {x.nuevos} nuevos · {x.por_cerrar} por cerrar {x.detalle && <span className="text-xs text-red-700">{x.detalle}</span>}</li>)}
          </ul>
        ) : <p className="text-sm text-slate-500">Aún no se ha enviado ninguno. Destinatarios: {e.alertas_destinatarios.join(", ") || "ninguno"}.</p>}
      </Tarjeta>

      <Tarjeta titulo="Zona de peligro">
        <form action={eliminarEmpresa} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="confirmar" placeholder="Escribe ELIMINAR" className="campo w-48" />
          <button className="boton-peligro">Eliminar empresa y sus datos</button>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">Cancelar</Link>
        </form>
      </Tarjeta>
    </div>
  );
}
