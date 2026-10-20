/**
 * Pruebas de la clasificación por empresa (función SQL clasificar_procesos)
 * sobre un Postgres en memoria con las migraciones reales.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizar } from "./clasificador";
import { EXCLUSIONES_POR_DEFECTO, reglasDePlantillas } from "./plantillas";
import { bdDePrueba } from "./__pruebas__/bd";

let db: PGlite;
let empresaTI: string;
let empresaAA: string;
let sec = 0;

async function crearEmpresa(slug: string, plantillas: ("tecnologia" | "servicios_generales")[]) {
  const { rows } = await db.query<{ id: string }>(
    `insert into empresas (nombre, slug, estado, exclusiones_unspsc, exclusiones_palabras)
     values ($1, $1, 'activa', $2, $3) returning id`,
    [slug, EXCLUSIONES_POR_DEFECTO.exclusiones_unspsc, EXCLUSIONES_POR_DEFECTO.exclusiones_palabras],
  );
  for (const r of reglasDePlantillas(plantillas)) {
    await db.query(`insert into reglas (empresa_id, grupo, nombre, unspsc, palabras, orden) values ($1,$2,$3,$4,$5,$6)`, [
      rows[0].id, r.grupo, r.nombre, r.unspsc, r.palabras, r.orden,
    ]);
  }
  return rows[0].id;
}

/** Inserta un proceso con sus artículos, lo clasifica para la empresa y devuelve la coincidencia (o null). */
async function clasificar(empresa: string, titulo: string, articulos: { unspsc: string; monto?: number }[] = []) {
  sec++;
  const { rows } = await db.query<{ id: number }>(
    `insert into procesos (codigo_proceso, titulo, fecha_publicacion, texto_clasif) values ($1, $2, now(), $3) returning id`,
    [`P-${sec}`, titulo, normalizar(titulo)],
  );
  const id = rows[0].id;
  for (const a of articulos) {
    await db.query(`insert into proceso_articulos (proceso_id, codigo_unspsc, precio_total) values ($1, $2, $3)`, [id, a.unspsc, a.monto ?? 0]);
  }
  await db.query(`select clasificar_procesos($1, now() - interval '1 day', $2)`, [empresa, [id]]);
  const r = await db.query<{ grupo: string; grupos: string[]; subcategoria: string; subcategorias: string[]; motivo_match: string }>(
    `select grupo, grupos, subcategoria, subcategorias, motivo_match from coincidencias where empresa_id = $1 and proceso_id = $2`,
    [empresa, id],
  );
  return r.rows[0] ?? null;
}

beforeAll(async () => {
  db = await bdDePrueba();
  empresaTI = await crearEmpresa("solo-ti", ["tecnologia"]);
  empresaAA = await crearEmpresa("ti-y-servicios", ["tecnologia", "servicios_generales"]);
}, 120_000);

describe("UNSPSC", () => {
  it("licencias de software → Software y licencias", async () => {
    const c = await clasificar(empresaAA, "Renovación Autodesk", [{ unspsc: "81112501", monto: 100 }]);
    expect(c?.grupo).toBe("Tecnología");
    expect(c?.subcategoria).toBe("Software y licencias");
    expect(c?.motivo_match).toContain("unspsc:81112501");
  });

  it("gana el prefijo más largo (811125 sobre 8111)", async () => {
    expect((await clasificar(empresaAA, "X", [{ unspsc: "81111508" }]))?.subcategoria).toBe("Desarrollo y servicios de TI");
  });

  it("aires acondicionados → Climatización", async () => {
    expect((await clasificar(empresaAA, "Compra de equipos", [{ unspsc: "40101701" }]))?.subcategoria).toBe("Climatización (HVAC)");
  });

  it("construcción de obra (7213) no entra", async () => {
    expect(await clasificar(empresaAA, "Obra", [{ unspsc: "72131601" }])).toBeNull();
  });

  it("exclusiones UNSPSC: baterías y lavado de vehículos", async () => {
    expect(await clasificar(empresaAA, "Compra", [{ unspsc: "26111703" }])).toBeNull();
    expect(await clasificar(empresaAA, "Servicio", [{ unspsc: "76111801" }])).toBeNull();
    expect((await clasificar(empresaAA, "Compra", [{ unspsc: "26111701" }]))?.subcategoria).toBe("Plantas eléctricas y generadores");
  });

  it("dos grupos → ambos, principal la de mayor monto", async () => {
    const c = await clasificar(empresaAA, "Compras varias", [
      { unspsc: "43211507", monto: 50_000 },
      { unspsc: "72102401", monto: 900_000 },
    ]);
    expect(c?.grupos.sort()).toEqual(["Servicios generales", "Tecnología"]);
    expect(c?.subcategoria).toBe("Pintura");
    expect(c?.subcategorias).toEqual(["Pintura", "Equipos de cómputo"]);
  });
});

describe("palabras clave", () => {
  it("con y sin acentos, en plural", async () => {
    expect((await clasificar(empresaAA, "ADQUISICIÓN DE COMPUTADORAS"))?.subcategoria).toBe("Equipos de cómputo");
    expect((await clasificar(empresaAA, "Servicio de fumigación"))?.motivo_match).toBe("keyword:fumigacion");
  });

  it("A/A y aire acondicionado", async () => {
    expect((await clasificar(empresaAA, "Mantenimiento de A/A del edificio"))?.subcategorias).toContain("Climatización (HVAC)");
    expect((await clasificar(empresaAA, "Compra de aires acondicionados"))?.subcategoria).toBe("Climatización (HVAC)");
  });

  it("solo palabra completa", async () => {
    expect(await clasificar(empresaAA, "Adquisición de manzanas y aplicadores")).toBeNull();
    expect((await clasificar(empresaAA, "Desarrollo de una app institucional"))?.subcategoria).toBe("Desarrollo y servicios de TI");
  });

  it("procesos ajenos no entran", async () => {
    expect(await clasificar(empresaAA, "Adquisición de camisetas personalizadas")).toBeNull();
  });
});

describe("exclusiones por palabra", () => {
  it("vehículos y combustible se descartan si solo entraron por palabra", async () => {
    expect(await clasificar(empresaAA, "Mantenimiento de vehículos de la institución")).toBeNull();
    expect(await clasificar(empresaAA, "COMPRA DE DIESEL PARA PLANTA ELECTRICA")).toBeNull();
    expect(await clasificar(empresaAA, "Capacitación para servidores públicos")).toBeNull();
  });

  it("se mantiene si además tiene un código UNSPSC relevante", async () => {
    const c = await clasificar(empresaAA, "Mantenimiento de vehículos y aires acondicionados", [{ unspsc: "40101701" }]);
    expect(c?.motivo_match).toContain("unspsc:40101701");
  });
});

describe("rubros por empresa", () => {
  it("una empresa solo de TI no ve aires acondicionados", async () => {
    expect(await clasificar(empresaTI, "Compra de aires acondicionados", [{ unspsc: "40101701" }])).toBeNull();
    expect((await clasificar(empresaTI, "Compra de laptops", [{ unspsc: "43211503" }]))?.subcategoria).toBe("Equipos de cómputo");
  });

  it("reclasificar quita coincidencias que ya no aplican", async () => {
    const c = await clasificar(empresaTI, "Licencias Microsoft Office 365");
    expect(c?.subcategoria).toBe("Software y licencias");
    await db.query(`update reglas set activa = false where empresa_id = $1 and nombre = 'Software y licencias'`, [empresaTI]);
    await db.query(`select clasificar_procesos($1, now() - interval '1 day')`, [empresaTI]);
    const r = await db.query(`select 1 from coincidencias c join procesos p on p.id = c.proceso_id where c.empresa_id = $1 and p.titulo like 'Licencias Microsoft%'`, [empresaTI]);
    expect(r.rows.length).toBe(0);
  });

  it("vista previa cuenta coincidencias", async () => {
    const r = await db.query<{ n: number }>(`select contar_coincidencias(array['4010'], array['aire acondicionado'], 30) as n`);
    expect(r.rows[0].n).toBeGreaterThanOrEqual(3);
  });
});
