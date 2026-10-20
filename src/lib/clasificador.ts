/**
 * Normalización de texto compartida por el sincronizador, la app y las reglas.
 * La clasificación en sí vive en la base de datos (función SQL clasificar_procesos,
 * supabase/migraciones/002_multiempresa.sql) y se prueba en clasificacion.test.ts.
 */

/** minúsculas, sin acentos, solo letras/números separados por un espacio. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
