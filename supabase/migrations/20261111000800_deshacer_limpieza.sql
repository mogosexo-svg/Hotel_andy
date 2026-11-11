-- RF-22, RF-27: deshacer "Empezar" (Limpiando → Por limpiar) para todos los roles; salidas_hoy con personas.
create function public.deshacer_limpieza(p_habitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena,recepcion,limpieza}');
begin
  if h.estado <> 'limpiando' then raise exception 'Ese cuarto no se está limpiando'; end if;
  update public.habitaciones set estado = 'por_limpiar' where id = h.id;
end $$;

revoke execute on function public.deshacer_limpieza(uuid) from public, anon;
grant execute on function public.deshacer_limpieza(uuid) to authenticated, service_role;

create or replace function public.resumen_inicio(p_hotel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoy date := privado.hoy();
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Guayaquil') at time zone 'America/Guayaquil';
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  return (
    select jsonb_build_object(
      'cuartos', count(*),
      'ocupados', count(*) filter (where estado = 'ocupado'),
      'ocupacion_pct', round(100.0 * count(*) filter (where estado = 'ocupado') / nullif(count(*), 0)),
      'por_limpiar', count(*) filter (where estado = 'por_limpiar'),
      'limpiando', count(*) filter (where estado = 'limpiando'),
      'en_arreglo', count(*) filter (where estado = 'mantenimiento'),
      'llegadas_hoy', (select coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'codigo', r.codigo, 'habitacion', h.numero,
          'huesped', g.nombre, 'personas', r.personas, 'estado', r.estado) order by h.numero), '[]')
        from public.reservas r join public.habitaciones h on h.id = r.habitacion_id left join public.huespedes g on g.id = r.huesped_id
        where r.hotel_id = p_hotel and r.entrada = v_hoy and r.estado in ('prereserva', 'confirmada', 'en_curso')),
      'salidas_hoy', (select coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'codigo', r.codigo, 'habitacion', h.numero,
          'huesped', g.nombre, 'personas', r.personas, 'estado', r.estado) order by h.numero), '[]')
        from public.reservas r join public.habitaciones h on h.id = r.habitacion_id left join public.huespedes g on g.id = r.huesped_id
        where r.hotel_id = p_hotel and r.salida = v_hoy and r.estado in ('en_curso', 'finalizada')),
      'insumos_bajos', (select coalesce(jsonb_agg(jsonb_build_object('producto_id', p.id, 'nombre', p.nombre, 'stock', p.stock,
          'minimo', p.minimo, 'unidad', p.unidad) order by p.stock / nullif(p.minimo, 0) nulls first), '[]')
        from public.productos p where p.hotel_id = p_hotel and p.activo and (p.stock < 0 or p.stock <= p.minimo)),
      'dinero_mes_centavos',
        (select coalesce(sum(monto_centavos), 0) from public.pagos where hotel_id = p_hotel and creado_en >= v_mes)
        + (select coalesce(sum(total_centavos), 0) from public.consumos where hotel_id = p_hotel and pagado_en >= v_mes))
    from public.habitaciones where hotel_id = p_hotel and activa);
end $$;
