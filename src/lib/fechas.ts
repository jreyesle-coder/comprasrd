/** República Dominicana es UTC-4 todo el año (sin horario de verano). */
export const ZONA_RD = "America/Santo_Domingo";
const OFFSET_RD_MS = -4 * 60 * 60 * 1000;

/** Fecha calendario en RD ("YYYY-MM-DD") de un instante. */
export function fechaRD(d: Date = new Date()): string {
  return new Date(d.getTime() + OFFSET_RD_MS).toISOString().slice(0, 10);
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Instante en que empieza el día "YYYY-MM-DD" en RD. */
export function inicioDiaRD(fecha: string): Date {
  return new Date(`${fecha}T04:00:00Z`);
}

/** Días calendario (RD) entre hoy y la fecha dada; negativo si ya pasó. */
export function diasRestantes(iso: string | null | undefined, ahora: Date = new Date()): number | null {
  if (!iso) return null;
  const hoy = inicioDiaRD(fechaRD(ahora)).getTime();
  const dia = inicioDiaRD(fechaRD(new Date(iso))).getTime();
  return Math.round((dia - hoy) / 86_400_000);
}

export function formatoFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: ZONA_RD, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-DO", { timeZone: ZONA_RD, day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}
