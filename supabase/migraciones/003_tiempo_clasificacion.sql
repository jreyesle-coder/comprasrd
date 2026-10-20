-- 003 — El servidor (service_role) puede correr consultas largas (clasificación y limpieza).
alter role service_role set statement_timeout = '600s';
notify pgrst, 'reload config';
