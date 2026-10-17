# Paso 0 — Descubrimiento de la API DGCP

Fecha: 2026-10-17 · Base: `https://datosabiertos.dgcp.gob.do/api-dgcp/v1` · ~25 peticiones en total, secuenciales, ≥1.2 s entre cada una.

Muestras crudas en `docs/samples/`:

| Archivo | Petición |
|---|---|
| `swagger.json` | `/docs/doc.json` |
| `procesos.json` | `GET /procesos?startdate=2026-10-14&enddate=2026-10-17&limit=5` |
| `procesos_articulos.json` | `GET /procesos/articulos?proceso=MOPC-CCC-PEEX-2026-0001` |
| `procesos_articulos_sinfiltro.json` | `GET /procesos/articulos?limit=5` (sin filtro) |
| `procesos_articulos_subclase.json` | `GET /procesos/articulos?subclase=81112501&limit=5` |
| `procesos_articulos_familia.json` | `GET /procesos/articulos?familia=4323` → **503** (timeout del servidor) |
| `procesos_documentos.json` | `GET /procesos/documentos?proceso=MOPC-CCC-PEEX-2026-0001` |
| `ocds_releases_all.json` | `GET /ocds/releases/all?start_date=…&end_date=…&limit=5` |
| `ocds_release.json` | `GET /ocds/releases?ocid=ocds-6550wx-MOPC-CCC-PEEX-2026-0001` |
| `catalogo.json`, `catalogo_validacion.json` | `GET /catalogo` por segmento/familia |

## Envoltorio común

```json
{ "code": 200, "hasError": false, "page": 1, "limit": 5, "totalResults": 1152, "pages": 231,
  "payload": { "content": [ ... ] } }
```
En error: `{ "code": 503, "hasError": true, "payload": { "content": null, "message": "El servidor está tardando demasiado..." } }`.
Fechas en ISO UTC (`2026-10-16T18:00:01.2133333Z`, a veces con 7 decimales).

## `/procesos` — campos reales

| Concepto del SPEC | Campo real | Ejemplo |
|---|---|---|
| Código de proceso | `codigo_proceso` | `MOPC-CCC-PEEX-2026-0001` |
| Título | `titulo` | |
| Descripción | `descripcion` | (casi siempre igual al título) |
| Código unidad de compra | `codigo_unidad_compra` (número) | `5` |
| Institución | `unidad_compra` | `Ministerio de Obras Públicas y Comunicaciones` |
| Modalidad | `modalidad` | `Compras por Debajo del Umbral`, `Contratación Menor`, `Comparación de Precios`, `Licitación Pública Nacional`, `Procesos de Excepción`, `Subasta Inversa`… |
| Tipo de excepción | `tipo_excepcion` | `Exclusividad`, `Proceso ordinario` |
| Estado | `estado_proceso` | `Proceso publicado`, `Proceso con etapa cerrada`, `Sobres abiertos o aperturados`, `Proceso adjudicado y celebrado`, `Cancelado`, `Proceso desierto` |
| Fecha publicación | `fecha_publicacion` | |
| **Fecha cierre de ofertas** | `fecha_fin_recepcion_ofertas` | `2026-10-26T10:00:00Z` (nula en ~0.3 %) |
| Otras fechas | `fecha_apertura_ofertas`, `fecha_enmienda`, `fecha_estimada_adjudicacion`, `fecha_suscripcion` | |
| Monto estimado | `monto_estimado` (número) | `33600000` |
| Moneda | `divisa` | `DOP` (99.6 %), `USD` |
| MIPYME | `dirigido_mipymes` / `dirigido_mipymes_mujeres` (`"Si"`/`"No"`) | |
| URL al portal | `url` | `https://comunidad.comprasdominicana.gob.do//Public/Tendering/OpportunityDetail/Index?noticeUID=DO1.NTC.1785462` |
| Extras útiles | `objeto_proceso` (Bienes/Servicios/Obras), `area_requiriente`, `duracion_contrato`, `proceso_lotificado` | |
| Códigos UNSPSC | **no vienen aquí** → ver `/procesos/articulos` | |

`/procesos` **no** viene ordenado de forma estricta (480 inversiones en 1,000 filas): hay que leer todas las páginas del rango. Volumen: **7,636 procesos en 30 días ≈ 8 páginas de 1,000**.

## `/procesos/articulos` — campos reales

`codigo_proceso`, `fecha_publicacion`, `familia_unspsc` (`81110000`), `clase_unspsc` (`81112500`), `subclase_unspsc` (`81112501`), `descripcion_articulo` (nombre del catálogo), `descripcion_usuario` (texto libre de la institución), `cantidad`, `unidad_medida`, `precio_unitario_estimado`, `precio_total_estimado`, `cuenta_presupuestaria`.

Hallazgo clave: **sin filtro, el endpoint devuelve todos los artículos ordenados por `fecha_publicacion` descendente** (6 inversiones mínimas en 1,000 filas, por empates de milisegundos). 1,000 artículos ≈ 5 horas de publicaciones ≈ 169 procesos (≈6 artículos/proceso). 30 días ≈ **45 páginas**. Los códigos UNSPSC son de 8 dígitos; filtrar por `familia` con 4 dígitos produce 503.

## `/procesos/documentos`

`nombre_documento`, `codigo_proceso`, `tipo_documento` (casi siempre `Otro`), `fecha_carga_archivo`, `url_documento` (enlace de descarga del portal). Requiere `proceso` → 1 petición por proceso.

## `/ocds/releases/all` y `/ocds/releases`

`/ocds/releases/all` **solo devuelve un índice** `{ ocid, url }`; el release completo exige `GET /ocds/releases?ocid=…` (1 petición por proceso). El release sí trae `tender.items[].classification`, `tender.tenderPeriod.endDate`, `tender.value`, `procuringEntity` — pero la misma información ya está en `/procesos` + `/procesos/articulos`. `ocid = "ocds-6550wx-" + codigo_proceso`.

## Decisión de estrategia de ingesta

| Opción | Peticiones para 30 días | Peticiones por corrida incremental (ventana de 3 días) |
|---|---|---|
| A — OCDS (`/all` + 1 release por proceso) | 8 + 7,636 ≈ **7,650** (≈2 h 10 min a 1 req/s) | ~1,000 |
| B — `/procesos` + `/procesos/articulos?proceso=X` | 8 + 7,636 ≈ **7,650** | ~1,000 |
| **C — `/procesos` por fechas + `/procesos/articulos` sin filtro, paginado hasta salir de la ventana** | 8 + ~46 ≈ **55** (≈1 min) | ~2 + ~6 ≈ **8** |

**Elegida: Opción C** (variante de B, no prevista en el SPEC). Las opciones A y B obligan a una petición por proceso; C trae la clasificación UNSPSC de todos los procesos de la ventana en lote, y la fecha de cierre sale de `/procesos`. El worker:

1. Pagina `/procesos?startdate&enddate&limit=1000` completo (orden no estricto).
2. Pagina `/procesos/articulos?limit=1000` desde la página 1 y se detiene cuando una página completa queda por debajo de `startdate` (margen por el orden casi estricto).
3. Une por `codigo_proceso`, clasifica, y solo para los **relevantes nuevos** pide `/procesos/documentos` (≈1,400 la primera vez, ~40-60 por corrida después). Para no alargar la primera carga, los documentos se piden con un tope por corrida y se completan en corridas siguientes.

Riesgo: si la DGCP cambia el orden de `/procesos/articulos`, el paso 2 lo detecta (no hay fechas dentro de la ventana) y cae automáticamente a la Opción B por proceso.

## Validación de códigos UNSPSC contra `/catalogo`

| Código del SPEC | Resultado en el catálogo DGCP |
|---|---|
| Segmento `43` | ✅ Difusión de TIC. Familias 4319 (dispositivos de comunicación/radios), 4320 (componentes), 4321 (equipo informático), 4322 (redes voz/datos), 4323 (software) |
| `8111` Servicios informáticos | ✅ incluye 81112200 mantenimiento/soporte de software, 81112500 licencias, 81112100 internet |
| `8116` | ❌ **No existe** en el catálogo DGCP → se elimina (cubierto por 8111) |
| `8311` Telecomunicaciones | ✅ |
| `4511` Audio y video | ✅ |
| `4617` Seguridad, vigilancia y detección | ✅ 46171600 equipo de vigilancia (cámaras) |
| Segmento `72` | ✅ pero 7213/7214 son **construcción de obra** → solo se toma la familia **7210** (mantenimiento y reparaciones: eléctrico 721022, plomería/A.A. 721023, pintura 721024, control de plagas 721021, impermeabilización 721020, modernización 721028, mantenimiento de instalaciones 721029…) |
| `4010` Climatización | ✅ 40101700 enfriamiento (aires acondicionados) |
| `3911` Iluminación | ✅ |
| `3912` Eléctricos | ✅ |
| `2611` Generadores/baterías | ✅ pero mezcla embragues/frenos → solo clases **26111600** (generadores) y **26111700** (baterías), excluyendo subclase 26111703 *baterías para vehículos* |
| Segmento `76` | ✅ 7610 desinfección, 7611 aseo y limpieza (excluyendo 76111800 *limpieza de vehículos*), 7612 desechos |
| `9212` Seguridad física | ✅ guardias, sistemas de seguridad |
| Jardinería | ✅ **70111700** *Parques, jardines y huertos* (y 70111500 plantas ornamentales) |
| Extra propuesto | `4619` Protección contra incendios (extintores) |

Prueba con 1,000 artículos reales (169 procesos): **30 procesos (18 %) coinciden por UNSPSC** → ~1,400 relevantes por mes. Los falsos positivos vistos (baterías y lavado de vehículos) quedan cubiertos por las exclusiones de arriba.
