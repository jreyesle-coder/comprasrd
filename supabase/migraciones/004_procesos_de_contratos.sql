-- 004 — Historial de adjudicaciones completo.
-- (1) La limpieza ya no borra procesos que tienen contratos (los necesita Competencia).
-- (2) Lista de contratos cuyo proceso no está guardado, para que el sincronizador lo traiga.

create or replace function limpiar_procesos_viejos(p_dias integer default 120) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from procesos p
  where p.fecha_publicacion < now() - make_interval(days => p_dias)
    and not exists (select 1 from coincidencias c where c.proceso_id = p.id)
    and not exists (select 1 from seguimiento s where s.proceso_id = p.id)
    and not exists (select 1 from contratos k where k.codigo_proceso = p.codigo_proceso);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function procesos_faltantes_de_contratos(p_tope integer default 150)
returns table (codigo_proceso text)
language sql stable security definer set search_path = public as $$
  select c.codigo_proceso
  from contratos c
  where not exists (select 1 from procesos p where p.codigo_proceso = c.codigo_proceso)
  group by c.codigo_proceso
  order by max(c.fecha_adjudicacion) desc
  limit p_tope
$$;

revoke all on function procesos_faltantes_de_contratos(integer) from public, anon, authenticated;
revoke all on function limpiar_procesos_viejos(integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
