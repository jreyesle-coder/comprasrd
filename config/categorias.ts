/**
 * Configuración de clasificación del Radar.
 * Editar este archivo para ajustar qué procesos entran; no hace falta tocar la lógica.
 *
 * - unspsc: prefijos de código UNSPSC (sin los ceros finales). "4323" = familia 43230000,
 *   "811125" = clase 81112500, "72102401" = subclase exacta. Gana el prefijo más largo.
 * - palabras: se buscan en título y descripción, sin mayúsculas ni acentos, por palabra completa
 *   (acepta plural en -s / -es). Ej.: "computadora" encuentra "COMPUTADORAS".
 * Códigos validados contra GET /catalogo el 2026-10-17 (ver docs/campos-api.md).
 */

export type Categoria = "tecnologia" | "servicios_generales" | "construccion";

export interface Subcategoria {
  categoria: Categoria;
  nombre: string;
  unspsc: string[];
  palabras: string[];
}

export const SUBCATEGORIAS: Subcategoria[] = [
  // ───────────── Tecnología ─────────────
  {
    categoria: "tecnologia",
    nombre: "Software y licencias",
    unspsc: ["4323", "811125", "811122"],
    palabras: [
      "software", "licencia", "licenciamiento", "microsoft", "office 365", "oracle", "sap",
      "erp", "suscripcion de software",
    ],
  },
  {
    categoria: "tecnologia",
    nombre: "Desarrollo y servicios de TI",
    unspsc: ["8111"],
    palabras: [
      "desarrollo de software", "desarrollo de sistema", "desarrollo de aplicacion", "sistema informatico",
      "plataforma digital", "plataforma tecnologica", "plataforma web", "aplicacion movil", "aplicacion web",
      "app", "portal web", "pagina web", "sitio web", "hosting", "nube", "cloud", "data center",
      "centro de datos", "servidor", "soporte tecnico", "mesa de ayuda", "tecnologia de la informacion",
      "tecnologias de la informacion", "tic", "digitalizacion", "servicios informaticos",
    ],
  },
  {
    categoria: "tecnologia",
    nombre: "Equipos de cómputo",
    unspsc: ["4320", "4321"],
    palabras: [
      "computadora", "computador", "laptop", "pc", "impresora", "escaner", "toner", "equipo informatico",
      "equipos informaticos", "equipos de computo", "tablet",
    ],
  },
  {
    categoria: "tecnologia",
    nombre: "Redes y telecomunicaciones",
    unspsc: ["4319", "4322", "8311"],
    palabras: [
      "red de datos", "redes de datos", "red informatica", "red inalambrica", "cableado estructurado",
      "switch", "router", "wifi", "wi fi", "fibra optica", "telecomunicacion", "internet", "radios de comunicacion",
      "central telefonica", "telefonia ip",
    ],
  },
  {
    categoria: "tecnologia",
    nombre: "Ciberseguridad",
    unspsc: [],
    palabras: ["ciberseguridad", "antivirus", "firewall", "seguridad informatica", "seguridad de la informacion"],
  },
  {
    categoria: "tecnologia",
    nombre: "CCTV y control de acceso",
    unspsc: ["4617"],
    palabras: [
      "cctv", "videovigilancia", "camaras de seguridad", "camaras de vigilancia", "camara de seguridad",
      "control de acceso", "circuito cerrado",
    ],
  },
  {
    categoria: "tecnologia",
    nombre: "Audiovisual",
    unspsc: ["4511"],
    palabras: ["equipos audiovisuales", "proyector", "pantalla interactiva"],
  },
  {
    categoria: "tecnologia",
    nombre: "UPS y respaldo de energía",
    unspsc: [],
    palabras: ["ups", "inversor", "baterias para ups"],
  },

  // ───────────── Servicios generales ─────────────
  {
    categoria: "servicios_generales",
    nombre: "Mantenimiento de edificaciones",
    unspsc: [
      "721015", "721016", "721017", "721019", "721020", "721025", "721026", "721027", "721028",
      "721029", "721030", "721033",
    ],
    palabras: [
      "mantenimiento", "reparacion", "remodelacion", "adecuacion", "impermeabilizacion", "ascensor",
      "elevador", "albanileria", "carpinteria", "techado",
    ],
  },
  {
    categoria: "servicios_generales",
    nombre: "Climatización (HVAC)",
    unspsc: ["4010"],
    palabras: ["aire acondicionado", "aires acondicionados", "a a", "climatizacion", "hvac", "chiller", "refrigeracion"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Electricidad e iluminación",
    unspsc: ["721022", "3911", "3912"],
    palabras: ["electricidad", "electrico", "electrica", "instalacion electrica", "iluminacion", "luminaria"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Plantas eléctricas y generadores",
    unspsc: ["261116", "261117"],
    palabras: ["planta electrica", "generador", "transferencia automatica", "grupo electrogeno"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Plomería",
    unspsc: ["721023"],
    palabras: ["plomeria", "fontaneria", "sanitarios"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Pintura",
    unspsc: ["721024"],
    palabras: ["pintura"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Limpieza y conserjería",
    unspsc: ["7611", "721018"],
    palabras: ["limpieza", "conserjeria", "aseo"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Fumigación y control de plagas",
    unspsc: ["721021", "7610"],
    palabras: ["fumigacion", "control de plagas", "desinsectacion", "desratizacion"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Desechos",
    unspsc: ["7612", "7613"],
    palabras: ["recogida de desechos", "manejo de residuos", "desechos solidos"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Jardinería y áreas verdes",
    unspsc: ["701117", "701115"],
    palabras: ["jardineria", "areas verdes", "paisajismo", "poda"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Seguridad física y vigilancia",
    unspsc: ["9212"],
    palabras: ["seguridad y vigilancia", "servicio de seguridad", "servicios de seguridad", "vigilancia privada", "guardianes"],
  },
  {
    categoria: "servicios_generales",
    nombre: "Protección contra incendios",
    unspsc: ["4619"],
    palabras: ["extintor", "extintores", "sistema contra incendio", "deteccion de incendio"],
  },
];

// ───────────── Construcción ─────────────
SUBCATEGORIAS.push(
  {
    categoria: "construccion",
    nombre: "Obras de edificación",
    unspsc: ["7213"],
    palabras: [
      "construccion", "edificacion", "edificio", "ampliacion", "remodelacion", "rehabilitacion", "remozamiento",
      "construccion de aulas", "obra civil", "obras civiles",
    ],
  },
  {
    categoria: "construccion",
    nombre: "Obras viales e infraestructura",
    unspsc: ["7214"],
    palabras: [
      "carretera", "camino vecinal", "asfaltado", "asfalto", "pavimentacion", "acera", "contenes", "puente", "badenes",
      "drenaje pluvial", "alcantarillado", "obra vial", "obras viales",
    ],
  },
  {
    categoria: "construccion",
    nombre: "Ingeniería, diseño y supervisión",
    unspsc: ["811015"],
    palabras: [
      "supervision de obra", "supervision de obras", "fiscalizacion de obra", "diseno arquitectonico", "estudio de suelo",
      "estudios de suelo", "topografia", "levantamiento topografico", "presupuesto de obra", "planos",
    ],
  },
  {
    categoria: "construccion",
    nombre: "Materiales de construcción",
    unspsc: ["3011", "3012", "3013", "3015", "3016", "3017"],
    palabras: ["materiales de construccion", "cemento", "varilla", "blocks", "arena", "gravilla", "agregados"],
  },
);

/** Subclases UNSPSC que NUNCA cuentan aunque caigan dentro de un prefijo de arriba. */
export const EXCLUSIONES_UNSPSC: string[] = [
  "26111703", // Baterías para vehículos
  "761118", // Limpieza de vehículos de transporte
];

/**
 * Frases que descartan un proceso cuando solo entró por palabra clave.
 * Si además tiene un artículo con código UNSPSC relevante, se queda.
 */
export const EXCLUSIONES_PALABRAS: string[] = [
  // vehículos y flotilla
  "vehiculo", "vehicular", "flotilla", "autobus", "camioneta", "camion", "jeep", "motocicleta", "automotriz",
  "ambulancia", "desabolladura", "neumatico", "gomas", "combustible", "lubricante", "diesel", "gasoil", "gasolina",
  // insumos (no servicios)
  "material de limpieza", "materiales de limpieza", "productos de limpieza", "insumos de limpieza",
  "articulos de limpieza", "suministros de limpieza", "articulos de aseo", "material gastable", "materiales gastables",
  // equipos médicos y obras viales
  "equipo medico", "equipos medicos", "signos vitales", "anestesia", "mamografo", "rayos x", "caminos vecinales",
  // falsos amigos
  "servidores publicos", "servidor publico", "camaras frigorificas", "pintura artistica", "serigrafia",
];

export const CATEGORIA_ETIQUETA: Record<Categoria | "ambas", string> = {
  tecnologia: "Tecnología",
  servicios_generales: "Servicios generales",
  construccion: "Construcción",
  ambas: "Ambas",
};
