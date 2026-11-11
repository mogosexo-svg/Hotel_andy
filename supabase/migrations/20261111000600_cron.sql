-- Hotel Andy · tareas programadas (pg_cron). Aparte y tolerante: si pg_cron no está, deja un aviso y sigue.
-- Las funciones ya existen; esto solo las agenda. Horas en UTC (Guayaquil = UTC−5).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('liberar-prereservas', '*/5 * * * *', 'select privado.liberar_prereservas_vencidas()');
  perform cron.schedule('consumo-diario', '5 5 * * *', 'select privado.descontar_consumo_diario()'); -- 00:05 en Guayaquil
exception when others then
  raise notice 'pg_cron no disponible (%): agenda las tareas a mano en producción', sqlerrm;
end $$;
