import type { Metadata } from "next";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { requerirAdminEmpresa } from "@/lib/sesion";
import { Aviso, Encabezado, Tarjeta } from "@/componentes/comunes";
import { eliminarRegla, guardarExclusiones, guardarRegla } from "./acciones";
import { BuscadorUnspsc, VistaPrevia } from "./herramientas";

export const metadata: Metadata = { title: "Rubros" };

type Regla = Awaited<ReturnType<typeof repo.reglas>>[number];

function FormRegla({ r, grupos }: { r?: Regla; grupos: string[] }) {
  const k = r?.id ?? "nueva";
  return (
    <form action={guardarRegla} className="space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor={`grupo-${k}`}>Categoría</label>
          <input id={`grupo-${k}`} name="grupo" list="grupos" defaultValue={r?.grupo ?? grupos[0] ?? ""} className="campo" required />
        </div>
        <div>
          <label className="etiqueta" htmlFor={`nombre-${k}`}>Subcategoría</label>
          <input id={`nombre-${k}`} name="nombre" defaultValue={r?.nombre} className="campo" required placeholder="Ej.: Climatización (HVAC)" />
        </div>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`unspsc-${k}`}>Códigos UNSPSC (separados por coma)</label>
        <input id={`unspsc-${k}`} name="unspsc" defaultValue={r?.unspsc.join(", ")} className="campo font-mono" placeholder="Ej.: 4010, 721023" />
        <div className="mt-2"><BuscadorUnspsc campoId={`unspsc-${k}`} /></div>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`palabras-${k}`}>Palabras clave en el título (una por línea; sin importar acentos ni plural)</label>
        <textarea id={`palabras-${k}`} name="palabras" rows={4} defaultValue={r?.palabras.join("\n")} className="campo" placeholder={"aire acondicionado\nclimatizacion"} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="activa" value="1" defaultChecked={r?.activa ?? true} className="h-4 w-4" /> Activa
        </label>
        <button className="boton-primario">{r ? "Guardar" : "Crear subcategoría"}</button>
        <VistaPrevia unspscId={`unspsc-${k}`} palabrasId={`palabras-${k}`} />
      </div>
    </form>
  );
}

export default async function Rubros({ searchParams }: PageProps<"/configuracion/rubros">) {
  const s = await requerirAdminEmpresa();
  const { ok, error } = await searchParams;
  const reglas = await repo.reglas(s.empresa.id);
  const grupos = [...new Set(reglas.map((r) => r.grupo))];

  return (
    <>
      <Encabezado sesion={s} activo="/configuracion" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">
        <Link href="/configuracion" className="text-sm text-marca hover:underline">← Configuración</Link>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Rubros que vigila tu radar</h1>
          <p className="mt-1 text-sm text-slate-600">
            Un proceso entra si alguno de sus artículos tiene un código UNSPSC de la lista (lo más confiable) o si su título
            contiene una palabra clave. Al guardar, el radar se vuelve a calcular con los procesos de los últimos 120 días.
          </p>
        </div>
        {ok && <Aviso>{String(ok)}</Aviso>}
        {error && <Aviso tipo="error">{String(error)}</Aviso>}
        <datalist id="grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>

        {grupos.map((g) => (
          <Tarjeta key={g} titulo={g}>
            <ul className="divide-y divide-slate-100">
              {reglas.filter((r) => r.grupo === g).map((r) => (
                <li key={r.id}>
                  <details className="group py-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${r.activa ? "text-slate-900" : "text-slate-400 line-through"}`}>{r.nombre}</span>
                      <span className="text-xs text-slate-500">
                        {r.unspsc.length} códigos · {r.palabras.length} palabras <span className="ml-1 text-slate-400 group-open:rotate-180">▾</span>
                      </span>
                    </summary>
                    <div className="mt-3 rounded-md border border-slate-100 p-3">
                      <FormRegla r={r} grupos={grupos} />
                      <form action={eliminarRegla} className="mt-3 border-t border-slate-100 pt-3">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="text-xs text-red-700 hover:underline">Eliminar esta subcategoría</button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ))}

        <Tarjeta titulo="Agregar subcategoría">
          <FormRegla grupos={grupos} />
        </Tarjeta>

        <Tarjeta titulo="Exclusiones">
          <form action={guardarExclusiones} className="space-y-3">
            <p className="text-sm text-slate-600">
              Las <b>palabras</b> descartan un proceso que entró solo por palabra clave (ej. &quot;vehículo&quot;, &quot;combustible&quot;). Los{" "}
              <b>códigos</b> nunca cuentan, aunque estén dentro de un rubro.
            </p>
            <div>
              <label className="etiqueta" htmlFor="excl-palabras">Palabras que descartan (una por línea)</label>
              <textarea id="excl-palabras" name="palabras" rows={5} defaultValue={s.empresa.exclusiones_palabras.join("\n")} className="campo" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="excl-unspsc">Códigos UNSPSC excluidos</label>
              <input id="excl-unspsc" name="unspsc" defaultValue={s.empresa.exclusiones_unspsc.join(", ")} className="campo font-mono" />
            </div>
            <button className="boton-primario">Guardar exclusiones</button>
          </form>
        </Tarjeta>
      </main>
    </>
  );
}
