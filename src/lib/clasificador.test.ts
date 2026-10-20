import { describe, expect, it } from "vitest";
import { normalizar } from "./clasificador";
import { normalizarCodigos, normalizarPalabras } from "./plantillas";

describe("normalizar", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(normalizar("ADQUISICIÓN de Cámaras, CCTV y A/A")).toBe("adquisicion de camaras cctv y a a");
    expect(normalizar("Diseño")).toBe("diseno");
  });

  it("palabras y códigos de reglas", () => {
    expect(normalizarPalabras(["Aire Acondicionado", "aire acondicionado", "x"])).toEqual(["aire acondicionado"]);
    expect(normalizarCodigos(["43230000", "8111", "81112500", "abc"])).toEqual(["4323", "8111", "811125"]);
  });
});
