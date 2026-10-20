import { requerirEmpresa } from "@/lib/sesion";

/** Todas las pantallas de la app: exigen empresa habilitada y aplican su color de marca. */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const s = await requerirEmpresa();
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ ["--marca" as string]: s.empresa.color_primario }}>
      {children}
    </div>
  );
}
