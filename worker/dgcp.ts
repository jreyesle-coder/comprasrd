/**
 * Cliente de la API de Datos Abiertos de la DGCP.
 * - Cola estrictamente secuencial (nunca dos peticiones a la vez).
 * - Mínimo 1 s entre peticiones (máx. 60/min que exige la DGCP).
 * - Reintentos con backoff exponencial ante 429, 5xx o error de red.
 */

export interface RespuestaDgcp<T> {
  code: number;
  hasError: boolean;
  page?: number;
  pages?: number;
  limit?: number;
  totalResults?: number;
  payload: { content: T[] | null; message?: string; errors?: unknown };
}

export interface OpcionesCliente {
  base?: string;
  intervaloMs?: number;
  reintentos?: number;
  timeoutMs?: number;
  log?: (msg: string) => void;
}

const INTERVALO_MINIMO_MS = 1000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ClienteDgcp {
  readonly base: string;
  private readonly intervaloMs: number;
  private readonly reintentos: number;
  private readonly timeoutMs: number;
  private readonly log: (msg: string) => void;
  private cola: Promise<unknown> = Promise.resolve();
  private ultima = 0;
  /** Momento (ms) de cada petición enviada, para auditar el ritmo. */
  readonly marcas: number[] = [];

  constructor(op: OpcionesCliente = {}) {
    this.base = (op.base ?? "https://datosabiertos.dgcp.gob.do/api-dgcp/v1").replace(/\/$/, "");
    this.intervaloMs = Math.max(INTERVALO_MINIMO_MS, op.intervaloMs ?? 1100);
    this.reintentos = op.reintentos ?? 5;
    this.timeoutMs = op.timeoutMs ?? 120_000;
    this.log = op.log ?? (() => {});
  }

  get peticiones() {
    return this.marcas.length;
  }

  /** Mayor cantidad de peticiones dentro de cualquier ventana de 60 s. */
  get maxPorMinuto() {
    let max = 0;
    for (let i = 0, j = 0; j < this.marcas.length; j++) {
      while (this.marcas[j] - this.marcas[i] >= 60_000) i++;
      max = Math.max(max, j - i + 1);
    }
    return max;
  }

  get<T>(ruta: string, params: Record<string, string | number | undefined> = {}): Promise<RespuestaDgcp<T>> {
    const tarea = this.cola.then(() => this.ejecutar<T>(ruta, params));
    this.cola = tarea.catch(() => {});
    return tarea;
  }

  private async esperarTurno() {
    const falta = this.ultima + this.intervaloMs - Date.now();
    if (falta > 0) await espera(falta);
    this.ultima = Date.now();
    this.marcas.push(this.ultima);
  }

  private async ejecutar<T>(ruta: string, params: Record<string, string | number | undefined>): Promise<RespuestaDgcp<T>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    const url = `${this.base}${ruta}${qs.size ? `?${qs}` : ""}`;

    let ultimoError = "";
    for (let intento = 0; intento <= this.reintentos; intento++) {
      await this.esperarTurno();
      const t0 = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: { accept: "application/json" } });
        const ms = Date.now() - t0;
        if (res.ok) {
          const json = (await res.json()) as RespuestaDgcp<T>;
          // La API a veces responde 200 con code 503 dentro del cuerpo
          if (!json.hasError) {
            this.log(`GET ${ruta}?${qs} → ${res.status} (${ms} ms) #${this.peticiones}`);
            return json;
          }
          ultimoError = `${json.code} ${json.payload?.message ?? ""}`;
          if (json.code < 500 && json.code !== 429) throw new ErrorDgcp(url, ultimoError, false);
        } else {
          ultimoError = `HTTP ${res.status}`;
          if (res.status !== 429 && res.status < 500) throw new ErrorDgcp(url, ultimoError, false);
          const retryAfter = Number(res.headers.get("retry-after"));
          if (retryAfter > 0) await espera(retryAfter * 1000);
        }
      } catch (e) {
        if (e instanceof ErrorDgcp && !e.reintentable) throw e;
        if (!(e instanceof ErrorDgcp)) ultimoError = (e as Error).message;
      }
      if (intento < this.reintentos) {
        const pausa = 2000 * 2 ** intento;
        this.log(`  ↻ ${ultimoError} en ${ruta}; reintento ${intento + 1}/${this.reintentos} en ${pausa / 1000} s`);
        await espera(pausa);
      }
    }
    throw new ErrorDgcp(url, ultimoError, true);
  }
}

export class ErrorDgcp extends Error {
  constructor(
    readonly url: string,
    detalle: string,
    readonly reintentable: boolean,
  ) {
    super(`DGCP ${detalle} — ${url}`);
  }
}

// ───────────── Tipos de los campos reales (ver docs/campos-api.md) ─────────────

export interface ProcesoApi {
  codigo_proceso: string;
  codigo_unidad_compra: number;
  unidad_compra: string;
  modalidad: string;
  tipo_excepcion?: string;
  titulo: string;
  descripcion?: string;
  estado_proceso: string;
  divisa?: string;
  monto_estimado?: number;
  fecha_publicacion: string;
  fecha_fin_recepcion_ofertas?: string | null;
  fecha_apertura_ofertas?: string | null;
  dirigido_mipymes?: string;
  dirigido_mipymes_mujeres?: string;
  url?: string;
  objeto_proceso?: string;
  [k: string]: unknown;
}

export interface ArticuloApi {
  codigo_proceso: string;
  fecha_publicacion: string;
  familia_unspsc: string;
  clase_unspsc: string;
  subclase_unspsc: string;
  descripcion_articulo?: string;
  descripcion_usuario?: string;
  cantidad?: number;
  unidad_medida?: string;
  precio_unitario_estimado?: number;
  precio_total_estimado?: number;
  [k: string]: unknown;
}

export interface DocumentoApi {
  nombre_documento: string;
  codigo_proceso: string;
  tipo_documento?: string;
  fecha_carga_archivo?: string;
  url_documento: string;
}
