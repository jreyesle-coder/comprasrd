import {
  EXCLUSIONES_PALABRAS,
  EXCLUSIONES_UNSPSC,
  SUBCATEGORIAS,
  type Categoria,
  type Subcategoria,
} from "../../config/categorias";

export interface ArticuloEntrada {
  subclase_unspsc?: string | null;
  precio_total_estimado?: number | null;
}

export interface ProcesoEntrada {
  titulo?: string | null;
  descripcion?: string | null;
}

export interface Clasificacion {
  relevante: boolean;
  categoria: Categoria | "ambas" | null;
  subcategoria: string | null;
  subcategorias: string[];
  motivos: string[];
  /** Una línea legible: "unspsc:81112501; keyword:licencia" */
  motivo_match: string | null;
}

/** minúsculas, sin acentos, solo letras/números separados por un espacio. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Palabra o frase completa, admitiendo plural -s/-es en la última palabra. */
function compilarFrase(frase: string): RegExp {
  return new RegExp(`(?:^| )${escapar(normalizar(frase))}(?:s|es)?(?= |$)`);
}

const limpiarPrefijo = (codigo: string) => codigo.replace(/(00)+$/, "");

interface ReglaCompilada {
  sub: Subcategoria;
  prefijos: string[];
  frases: { texto: string; re: RegExp }[];
}

function compilar(subcategorias: Subcategoria[]): ReglaCompilada[] {
  return subcategorias.map((sub) => ({
    sub,
    prefijos: sub.unspsc.map(limpiarPrefijo),
    frases: sub.palabras.map((p) => ({ texto: p, re: compilarFrase(p) })),
  }));
}

const REGLAS = compilar(SUBCATEGORIAS);
const EXCL_UNSPSC = EXCLUSIONES_UNSPSC.map(limpiarPrefijo);
const EXCL_FRASES = EXCLUSIONES_PALABRAS.map(compilarFrase);

/** Subcategoría cuyo prefijo UNSPSC es el más largo que coincide con el código, o null. */
export function subcategoriaPorUnspsc(codigo: string | null | undefined, reglas = REGLAS): Subcategoria | null {
  if (!codigo) return null;
  if (EXCL_UNSPSC.some((p) => codigo.startsWith(p))) return null;
  let mejor: { sub: Subcategoria; largo: number } | null = null;
  for (const r of reglas) {
    for (const p of r.prefijos) {
      if (codigo.startsWith(p) && (!mejor || p.length > mejor.largo)) mejor = { sub: r.sub, largo: p.length };
    }
  }
  return mejor?.sub ?? null;
}

export function clasificar(proceso: ProcesoEntrada, articulos: ArticuloEntrada[] = []): Clasificacion {
  const motivos: string[] = [];
  // peso por subcategoría para elegir la principal (monto de artículos; palabras clave pesan poco)
  const peso = new Map<string, { sub: Subcategoria; peso: number }>();
  const sumar = (sub: Subcategoria, p: number) => {
    const actual = peso.get(sub.nombre);
    peso.set(sub.nombre, { sub, peso: (actual?.peso ?? 0) + p });
  };

  let porUnspsc = false;
  const codigosVistos = new Set<string>();
  for (const a of articulos) {
    const sub = subcategoriaPorUnspsc(a.subclase_unspsc);
    if (!sub) continue;
    porUnspsc = true;
    sumar(sub, 1 + Math.max(0, Number(a.precio_total_estimado) || 0));
    if (a.subclase_unspsc && !codigosVistos.has(a.subclase_unspsc)) {
      codigosVistos.add(a.subclase_unspsc);
      motivos.push(`unspsc:${a.subclase_unspsc}`);
    }
  }

  const texto = normalizar(`${proceso.titulo ?? ""} ${proceso.descripcion ?? ""}`);
  const excluido = EXCL_FRASES.some((re) => re.test(texto));
  if (!excluido || porUnspsc) {
    for (const r of REGLAS) {
      for (const f of r.frases) {
        if (f.re.test(texto)) {
          sumar(r.sub, 0.5);
          motivos.push(`keyword:${f.texto}`);
          break; // una palabra por subcategoría basta
        }
      }
    }
  }

  if (peso.size === 0) {
    return { relevante: false, categoria: null, subcategoria: null, subcategorias: [], motivos: [], motivo_match: null };
  }

  const orden = [...peso.values()].sort((a, b) => b.peso - a.peso);
  const cats = new Set(orden.map((o) => o.sub.categoria));
  return {
    relevante: true,
    categoria: cats.size > 1 ? "ambas" : orden[0].sub.categoria,
    subcategoria: orden[0].sub.nombre,
    subcategorias: orden.map((o) => o.sub.nombre),
    motivos,
    motivo_match: motivos.join("; "),
  };
}
