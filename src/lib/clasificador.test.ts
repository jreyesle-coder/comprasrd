import { describe, expect, it } from "vitest";
import { clasificar, normalizar, subcategoriaPorUnspsc } from "./clasificador";

describe("normalizar", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(normalizar("ADQUISICIÓN de Cámaras, CCTV y A/A")).toBe("adquisicion de camaras cctv y a a");
  });
});

describe("UNSPSC", () => {
  it("licencias de software (811125) → Software y licencias", () => {
    const r = clasificar({ titulo: "Renovación Autodesk" }, [{ subclase_unspsc: "81112501", precio_total_estimado: 100 }]);
    expect(r.relevante).toBe(true);
    expect(r.categoria).toBe("tecnologia");
    expect(r.subcategoria).toBe("Software y licencias");
    expect(r.motivo_match).toContain("unspsc:81112501");
  });

  it("gana el prefijo más largo (811125 sobre 8111)", () => {
    expect(subcategoriaPorUnspsc("81112501")?.nombre).toBe("Software y licencias");
    expect(subcategoriaPorUnspsc("81111508")?.nombre).toBe("Desarrollo y servicios de TI");
  });

  it("aires acondicionados (4010) → Climatización", () => {
    const r = clasificar({ titulo: "Compra de equipos" }, [{ subclase_unspsc: "40101701" }]);
    expect(r.categoria).toBe("servicios_generales");
    expect(r.subcategoria).toBe("Climatización (HVAC)");
  });

  it("construcción de obra (7213) no entra", () => {
    expect(clasificar({ titulo: "Obra" }, [{ subclase_unspsc: "72131601" }]).relevante).toBe(false);
  });

  it("exclusiones UNSPSC: baterías y lavado de vehículos", () => {
    expect(subcategoriaPorUnspsc("26111703")).toBeNull();
    expect(subcategoriaPorUnspsc("76111801")).toBeNull();
    expect(subcategoriaPorUnspsc("26111701")?.nombre).toBe("Plantas eléctricas y generadores");
  });

  it("artículos de ambas categorías → ambas, principal la de mayor monto", () => {
    const r = clasificar({ titulo: "Compras varias" }, [
      { subclase_unspsc: "43211507", precio_total_estimado: 50_000 },
      { subclase_unspsc: "72102401", precio_total_estimado: 900_000 },
    ]);
    expect(r.categoria).toBe("ambas");
    expect(r.subcategoria).toBe("Pintura");
    expect(r.subcategorias).toEqual(["Pintura", "Equipos de cómputo"]);
  });
});

describe("palabras clave", () => {
  it("encuentra con y sin acentos y en plural", () => {
    expect(clasificar({ titulo: "ADQUISICIÓN DE COMPUTADORAS" }).subcategoria).toBe("Equipos de cómputo");
    expect(clasificar({ titulo: "Servicio de fumigacion" }).subcategoria).toBe("Fumigación y control de plagas");
    expect(clasificar({ titulo: "Servicio de fumigación" }).motivo_match).toBe("keyword:fumigacion");
  });

  it("A/A y aire acondicionado", () => {
    expect(clasificar({ titulo: "Mantenimiento de A/A del edificio" }).subcategorias).toContain("Climatización (HVAC)");
    expect(clasificar({ titulo: "Compra de aires acondicionados" }).subcategoria).toBe("Climatización (HVAC)");
  });

  it("solo palabra completa: 'red' o 'app' dentro de otra palabra no cuenta", () => {
    expect(clasificar({ titulo: "Adquisición de manzanas y aplicadores" }).relevante).toBe(false);
    expect(clasificar({ titulo: "Desarrollo de una app institucional" }).subcategoria).toBe("Desarrollo y servicios de TI");
  });

  it("busca también en la descripción", () => {
    expect(clasificar({ titulo: "Proceso 15", descripcion: "Contratación de servicio de CCTV" }).subcategoria).toBe(
      "CCTV y control de acceso",
    );
  });

  it("procesos ajenos no entran", () => {
    expect(clasificar({ titulo: "Adquisición de camisetas personalizadas" }).relevante).toBe(false);
  });
});

describe("exclusiones por palabra", () => {
  it("mantenimiento de vehículos se descarta si solo entró por palabra", () => {
    expect(clasificar({ titulo: "Mantenimiento de vehículos de la institución" }).relevante).toBe(false);
    expect(clasificar({ titulo: "Compra de neumáticos y reparación" }).relevante).toBe(false);
  });

  it("compra de combustible para planta eléctrica no entra", () => {
    expect(clasificar({ titulo: "COMPRA DE DIESEL PARA PLANTA ELECTRICA" }).relevante).toBe(false);
    expect(clasificar({ titulo: "Suministro de gasoil para la planta eléctrica" }).relevante).toBe(false);
    expect(clasificar({ titulo: "Generador eléctrico diésel 60 kW" }, [{ subclase_unspsc: "26111601" }]).relevante).toBe(true);
  });

  it("'servidores públicos' no cuenta como servidor informático", () => {
    expect(clasificar({ titulo: "Capacitación para servidores públicos" }).relevante).toBe(false);
  });

  it("se mantiene si además tiene un código UNSPSC relevante", () => {
    const r = clasificar({ titulo: "Mantenimiento de vehículos y aires acondicionados" }, [{ subclase_unspsc: "40101701" }]);
    expect(r.relevante).toBe(true);
    expect(r.motivos).toContain("unspsc:40101701");
  });
});
