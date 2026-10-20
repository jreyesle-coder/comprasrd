import type { Metadata } from "next";
import { PLANTILLAS } from "@/lib/plantillas";
import { Aviso, Tarjeta } from "@/componentes/comunes";
import { nuevaEmpresa } from "../../acciones";

export const metadata: Metadata = { title: "Nueva empresa" };

export default async function NuevaEmpresa({ searchParams }: PageProps<"/admin/empresas/nueva">) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">Nueva empresa cliente</h1>
      {error && <Aviso tipo="error">{String(error)}</Aviso>}
      <Tarjeta>
        <form action={nuevaEmpresa} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="nombre">Nombre de la empresa</label>
            <input id="nombre" name="nombre" required className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="slug">Identificador corto (opcional)</label>
            <input id="slug" name="slug" pattern="[a-z0-9-]{2,40}" placeholder="se genera del nombre" className="campo font-mono" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="color">Color</label>
            <input id="color" name="color" type="color" defaultValue="#1d4ed8" className="h-9 w-20 rounded border border-slate-300" />
          </div>
          <div className="sm:col-span-2">
            <span className="etiqueta">Rubros iniciales (plantillas)</span>
            <div className="flex flex-wrap gap-4 text-sm">
              {PLANTILLAS.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input type="checkbox" name="plantillas" value={p.id} defaultChecked className="h-4 w-4" /> {p.nombre}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">El cliente puede ajustarlos después en Configuración → Rubros.</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="estado">Estado inicial</label>
            <select id="estado" name="estado" className="campo">
              <option value="prueba">Prueba</option>
              <option value="activa">Activa (ya pagó)</option>
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="dias">Días de acceso inicial</label>
            <input id="dias" name="dias" type="number" min={1} defaultValue={14} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="precio">Precio mensual (US$)</label>
            <input id="precio" name="precio" type="number" min={0} defaultValue={100} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="logo">Logo (opcional)</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="block w-full text-sm" />
          </div>
          <div className="sm:col-span-2 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800">Administrador del cliente</div>
          <div>
            <label className="etiqueta" htmlFor="contacto_nombre">Nombre</label>
            <input id="contacto_nombre" name="contacto_nombre" className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="contacto_email">Correo (será administrador)</label>
            <input id="contacto_email" name="contacto_email" type="email" className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="contacto_telefono">Teléfono</label>
            <input id="contacto_telefono" name="contacto_telefono" className="campo" />
          </div>
          <div className="sm:col-span-2">
            <button className="boton-primario">Crear empresa</button>
            <span className="ml-3 text-xs text-slate-500">Se cargan sus rubros y se calcula su radar de los últimos 120 días.</span>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}
