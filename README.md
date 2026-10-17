# Radar de Compras Públicas RD

Detecta y lista automáticamente los procesos de compras del Estado dominicano en **Tecnología** y **Servicios generales**, usando solo la **API oficial de Datos Abiertos de la DGCP** (sin scraping del portal).

- **Sincronizador** (`worker/`): corre 4 veces al día en GitHub Actions, lee la API respetando el límite (≤ 1 petición/segundo, nunca en paralelo), clasifica y guarda en Supabase solo los procesos relevantes.
- **App web** (Next.js en Vercel): lee **solo** de Supabase. Contadores, filtros, detalle, seguimiento interno y exportación a Excel. Acceso con enlace mágico al correo.

Documentación técnica del Paso 0 (campos reales de la API y por qué se eligió la estrategia de ingesta): [`docs/campos-api.md`](docs/campos-api.md).

---

## 1. Probarlo en tu computadora sin base de datos (modo demo)

1. Instalar dependencias: `npm install`
2. Traer datos reales de los últimos 30 días a un archivo local (≈2 min, ~110 peticiones):
   `npm run sync -- --seco`
3. Abrir la app: `npm run dev` y entrar a <http://localhost:3000>

Sin variables de Supabase la app entra en **modo demo**: lee `worker/salida/radar-seco.json`, no pide login y el seguimiento se guarda solo en memoria.

## 2. Poner Supabase

1. Crear un proyecto en <https://supabase.com/dashboard> (región más cercana: *East US*).
2. Abrir **SQL Editor → New query**, pegar todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsar **Run**. (Se puede volver a correr sin perder datos.)
3. **Authentication → Sign In / Providers → Email**: dejar *Email* activo y **desactivar "Allow new users to sign up"** (el acceso es solo para invitados).
4. **Authentication → Users → Invite user**: invitar a cada persona que usará el Radar.
5. **Authentication → URL Configuration**: en *Site URL* poner la dirección de Vercel (ej. `https://radar-compras.vercel.app`) y en *Redirect URLs* agregar `https://radar-compras.vercel.app/auth/callback` y `http://localhost:3000/auth/callback`.
6. **Project Settings → API**: copiar *Project URL*, *anon public key* y *service_role key*.
7. Crear `.env.local` copiando [`.env.example`](.env.example) y pegar esos valores.
8. Primera carga real (últimos 30 días): `npm run sync`

## 3. Programar la sincronización (GitHub Actions)

1. Subir el proyecto a un repositorio de GitHub.
2. En el repositorio: **Settings → Secrets and variables → Actions → New repository secret** y crear:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Listo: [`.github/workflows/sync.yml`](.github/workflows/sync.yml) corre a las **00:30, 07:30, 14:30 y 21:30 hora RD** (30 min después de cada corte de la DGCP), más un refresco de 30 días los domingos a las 04:00.
4. Para correrlo a mano: pestaña **Actions → Sincronizar DGCP → Run workflow** (opcional: número de días para forzar una ventana más larga).

Cada corrida queda registrada en la tabla `sync_log` (peticiones, máximo por minuto, leídos, relevantes, nuevos, errores). El pie de la app muestra la última.

## 4. Desplegar la app (Vercel)

1. <https://vercel.com/new> → importar el repositorio.
2. En **Environment Variables** poner solo:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (La `service_role` **no** va en Vercel.)
3. **Deploy**.

## 5. Ajustar categorías y palabras clave

Todo está en [`config/categorias.ts`](config/categorias.ts):

- `SUBCATEGORIAS`: cada subcategoría tiene códigos UNSPSC (prefijos: `4323` = familia completa, `811125` = clase) y palabras clave (sin acentos; encuentran plurales).
- `EXCLUSIONES_UNSPSC`: códigos que nunca cuentan (ej. baterías para vehículos).
- `EXCLUSIONES_PALABRAS`: frases que descartan un proceso cuando entró **solo** por palabra clave (ej. "vehiculo", "material de limpieza").

Después de editar:

1. `npm test` — confirma que el clasificador sigue funcionando.
2. `npm run reclasificar` — re-clasifica lo ya guardado usando el `raw` (sin llamar a la API). Los que dejan de calzar se borran, salvo que tengan seguimiento.
3. Si agregaste reglas nuevas y quieres que entren procesos que antes se ignoraron: `npm run sync -- --dias 30`.

Cada proceso guarda `motivo_match` (ej. `unspsc:81112501; keyword:licencia`), visible en el detalle como **"¿Por qué entró?"**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en <http://localhost:3000> |
| `npm run sync` | Sincroniza con Supabase (ventana automática: última sync − 2 días; primera vez 30 días) |
| `npm run sync -- --seco` | Igual, pero guarda en `worker/salida/radar-seco.json` (sin base de datos) |
| `npm run sync -- --dias 7` | Fuerza ventana de 7 días |
| `npm run sync -- --tope-docs 100` | Máximo de procesos a los que pedir documentos en esta corrida (normal: 400) |
| `npm run reclasificar` | Re-clasifica lo guardado con la configuración actual |
| `npm test` | Pruebas del clasificador |
| `npm run build` | Compila la app |

## Reglas de uso de la API (DGCP)

- Máximo 60 peticiones/minuto por IP → el cliente (`worker/dgcp.ts`) espera ≥ 1.1 s entre peticiones, en cola estrictamente secuencial, con reintentos y espera exponencial ante 429/5xx.
- Una carga de 30 días usa ~110 peticiones (máximo medido: 55/min); una corrida normal ~50.
- El navegador nunca llama a `datosabiertos.dgcp.gob.do`.

## Limitaciones conocidas

- La API no permite pedir procesos por "fecha de actualización": los cambios de estado de procesos publicados hace más de 2 días se actualizan en el refresco semanal (domingo 04:00 hora RD, ventana de 30 días) o forzando `--dias`.
- Los documentos se cargan con tope por corrida; tras la primera carga de 30 días se completan en las siguientes corridas.
