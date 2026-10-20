# Radar de Compras Públicas RD

Plataforma **multiempresa** (SaaS) que detecta los procesos de compras del Estado dominicano en los rubros de cada cliente, usando solo la **API oficial de Datos Abiertos de la DGCP** (sin scraping del portal).

- **Sincronizador** (`worker/`, GitHub Actions 4 veces al día): lee la API respetando el límite (≤ 1 petición/segundo, nunca en paralelo), guarda **todos** los procesos, artículos, contratos y ofertas, y la base de datos clasifica cada proceso para cada empresa según sus rubros.
- **App web** (Next.js en Vercel): cada empresa ve su radar con su logo y colores, su pipeline comercial, la competencia en sus rubros y su configuración. Tú tienes un panel de administración para dar de alta clientes y registrar pagos.
- **Resumen diario por correo** (GitHub Actions, 8:00 a. m.): lo nuevo y lo que cierra esta semana, para cada empresa.

Detalles de la API y de la estrategia de ingesta: [`docs/campos-api.md`](docs/campos-api.md).

## Pantallas

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | Público | Página de venta, precio, preguntas y formulario de demostración |
| `/login?e=<slug>` | Público | Entrada con el logo de la empresa |
| `/radar` | Usuarios | Procesos en sus rubros, contadores, filtros, Excel |
| `/radar/<id>` | Usuarios | Detalle, artículos, documentos, adjudicación, ofertas, seguimiento |
| `/pipeline` | Usuarios | Interesa → En preparación → Ofertado → Ganado / Perdido |
| `/competencia` | Usuarios | Quién gana en sus rubros, adjudicaciones vs. monto estimado, historial por institución |
| `/configuracion` | Admin de la empresa | Marca, equipo (con enlaces de acceso por WhatsApp), alertas, suscripción |
| `/configuracion/rubros` | Admin de la empresa | Editor de rubros con buscador UNSPSC y vista previa |
| `/admin` | Superadministrador | Empresas, ingreso mensual, alta de clientes, pagos, "ver como", solicitudes de demo |

## Puesta en marcha (una sola vez)

1. **Supabase → SQL Editor**: correr [`supabase/migraciones/000_permitir_migraciones.sql`](supabase/migraciones/000_permitir_migraciones.sql). Desde aquí las migraciones se aplican con `npm run migrar`.
2. `.env.local` con las variables de [`.env.example`](.env.example).
3. `npm install`
4. `npm run migrar` — aplica `supabase/migraciones/*.sql` pendientes.
5. `npm run sembrar -- --superadmin tu@correo.com` — rubros de la empresa piloto y tu usuario como superadministrador.
6. `npm run catalogo` — carga el catálogo UNSPSC (17 peticiones) para el editor de rubros.
7. `npm run sync -- --dias 90` — primera carga de 90 días (~10 min).

### GitHub (Settings → Secrets and variables → Actions)

- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (para los correos).
- Variables: `URL_APP` (ej. `https://comprasrd-zkbu.vercel.app`), `ALERTAS_REMITENTE` (ej. `Radar de Compras <alertas@tudominio.com>`).

### Vercel (Settings → Environment Variables)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (solo la usa el servidor para invitar usuarios, subir logos y recalcular rubros; nunca llega al navegador).

### Supabase → Authentication

- Sign In / Providers → Email: desactivar "Allow new users to sign up" (solo entran usuarios agregados por un administrador).
- URL Configuration: Site URL = dirección de Vercel; Redirect URLs = `<dirección>/auth/callback`.
- Recomendado: SMTP propio (Resend) en **Authentication → Emails → SMTP Settings**; el correo incluido en Supabase solo permite unos pocos enlaces por hora. Mientras tanto, usa "Enlace de acceso" en Configuración o en el panel de administración y envíalo por WhatsApp.

## Dar de alta un cliente

1. `/admin` → **Nueva empresa**: nombre, plantillas de rubros, color, logo, días de prueba y correo del administrador del cliente.
2. En la ficha de la empresa → **Enlace de acceso** junto a su administrador → enviarlo por WhatsApp (vence en 1 hora).
3. El cliente ajusta sus rubros y destinatarios en **Configuración**.
4. Cuando pague: ficha de la empresa → **Registrar pago** (extiende la vigencia y la activa). Al vencer, el acceso se pausa solo (los datos se conservan).

## Cómo se clasifica

La regla vive en la base de datos (`clasificar_procesos`, en [`002_multiempresa.sql`](supabase/migraciones/002_multiempresa.sql)) y tiene pruebas en [`clasificacion.test.ts`](src/lib/clasificacion.test.ts) sobre un Postgres en memoria:

- Un artículo cuenta para la subcategoría con el **prefijo UNSPSC más largo** que coincida (salvo códigos excluidos).
- Las **palabras clave** se buscan en título y descripción, sin acentos y aceptando plural.
- Las **palabras de exclusión** descartan un proceso que entró solo por palabra clave.
- La subcategoría principal es la de mayor monto. El motivo queda guardado (`unspsc:81112501; keyword:licencia`).

Las plantillas iniciales están en [`config/categorias.ts`](config/categorias.ts). Cada empresa luego edita sus rubros desde la app.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en <http://localhost:3000> (necesita `.env.local`) |
| `npm run sync` | Sincroniza (ventana automática: última sync − 2 días) |
| `npm run sync -- --dias 30` | Fuerza una ventana de 30 días |
| `npm run alertas` | Envía los resúmenes del día (sin `RESEND_API_KEY` los simula en `worker/salida/alertas/`) |
| `npm run alertas -- --empresa piloto --forzar` | Reenvía el resumen de una empresa |
| `npm run migrar` | Aplica migraciones pendientes |
| `npm run sembrar -- --superadmin correo` | Empresa piloto + superadmin |
| `npm run catalogo` | Recarga el catálogo UNSPSC |
| `npm test` | Pruebas (clasificación por empresa en PGlite) |
| `npm run build` | Compila la app |

## Reglas de uso de la API (DGCP)

- Máximo 60 peticiones/minuto por IP → el cliente (`worker/dgcp.ts`) espera ≥ 1.1 s entre peticiones, en cola estrictamente secuencial, con reintentos y espera exponencial ante 429/5xx.
- Una corrida normal usa ~60 peticiones (+ documentos); máximo medido: 55/min.
- El navegador nunca llama a `datosabiertos.dgcp.gob.do`.
- Antes de vender, revisar los [términos de uso de la API](https://datosabiertos.dgcp.gob.do/content/Terminos%20y%20condiciones%20API-DGCP.pdf) sobre uso comercial y atribución.

## Espacio y retención

Se guardan todos los procesos, pero los de más de 120 días que no le interesan a ninguna empresa ni tienen seguimiento se borran en cada sincronización (`DIAS_RETENCION`). Pasar Supabase al plan Pro (25 dólares al mes) antes del primer cliente real, por las copias de seguridad diarias.
