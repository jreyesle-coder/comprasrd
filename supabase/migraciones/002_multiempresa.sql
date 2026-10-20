-- 002 — Plataforma multiempresa (sprints 1-8)
-- Aplicar con `npm run migrar` (usa exec_sql) o pegando en el SQL Editor. Se puede volver a correr.


-- ───────────── Procesos: ahora se guardan TODOS ─────────────
alter table procesos add column if not exists texto_clasif text; -- título + descripción normalizados (sin acentos)
alter table procesos alter column subcategorias drop not null;
create index if not exists procesos_docs_pend_idx on procesos (documentos_actualizados_en) where documentos_actualizados_en is null;
create index if not exists proceso_articulos_unspsc_idx on proceso_articulos (codigo_unspsc text_pattern_ops);

alter table sync_log add column if not exists contratos_leidos integer default 0;
alter table sync_log add column if not exists ofertas_leidas integer default 0;
alter table sync_log add column if not exists coincidencias integer default 0;
alter table sync_log add column if not exists procesos_borrados integer default 0;

-- ───────────── Empresas (clientes) ─────────────
create table if not exists empresas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  slug                  text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  logo_url              text,
  color_primario        text not null default '#1d4ed8' check (color_primario ~ '^#[0-9a-fA-F]{6}$'),
  estado                text not null default 'prueba' check (estado in ('prueba', 'activa', 'suspendida')),
  plan                  text not null default 'estandar',
  precio_mensual_usd    numeric not null default 100,
  vence_en              date,
  contacto_nombre       text,
  contacto_email        text,
  contacto_telefono     text,
  exclusiones_unspsc    text[] not null default '{}',
  exclusiones_palabras  text[] not null default '{}',
  alertas_activas       boolean not null default true,
  alertas_destinatarios text[] not null default '{}',
  onboarding_completado boolean not null default false,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create table if not exists miembros (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references empresas (id) on delete cascade,
  email     text not null,
  nombre    text,
  rol       text not null default 'usuario' check (rol in ('admin', 'usuario')),
  creado_en timestamptz not null default now()
);
create index if not exists miembros_empresa_idx on miembros (empresa_id);

create table if not exists superadmins (
  email text primary key
);

-- Rubros (reglas de clasificación) por empresa.
-- unspsc: prefijos sin ceros finales; palabras: ya normalizadas (minúsculas, sin acentos).
create table if not exists reglas (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  grupo      text not null,
  nombre     text not null,
  unspsc     text[] not null default '{}',
  palabras   text[] not null default '{}',
  activa     boolean not null default true,
  orden      integer not null default 0,
  creado_en  timestamptz not null default now(),
  unique (empresa_id, nombre)
);
create index if not exists reglas_empresa_idx on reglas (empresa_id);

-- Resultado de clasificar cada proceso para cada empresa
create table if not exists coincidencias (
  empresa_id    uuid not null references empresas (id) on delete cascade,
  proceso_id    bigint not null references procesos (id) on delete cascade,
  grupo         text not null,        -- grupo de la subcategoría principal
  grupos        text[] not null,
  subcategoria  text not null,
  subcategorias text[] not null,
  motivo_match  text not null,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, proceso_id)
);
create index if not exists coincidencias_proceso_idx on coincidencias (proceso_id);
create index if not exists coincidencias_creado_idx on coincidencias (empresa_id, creado_en desc);

-- Seguimiento pasa a ser por empresa
alter table seguimiento add column if not exists empresa_id uuid references empresas (id) on delete cascade;
alter table seguimiento drop constraint if exists seguimiento_estado_interno_check;
alter table seguimiento add constraint seguimiento_estado_interno_check
  check (estado_interno in ('nuevo', 'interesa', 'descartado', 'en_preparacion', 'ofertado', 'ganado', 'perdido'));
alter table seguimiento add column if not exists monto_ofertado numeric;

-- ───────────── Adjudicaciones y ofertas (datos públicos) ─────────────
create table if not exists contratos (
  codigo_contrato      text primary key,
  codigo_proceso       text not null,
  unidad_compra_codigo integer,
  institucion          text,
  rpe                  text,
  proveedor            text,
  estado_contrato      text,
  estado_adjudicacion  text,
  fecha_adjudicacion   timestamptz,
  valor_contratado     numeric,
  moneda               text,
  descripcion          text,
  url_contrato         text,
  actualizado_en       timestamptz not null default now()
);
create index if not exists contratos_proceso_idx on contratos (codigo_proceso);
create index if not exists contratos_institucion_idx on contratos (unidad_compra_codigo, fecha_adjudicacion desc);
create index if not exists contratos_rpe_idx on contratos (rpe);

create table if not exists ofertas (
  id_oferta         text primary key,
  codigo_proceso    text not null,
  rpe               text,
  proveedor         text,
  valor_oferta      numeric,
  estado_oferta     text,
  estado_evaluacion text,
  fecha_creacion    timestamptz,
  actualizado_en    timestamptz not null default now()
);
create index if not exists ofertas_proceso_idx on ofertas (codigo_proceso);

-- ───────────── Catálogo UNSPSC (para el editor de rubros) ─────────────
create table if not exists catalogo_unspsc (
  codigo      text primary key,   -- 8 dígitos
  nivel       text not null check (nivel in ('segmento', 'familia', 'clase', 'subclase')),
  descripcion text not null,
  ruta        text not null,      -- "Segmento › Familia › Clase" para mostrar
  busqueda    text not null       -- normalizado para buscar
);
create index if not exists catalogo_busqueda_idx on catalogo_unspsc using gin (to_tsvector('simple', busqueda));

-- ───────────── Alertas, pagos y solicitudes de demo ─────────────
create table if not exists alertas_envios (
  id           bigint generated always as identity primary key,
  empresa_id   uuid not null references empresas (id) on delete cascade,
  enviado_en   timestamptz not null default now(),
  destinatarios text[] not null,
  nuevos       integer not null default 0,
  por_cerrar   integer not null default 0,
  estado       text not null,     -- enviado | simulado | error | sin_novedades
  detalle      text
);

create table if not exists pagos (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references empresas (id) on delete cascade,
  fecha         date not null default current_date,
  monto         numeric not null,
  moneda        text not null default 'USD',
  metodo        text,
  referencia    text,
  periodo_hasta date not null,
  registrado_por text,
  creado_en     timestamptz not null default now()
);

create table if not exists solicitudes_demo (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  empresa   text not null,
  email     text not null,
  telefono  text,
  rubros    text,
  mensaje   text,
  atendida  boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ───────────── Funciones de acceso ─────────────
create or replace function mi_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from miembros where user_id = auth.uid()
$$;

create or replace function es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from superadmins where email = lower(auth.jwt() ->> 'email'))
$$;

create or replace function es_admin_empresa() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where user_id = auth.uid() and rol = 'admin') or es_superadmin()
$$;

-- La empresa del usuario puede usar el sistema (no suspendida y suscripción vigente)
create or replace function empresa_habilitada(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from empresas e
    where e.id = p_empresa and e.estado <> 'suspendida' and (e.vence_en is null or e.vence_en >= current_date)
  )
$$;

-- agregados auxiliares para concatenar arrays
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'array_concat_agg') then
    create aggregate array_concat_agg(anycompatiblearray) (sfunc = array_cat, stype = anycompatiblearray, initcond = '{}');
  end if;
end $$;

-- ───────────── Clasificación por empresa (en la base de datos) ─────────────
-- Reglas: un artículo cuenta para la regla con el prefijo UNSPSC más largo que coincida
-- (salvo exclusiones UNSPSC de la empresa). Palabras clave: palabra/frase completa en texto_clasif,
-- con plural -s/-es; no cuentan si el texto tiene una exclusión y el proceso no entró por UNSPSC.
-- Peso: artículos = 1 + monto; palabra = 0.5. La subcategoría principal es la de mayor peso.
create or replace function clasificar_procesos(p_empresa uuid, p_desde timestamptz, p_proceso_ids bigint[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_excl_unspsc text[];
  v_excl_re     text;
  v_total       integer;
begin
  select exclusiones_unspsc,
         case when cardinality(exclusiones_palabras) > 0
              then '(^| )(' || array_to_string(exclusiones_palabras, '|') || ')(s|es)?( |$)' end
    into v_excl_unspsc, v_excl_re
  from empresas where id = p_empresa;
  if not found then return 0; end if;

  drop table if exists _proc, _reglas, _art, _pesos, _res;
  create temp table _proc on commit drop as
    select p.id, coalesce(p.texto_clasif, '') as texto
    from procesos p
    where (p_proceso_ids is not null and p.id = any (p_proceso_ids))
       or (p_proceso_ids is null and p.fecha_publicacion >= p_desde);

  create temp table _reglas on commit drop as
    select r.id, r.grupo, r.nombre, r.orden,
           array(select regexp_replace(u, '(00)+$', '') from unnest(r.unspsc) u where u <> '') as prefijos,
           case when cardinality(r.palabras) > 0
                then '(^| )(' || array_to_string(r.palabras, '|') || ')(s|es)?( |$)' end as re
    from reglas r
    where r.empresa_id = p_empresa and r.activa;

  -- artículos → regla de prefijo más largo
  create temp table _art on commit drop as
    select a.proceso_id, a.codigo_unspsc, a.precio_total, m.regla_id
    from proceso_articulos a
    join _proc pr on pr.id = a.proceso_id
    cross join lateral (
      select r.id as regla_id
      from _reglas r, unnest(r.prefijos) pref
      where a.codigo_unspsc like pref || '%'
      order by length(pref) desc, r.orden
      limit 1
    ) m
    where a.codigo_unspsc is not null
      and not exists (select 1 from unnest(v_excl_unspsc) x where x <> '' and a.codigo_unspsc like regexp_replace(x, '(00)+$', '') || '%');

  create temp table _pesos on commit drop as
    select proceso_id, regla_id, sum(1 + greatest(coalesce(precio_total, 0), 0)) as peso,
           array_agg(distinct 'unspsc:' || codigo_unspsc) as motivos
    from _art group by proceso_id, regla_id;

  insert into _pesos (proceso_id, regla_id, peso, motivos)
  select pr.id, r.id, 0.5, array['keyword:' || (regexp_match(pr.texto, r.re))[2]]
  from _proc pr
  join _reglas r on r.re is not null and pr.texto ~ r.re
  where v_excl_re is null
     or pr.texto !~ v_excl_re
     or exists (select 1 from _art a where a.proceso_id = pr.id);

  -- consolidar por proceso
  create temp table _res on commit drop as
    select x.proceso_id,
           (array_agg(r.grupo order by x.peso desc, r.orden))[1] as grupo,
           array_agg(distinct r.grupo) as grupos,
           (array_agg(r.nombre order by x.peso desc, r.orden))[1] as subcategoria,
           array_agg(r.nombre order by x.peso desc, r.orden) as subcategorias,
           array_to_string(array(select distinct m from unnest(array_concat_agg(x.motivos)) m order by m), '; ') as motivo_match
    from (
      select proceso_id, regla_id, sum(peso) as peso, array_concat_agg(motivos) as motivos
      from _pesos group by proceso_id, regla_id
    ) x
    join _reglas r on r.id = x.regla_id
    group by x.proceso_id;

  delete from coincidencias c
  using _proc pr
  where c.empresa_id = p_empresa and c.proceso_id = pr.id
    and not exists (select 1 from _res r where r.proceso_id = pr.id);

  insert into coincidencias as c (empresa_id, proceso_id, grupo, grupos, subcategoria, subcategorias, motivo_match)
  select p_empresa, proceso_id, grupo, grupos, subcategoria, subcategorias, motivo_match from _res
  on conflict (empresa_id, proceso_id) do update
    set grupo = excluded.grupo, grupos = excluded.grupos, subcategoria = excluded.subcategoria,
        subcategorias = excluded.subcategorias, motivo_match = excluded.motivo_match, actualizado_en = now()
    where (c.grupo, c.grupos, c.subcategoria, c.subcategorias, c.motivo_match)
          is distinct from (excluded.grupo, excluded.grupos, excluded.subcategoria, excluded.subcategorias, excluded.motivo_match);

  select count(*) into v_total from _res;
  drop table if exists _proc, _reglas, _art, _pesos, _res;
  return v_total;
end $$;

-- Clasifica para todas las empresas habilitadas (lo llama el sincronizador)
create or replace function clasificar_todas(p_desde timestamptz) returns integer
language plpgsql security definer set search_path = public as $$
declare e record; n integer := 0;
begin
  for e in select id from empresas where estado <> 'suspendida' loop
    n := n + clasificar_procesos(e.id, p_desde);
  end loop;
  return n;
end $$;

-- Vista previa del editor: cuántos procesos de los últimos N días entrarían con estas reglas
create or replace function contar_coincidencias(p_unspsc text[], p_palabras text[], p_dias integer default 30)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from procesos p
  where p.fecha_publicacion >= now() - make_interval(days => p_dias)
    and (
      exists (
        select 1 from proceso_articulos a, unnest(p_unspsc) u
        where a.proceso_id = p.id and u <> '' and a.codigo_unspsc like regexp_replace(u, '(00)+$', '') || '%'
      )
      or (cardinality(p_palabras) > 0
          and coalesce(p.texto_clasif, '') ~ ('(^| )(' || array_to_string(p_palabras, '|') || ')(s|es)?( |$)'))
    )
$$;

-- Procesos a los que hay que pedir documentos: relevantes para alguna empresa
create or replace function pendientes_documentos(p_tope integer) returns table (id bigint, codigo_proceso text)
language sql stable security definer set search_path = public as $$
  (select p.id, p.codigo_proceso from procesos p
   where p.documentos_actualizados_en is null and exists (select 1 from coincidencias c where c.proceso_id = p.id)
   order by p.fecha_publicacion desc limit p_tope)
  union all
  (select p.id, p.codigo_proceso from procesos p
   where p.documentos_actualizados_en < now() - interval '24 hours' and p.fecha_cierre_ofertas > now()
     and exists (select 1 from coincidencias c where c.proceso_id = p.id)
   order by p.documentos_actualizados_en limit p_tope)
  limit p_tope
$$;

-- Limpieza: quita procesos viejos que no le interesan a ninguna empresa (mantiene el espacio bajo)
create or replace function limpiar_procesos_viejos(p_dias integer default 120) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from procesos p
  where p.fecha_publicacion < now() - make_interval(days => p_dias)
    and not exists (select 1 from coincidencias c where c.proceso_id = p.id)
    and not exists (select 1 from seguimiento s where s.proceso_id = p.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── Competencia (adjudicaciones en los rubros de la empresa) ─────────────
create or replace function ranking_proveedores(p_dias integer default 90, p_institucion integer default null)
returns table (rpe text, proveedor text, contratos bigint, monto numeric, instituciones bigint, ultimo timestamptz)
language sql stable security definer set search_path = public as $$
  select c.rpe, max(c.proveedor), count(*), sum(c.valor_contratado), count(distinct c.unidad_compra_codigo), max(c.fecha_adjudicacion)
  from contratos c
  join procesos p on p.codigo_proceso = c.codigo_proceso
  join coincidencias co on co.proceso_id = p.id and co.empresa_id = mi_empresa()
  where c.fecha_adjudicacion >= now() - make_interval(days => p_dias)
    and coalesce(c.estado_adjudicacion, '') <> 'Cancelada'
    and (p_institucion is null or c.unidad_compra_codigo = p_institucion)
    and empresa_habilitada(mi_empresa())
  group by c.rpe
  order by sum(c.valor_contratado) desc nulls last
  limit 50
$$;

create or replace function adjudicaciones_recientes(p_dias integer default 90, p_institucion integer default null, p_rpe text default null)
returns table (codigo_contrato text, codigo_proceso text, proceso_id bigint, titulo text, institucion text, unidad_compra_codigo integer,
               proveedor text, rpe text, valor_contratado numeric, moneda text, fecha_adjudicacion timestamptz, subcategoria text, monto_estimado numeric)
language sql stable security definer set search_path = public as $$
  select c.codigo_contrato, c.codigo_proceso, p.id, p.titulo, c.institucion, c.unidad_compra_codigo, c.proveedor, c.rpe,
         c.valor_contratado, c.moneda, c.fecha_adjudicacion, co.subcategoria, p.monto_estimado
  from contratos c
  join procesos p on p.codigo_proceso = c.codigo_proceso
  join coincidencias co on co.proceso_id = p.id and co.empresa_id = mi_empresa()
  where c.fecha_adjudicacion >= now() - make_interval(days => p_dias)
    and coalesce(c.estado_adjudicacion, '') <> 'Cancelada'
    and (p_institucion is null or c.unidad_compra_codigo = p_institucion)
    and (p_rpe is null or c.rpe = p_rpe)
    and empresa_habilitada(mi_empresa())
  order by c.fecha_adjudicacion desc
  limit 300
$$;

-- ───────────── Vistas para la app ─────────────
drop view if exists procesos_lista;
create view procesos_lista with (security_invoker = true) as
select p.id, p.codigo_proceso, p.titulo, p.unidad_compra_codigo, p.institucion, p.modalidad, p.estado,
       p.fecha_publicacion, p.fecha_cierre_ofertas, p.monto_estimado, p.moneda, p.es_mipyme, p.url_portal,
       p.texto_busqueda, c.empresa_id, c.grupo, c.grupos, c.subcategoria, c.subcategorias, c.motivo_match,
       c.creado_en as detectado_en,
       coalesce(s.estado_interno, 'nuevo') as estado_interno, s.nota, s.monto_ofertado
from coincidencias c
join procesos p on p.id = c.proceso_id
left join seguimiento s on s.proceso_id = c.proceso_id and s.empresa_id = c.empresa_id;

drop view if exists instituciones_con_procesos;
create view instituciones_con_procesos with (security_invoker = true) as
select c.empresa_id, p.unidad_compra_codigo as codigo, max(p.institucion) as nombre, count(*) as procesos
from coincidencias c join procesos p on p.id = c.proceso_id
group by c.empresa_id, p.unidad_compra_codigo;

-- ───────────── Empresa piloto y seguimiento por empresa ─────────────
-- La primera empresa se crea aquí; las filas antiguas de seguimiento se le asignan.
insert into empresas (nombre, slug, estado)
select 'Empresa piloto', 'piloto', 'activa'
where not exists (select 1 from empresas);

update seguimiento set empresa_id = (select id from empresas order by creado_en limit 1) where empresa_id is null;
alter table seguimiento alter column empresa_id set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'seguimiento_empresa_proceso_pk') then
    alter table seguimiento drop constraint if exists seguimiento_pkey;
    alter table seguimiento add constraint seguimiento_empresa_proceso_pk primary key (empresa_id, proceso_id);
  end if;
end $$;

-- ───────────── RLS ─────────────
alter table empresas         enable row level security;
alter table miembros         enable row level security;
alter table superadmins      enable row level security;
alter table reglas           enable row level security;
alter table coincidencias    enable row level security;
alter table contratos        enable row level security;
alter table ofertas          enable row level security;
alter table catalogo_unspsc  enable row level security;
alter table alertas_envios   enable row level security;
alter table pagos            enable row level security;
alter table solicitudes_demo enable row level security;

do $$
declare t text;
begin
  -- datos públicos del SECP: cualquier usuario autenticado
  foreach t in array array['procesos', 'proceso_articulos', 'proceso_documentos', 'instituciones', 'contratos', 'ofertas', 'catalogo_unspsc'] loop
    execute format('drop policy if exists leer_autenticados on %I', t);
    execute format('create policy leer_autenticados on %I for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists leer_autenticados on sync_log;
create policy leer_autenticados on sync_log for select to authenticated using (true);

-- empresas
drop policy if exists empresa_leer on empresas;
create policy empresa_leer on empresas for select to authenticated using (id = mi_empresa() or es_superadmin());
drop policy if exists empresa_editar on empresas;
create policy empresa_editar on empresas for update to authenticated
  using ((id = mi_empresa() and es_admin_empresa()) or es_superadmin())
  with check ((id = mi_empresa() and es_admin_empresa()) or es_superadmin());

-- miembros
drop policy if exists miembros_leer on miembros;
create policy miembros_leer on miembros for select to authenticated using (empresa_id = mi_empresa() or es_superadmin());

-- superadmins: solo verse a sí mismo
drop policy if exists superadmins_leer on superadmins;
create policy superadmins_leer on superadmins for select to authenticated using (email = lower(auth.jwt() ->> 'email'));

-- reglas
drop policy if exists reglas_leer on reglas;
create policy reglas_leer on reglas for select to authenticated using (empresa_id = mi_empresa() or es_superadmin());
drop policy if exists reglas_escribir on reglas;
create policy reglas_escribir on reglas for all to authenticated
  using ((empresa_id = mi_empresa() and es_admin_empresa()) or es_superadmin())
  with check ((empresa_id = mi_empresa() and es_admin_empresa()) or es_superadmin());

-- coincidencias: solo la propia empresa y si está habilitada
drop policy if exists coincidencias_leer on coincidencias;
create policy coincidencias_leer on coincidencias for select to authenticated
  using ((empresa_id = mi_empresa() and empresa_habilitada(empresa_id)) or es_superadmin());

-- seguimiento
drop policy if exists leer_autenticados on seguimiento;
drop policy if exists escribir_seguimiento on seguimiento;
drop policy if exists actualizar_seguimiento on seguimiento;
drop policy if exists seguimiento_leer on seguimiento;
create policy seguimiento_leer on seguimiento for select to authenticated using (empresa_id = mi_empresa());
drop policy if exists seguimiento_insertar on seguimiento;
create policy seguimiento_insertar on seguimiento for insert to authenticated
  with check (empresa_id = mi_empresa() and empresa_habilitada(empresa_id));
drop policy if exists seguimiento_actualizar on seguimiento;
create policy seguimiento_actualizar on seguimiento for update to authenticated
  using (empresa_id = mi_empresa()) with check (empresa_id = mi_empresa() and empresa_habilitada(empresa_id));

-- alertas y pagos: lectura para la propia empresa / superadmin
drop policy if exists alertas_leer on alertas_envios;
create policy alertas_leer on alertas_envios for select to authenticated using (empresa_id = mi_empresa() or es_superadmin());
drop policy if exists pagos_leer on pagos;
create policy pagos_leer on pagos for select to authenticated using (empresa_id = mi_empresa() or es_superadmin());
drop policy if exists solicitudes_leer on solicitudes_demo;
create policy solicitudes_leer on solicitudes_demo for select to authenticated using (es_superadmin());

-- funciones: clasificación solo para el servidor
revoke all on function clasificar_procesos(uuid, timestamptz, bigint[]) from public, anon, authenticated;
revoke all on function clasificar_todas(timestamptz) from public, anon, authenticated;
revoke all on function pendientes_documentos(integer) from public, anon, authenticated;
revoke all on function limpiar_procesos_viejos(integer) from public, anon, authenticated;
revoke all on function contar_coincidencias(text[], text[], integer) from public, anon;

-- Control de migraciones
create table if not exists _migraciones (nombre text primary key, aplicada_en timestamptz not null default now());
alter table _migraciones enable row level security;

notify pgrst, 'reload schema';
