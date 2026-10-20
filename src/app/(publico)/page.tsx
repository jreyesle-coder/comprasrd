import type { Metadata } from "next";
import Link from "next/link";
import { solicitarDemo } from "./acciones";
import { PiePublico } from "./pie";

export const metadata: Metadata = {
  title: "Radar de Compras Públicas RD — oportunidades del Estado en tus rubros",
};

const FUNCIONES = [
  ["Solo lo tuyo", "Clasificamos cada proceso por los códigos oficiales UNSPSC de lo que se compra y por palabras clave. Ves solo tus rubros: A/A, software, cámaras, limpieza…"],
  ["Cada mañana en tu correo", "Un resumen a las 8:00 a. m. con lo nuevo y lo que cierra esta semana, con tu logo. Sin entrar al portal."],
  ["Fechas que no se te pasan", "Días restantes para el cierre en rojo y ámbar. Filtros por institución, monto, modalidad y MIPYME."],
  ["Pipeline comercial", "Marca lo que te interesa, prepárate y registra lo ofertado, ganado y perdido. Todo el equipo en la misma página."],
  ["Inteligencia de competencia", "Quién gana en tus rubros, en qué instituciones y a qué precio comparado con el estimado."],
  ["Exporta a Excel", "Lleva cualquier listado filtrado a Excel para tus reuniones o tu CRM."],
];

const PREGUNTAS = [
  ["¿De dónde salen los datos?", "De la API oficial de Datos Abiertos de la Dirección General de Contrataciones Públicas (DGCP). No usamos robots sobre el portal: respetamos las condiciones de uso de la DGCP."],
  ["¿Cada cuánto se actualiza?", "Cuatro veces al día, 30 minutos después de cada actualización de la DGCP (00:00, 07:00, 14:00 y 21:00)."],
  ["¿Puedo ajustar mis rubros?", "Sí. Desde Configuración agregas o quitas códigos del catálogo oficial y palabras clave, y ves al momento cuántos procesos entran."],
  ["¿Cuántos usuarios incluye?", "Todo tu equipo, sin costo adicional por usuario."],
  ["¿Hay contrato de permanencia?", "No. Es mensual; puedes cancelar cuando quieras."],
];

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const { demo } = await searchParams;
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white" style={{ ["--marca" as string]: "#1d4ed8" }}>
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-marca text-sm font-bold text-white">RC</span>
            Radar de Compras Públicas
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#precio" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Precio</a>
            <a href="#demo" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Demostración</a>
            <Link href="/login" className="boton-secundario">Entrar</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-marca">Compras públicas · República Dominicana</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              Cada oportunidad del Estado en tus rubros, antes que tu competencia.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              El Estado publica más de 7,000 procesos de compra al mes. El Radar los lee por ti, se queda con los que te interesan y te los
              manda cada mañana con la fecha de cierre y el monto estimado.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demo" className="boton-primario px-5 py-2.5 text-base">Solicitar demostración</a>
              <a href="#como" className="boton-secundario px-5 py-2.5 text-base">Cómo funciona</a>
            </div>
            <p className="mt-3 text-sm text-slate-500">14 días de prueba · sin tarjeta</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="text-xs font-semibold text-slate-500">Hoy en tu radar</div>
            {[
              ["Mantenimiento de aires acondicionados — Hospital Regional", "RD$ 1,724,030", "6 días", "bg-slate-100 text-slate-700"],
              ["Renovación de licencias de software — Ministerio", "RD$ 33,600,000", "3 días", "bg-red-100 text-red-800"],
              ["Instalación de cámaras de seguridad — Dirección General", "RD$ 845,000", "5 días", "bg-amber-100 text-amber-800"],
            ].map(([t, m, d, c]) => (
              <div key={t} className="mt-3 rounded-lg border border-slate-100 p-3">
                <div className="text-sm font-medium text-slate-900">{t}</div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="font-semibold tabular-nums">{m}</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${c}`}>{d}</span>
                </div>
              </div>
            ))}
            <p className="mt-3 text-[11px] text-slate-400">Ejemplo ilustrativo.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-slate-900">Todo lo que necesitas para vender al Estado</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map(([t, d]) => (
            <div key={t} className="rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">{t}</h3>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="como" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-slate-900">Cómo funciona</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["Nos dices tus rubros", "Partimos de plantillas (tecnología, mantenimiento, A/A, electricidad, limpieza, seguridad…) y las ajustamos a lo que vendes."],
              ["El radar trabaja solo", "Cuatro veces al día revisa todo lo que publica el Estado y clasifica cada proceso."],
              ["Tú ofertas", "Recibes el resumen, revisas pliegos y documentos, y das seguimiento con tu equipo."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-lg bg-white p-5 shadow-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-marca font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="precio" className="mx-auto max-w-6xl px-4 py-14">
        <div className="mx-auto max-w-md rounded-xl border-2 border-marca p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Plan Empresa</h2>
          <p className="mt-2"><span className="text-4xl font-bold text-slate-900">US$ 100</span><span className="text-slate-500"> / mes</span></p>
          <ul className="mt-5 space-y-2 text-left text-sm text-slate-700">
            {["Usuarios ilimitados de tu empresa", "Rubros a tu medida", "Resumen diario por correo con tu logo", "Pipeline comercial y competencia", "Exportación a Excel", "Soporte por WhatsApp y correo"].map((x) => (
              <li key={x} className="flex gap-2"><span className="text-emerald-600">✓</span>{x}</li>
            ))}
          </ul>
          <a href="#demo" className="boton-primario mt-6 w-full py-2.5">Empezar prueba de 14 días</a>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-bold text-slate-900">Preguntas frecuentes</h2>
          <div className="mt-6 divide-y divide-slate-200">
            {PREGUNTAS.map(([p, r]) => (
              <details key={p} className="py-3">
                <summary className="cursor-pointer font-medium text-slate-900">{p}</summary>
                <p className="mt-2 text-sm text-slate-600">{r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="mx-auto w-full max-w-2xl px-4 py-14">
        <h2 className="text-2xl font-bold text-slate-900">Solicita una demostración</h2>
        <p className="mt-2 text-slate-600">Te mostramos el radar con tus rubros reales y activamos tu prueba de 14 días.</p>
        {demo === "ok" ? (
          <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-emerald-800">¡Gracias! Te contactaremos en menos de un día laborable.</p>
        ) : (
          <form action={solicitarDemo} className="mt-6 grid gap-3 sm:grid-cols-2">
            {demo === "error" && <p className="rounded bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">Revisa los datos: nombre, empresa y un correo válido son obligatorios.</p>}
            <input type="text" name="sitio" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <div><label className="etiqueta" htmlFor="d-nombre">Nombre</label><input id="d-nombre" name="nombre" required className="campo" /></div>
            <div><label className="etiqueta" htmlFor="d-empresa">Empresa</label><input id="d-empresa" name="empresa" required className="campo" /></div>
            <div><label className="etiqueta" htmlFor="d-email">Correo</label><input id="d-email" name="email" type="email" required className="campo" /></div>
            <div><label className="etiqueta" htmlFor="d-tel">WhatsApp / teléfono</label><input id="d-tel" name="telefono" className="campo" /></div>
            <div className="sm:col-span-2"><label className="etiqueta" htmlFor="d-rubros">¿Qué vendes al Estado?</label><input id="d-rubros" name="rubros" placeholder="Ej.: aires acondicionados, mantenimiento eléctrico, cámaras" className="campo" /></div>
            <div className="sm:col-span-2"><label className="etiqueta" htmlFor="d-msg">Comentario (opcional)</label><textarea id="d-msg" name="mensaje" rows={3} className="campo" /></div>
            <div className="sm:col-span-2">
              <button className="boton-primario px-5 py-2.5">Enviar solicitud</button>
              <p className="mt-2 text-xs text-slate-500">Al enviar aceptas que te contactemos sobre el servicio. Ver <Link href="/privacidad" className="underline">privacidad</Link>.</p>
            </div>
          </form>
        )}
      </section>

      <PiePublico />
    </div>
  );
}
