-- Radar de Compras Públicas RD — esquema Supabase
-- Pegar completo en Supabase → SQL Editor → Run. Se puede volver a correr sin perder datos.

-- ───────────── Instituciones (unidades de compra) ─────────────
create table if not exists instituciones (
  codigo_unidad_compra integer primary key,
  nombre               text not null,
  actualizado_en       timestamptz not null default now()
);

-- ───────────── Procesos relevantes ─────────────
create table if not exists procesos (
  id                       bigint generated always as identity primary key,
  codigo_proceso           text not null unique,
  ocid                     text,
  titulo                   text,
  descripcion              text,
  unidad_compra_codigo     integer,
  institucion              text,
  modalidad                text,
  tipo_excepcion           text,
  estado                   text,
  objeto_proceso           text,
  fecha_publicacion        timestamptz,
  fecha_cierre_ofertas     timestamptz,
  fecha_apertura_ofertas   timestamptz,
  monto_estimado           numeric,
  moneda                   text,
  es_mipyme                boolean not null default false,
  es_mipyme_mujer          boolean not null default false,
  url_portal               text,
  categoria                text check (categoria in ('tecnologia', 'servicios_generales', 'ambas')),
  subcategoria             text,
  subcategorias            text[] not null default '{}',
  motivo_match             text,
  texto_busqueda           text,          -- título + descripción + institución + código, normalizado sin acentos
  documentos_actualizados_en timestamptz,
  raw                      jsonb,         -- { proceso, articulos } tal como vinieron de la API
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now()
);

create index if not exists procesos_fecha_publicacion_idx on procesos (fecha_publicacion desc);
create index if not exists procesos_fecha_cierre_idx      on procesos (fecha_cierre_ofertas);
create index if not exists procesos_categoria_idx         on procesos (categoria);
create index if not exists procesos_institucion_idx       on procesos (unidad_compra_codigo);
create index if not exists procesos_subcategorias_idx     on procesos using gin (subcategorias);

create table if not exists proceso_articulos (
  id                  bigint generated always as identity primary key,
  proceso_id          bigint not null references procesos (id) on delete cascade,
  descripcion         text,
  descripcion_usuario text,
  cantidad            numeric,
  unidad              text,
  precio_unitario     numeric,
  precio_total        numeric,
  codigo_unspsc       text,
  familia             text,
  clase               text,
  relevante           boolean not null default false
);
create index if not exists proceso_articulos_proceso_idx on proceso_articulos (proceso_id);

create table if not exists proceso_documentos (
  id                bigint generated always as identity primary key,
  proceso_id        bigint not null references procesos (id) on delete cascade,
  titulo            text,
  tipo              text,
  url               text not null,
  fecha_publicacion timestamptz,
  unique (proceso_id, url)
);

-- ───────────── Seguimiento interno ─────────────
create table if not exists seguimiento (
  proceso_id      bigint primary key references procesos (id) on delete cascade,
  estado_interno  text not null default 'nuevo'
                  check (estado_interno in ('nuevo', 'interesa', 'descartado', 'en_preparacion', 'ofertado')),
  nota            text,
  actualizado_por text,
  actualizado_en  timestamptz not null default now()
);

-- ───────────── Bitácora del sincronizador ─────────────
create table if not exists sync_log (
  id                    bigint generated always as identity primary key,
  inicio                timestamptz not null default now(),
  fin                   timestamptz,
  exito                 boolean,
  estrategia            text,
  ventana_desde         date,
  ventana_hasta         date,
  procesos_leidos       integer default 0,
  articulos_leidos      integer default 0,
  procesos_nuevos       integer default 0,
  procesos_relevantes   integer default 0,
  documentos_cargados   integer default 0,
  peticiones_api        integer default 0,
  max_peticiones_minuto integer default 0,
  errores               text
);

-- ───────────── Vistas para la app ─────────────
create or replace view procesos_lista with (security_invoker = true) as
select p.id, p.codigo_proceso, p.titulo, p.unidad_compra_codigo, p.institucion, p.modalidad, p.estado,
       p.fecha_publicacion, p.fecha_cierre_ofertas, p.monto_estimado, p.moneda, p.es_mipyme,
       p.url_portal, p.categoria, p.subcategoria, p.subcategorias, p.motivo_match, p.texto_busqueda,
       coalesce(s.estado_interno, 'nuevo') as estado_interno, s.nota
from procesos p
left join seguimiento s on s.proceso_id = p.id;

create or replace view instituciones_con_procesos with (security_invoker = true) as
select unidad_compra_codigo as codigo, max(institucion) as nombre, count(*) as procesos
from procesos
group by unidad_compra_codigo;

-- ───────────── Seguridad (RLS) ─────────────
-- El sincronizador usa la service_role key (salta RLS). La app solo permite usuarios autenticados;
-- los usuarios se invitan desde Supabase → Authentication (registro público desactivado).
alter table instituciones      enable row level security;
alter table procesos           enable row level security;
alter table proceso_articulos  enable row level security;
alter table proceso_documentos enable row level security;
alter table seguimiento        enable row level security;
alter table sync_log           enable row level security;

do $$
declare t text;
begin
  foreach t in array array['instituciones', 'procesos', 'proceso_articulos', 'proceso_documentos', 'seguimiento', 'sync_log'] loop
    execute format('drop policy if exists leer_autenticados on %I', t);
    execute format('create policy leer_autenticados on %I for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists escribir_seguimiento on seguimiento;
create policy escribir_seguimiento on seguimiento for insert to authenticated with check (true);
drop policy if exists actualizar_seguimiento on seguimiento;
create policy actualizar_seguimiento on seguimiento for update to authenticated using (true) with check (true);
