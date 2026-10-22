/**
 * Plantillas de rubros para empresas nuevas, a partir de config/categorias.ts.
 * Las reglas se guardan normalizadas (palabras sin acentos, códigos sin ceros finales),
 * que es lo que espera la función SQL clasificar_procesos.
 */
import {
  CATEGORIA_ETIQUETA,
  EXCLUSIONES_PALABRAS,
  EXCLUSIONES_UNSPSC,
  SUBCATEGORIAS,
  type Categoria,
} from "../../config/categorias";
import { normalizar } from "./clasificador";

export interface ReglaPlantilla {
  grupo: string;
  nombre: string;
  unspsc: string[];
  palabras: string[];
  orden: number;
}

export const limpiarCodigo = (c: string) => c.replace(/\D/g, "").replace(/(00)+$/, "");

export function normalizarPalabras(lista: string[]): string[] {
  return [...new Set(lista.map(normalizar).filter((p) => p.length >= 2))];
}

export function normalizarCodigos(lista: string[]): string[] {
  return [...new Set(lista.map(limpiarCodigo).filter((c) => c.length >= 2 && c.length <= 8))];
}

export const PLANTILLAS: { id: Categoria; nombre: string }[] = [
  { id: "tecnologia", nombre: CATEGORIA_ETIQUETA.tecnologia },
  { id: "servicios_generales", nombre: CATEGORIA_ETIQUETA.servicios_generales },
  { id: "construccion", nombre: CATEGORIA_ETIQUETA.construccion },
];

export function reglasDePlantillas(ids: Categoria[]): ReglaPlantilla[] {
  return SUBCATEGORIAS.filter((s) => ids.includes(s.categoria)).map((s, i) => ({
    grupo: CATEGORIA_ETIQUETA[s.categoria],
    nombre: s.nombre,
    unspsc: normalizarCodigos(s.unspsc),
    palabras: normalizarPalabras(s.palabras),
    orden: i,
  }));
}

export const EXCLUSIONES_POR_DEFECTO = {
  exclusiones_unspsc: normalizarCodigos(EXCLUSIONES_UNSPSC),
  exclusiones_palabras: normalizarPalabras(EXCLUSIONES_PALABRAS),
};
