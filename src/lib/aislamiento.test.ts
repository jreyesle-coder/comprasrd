/**
 * Seguridad multiempresa: con RLS, un usuario solo ve los datos de su empresa
 * (coincidencias, seguimiento, reglas, miembros) y no puede escribir en otra.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { bdDePrueba } from "./__pruebas__/bd";

let db: PGlite;
const U1 = "00000000-0000-0000-0000-000000000001";
const U2 = "00000000-0000-0000-0000-000000000002";
let e1: string;
let e2: string;
let proceso: number;

/** Ejecuta como usuario autenticado (rol authenticated + auth.uid()). */
async function como<T>(uid: string, email: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('prueba.uid', '${uid}', false); select set_config('prueba.email', '${email}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = await bdDePrueba();
  await db.exec(`insert into auth.users values ('${U1}', 'a@uno.com'), ('${U2}', 'b@dos.com')`);
  e1 = (await db.query<{ id: string }>(`insert into empresas (nombre, slug, estado) values ('Uno', 'uno', 'activa') returning id`)).rows[0].id;
  e2 = (await db.query<{ id: string }>(`insert into empresas (nombre, slug, estado) values ('Dos', 'dos', 'activa') returning id`)).rows[0].id;
  await db.query(`insert into miembros (user_id, empresa_id, email, rol) values ($1, $2, 'a@uno.com', 'admin'), ($3, $4, 'b@dos.com', 'usuario')`, [U1, e1, U2, e2]);
  proceso = (await db.query<{ id: number }>(`insert into procesos (codigo_proceso, titulo, fecha_publicacion) values ('X-1', 'Compra', now()) returning id`)).rows[0].id;
  for (const e of [e1, e2]) {
    await db.query(`insert into coincidencias (empresa_id, proceso_id, grupo, grupos, subcategoria, subcategorias, motivo_match) values ($1, $2, 'G', '{G}', 'S', '{S}', 'keyword:x')`, [e, proceso]);
    await db.query(`insert into reglas (empresa_id, grupo, nombre, palabras) values ($1, 'G', 'S', '{x}')`, [e]);
  }
  await db.query(`insert into seguimiento (empresa_id, proceso_id, estado_interno, nota) values ($1, $2, 'interesa', 'nota secreta de Dos')`, [e2, proceso]);
}, 120_000);

describe("aislamiento entre empresas", () => {
  it("cada usuario ve solo las coincidencias de su empresa", async () => {
    const r = await como<{ empresa_id: string }>(U1, "a@uno.com", "select empresa_id from coincidencias");
    expect(r.map((x) => x.empresa_id)).toEqual([e1]);
  });

  it("no ve el seguimiento ni las notas de otra empresa", async () => {
    expect(await como(U1, "a@uno.com", "select * from seguimiento")).toEqual([]);
    const r = await como<{ nota: string }>(U2, "b@dos.com", "select nota from procesos_lista");
    expect(r[0].nota).toBe("nota secreta de Dos");
  });

  it("no puede escribir seguimiento en otra empresa", async () => {
    await expect(como(U1, "a@uno.com", `insert into seguimiento (empresa_id, proceso_id, estado_interno) values ($1, $2, 'ganado')`, [e2, proceso])).rejects.toThrow();
  });

  it("no ve reglas, miembros ni datos de otra empresa", async () => {
    expect((await como<{ empresa_id: string }>(U1, "a@uno.com", "select empresa_id from reglas")).map((x) => x.empresa_id)).toEqual([e1]);
    expect((await como<{ email: string }>(U1, "a@uno.com", "select email from miembros")).map((x) => x.email)).toEqual(["a@uno.com"]);
    expect((await como<{ nombre: string }>(U1, "a@uno.com", "select nombre from empresas")).map((x) => x.nombre)).toEqual(["Uno"]);
  });

  it("un usuario no administrador no puede cambiar reglas", async () => {
    await como(U2, "b@dos.com", "update reglas set nombre = 'hackeado'");
    const r = await db.query<{ nombre: string }>("select nombre from reglas where empresa_id = $1", [e2]);
    expect(r.rows[0].nombre).toBe("S");
  });

  it("empresa vencida deja de ver su radar", async () => {
    await db.query(`update empresas set vence_en = current_date - 1 where id = $1`, [e1]);
    expect(await como(U1, "a@uno.com", "select * from coincidencias")).toEqual([]);
    await db.query(`update empresas set vence_en = null where id = $1`, [e1]);
  });

  it("solo el servidor puede clasificar", async () => {
    await expect(como(U1, "a@uno.com", `select clasificar_procesos($1, now())`, [e1])).rejects.toThrow();
  });
});
