-- Paso único: permite que el script `npm run migrar` aplique las migraciones usando la service_role key.
-- Solo la service_role puede ejecutarla (anon y usuarios autenticados NO).
-- Pegar en Supabase → SQL Editor → Run.
create or replace function public.exec_sql(sql text) returns void
language plpgsql security definer set search_path = public as $$
begin
  execute sql;
end $$;

revoke all on function public.exec_sql(text) from public, anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;
