-- Hotel Andy · Calendario público filtrable por tipo de cuarto (el visor "Reservar este cuarto" muestra ESE tipo).
-- p_tipo acepta la clave o el id del tipo (como lo devuelve catalogo_publico). Un tipo desconocido no filtra datos: da 0 libres.
-- Se reemplaza la firma vieja: un parámetro con default dejaría dos sobrecargas ambiguas.
drop function public.calendario_publico(date, date, int, text);

create function public.calendario_publico(p_desde date, p_hasta date, p_personas int, p_hotel text default 'hotel-andy', p_tipo text default null)
returns table (dia date, cuartos_libres int, desde_centavos int, temporada_alta boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_hotel uuid;
begin
  select id into v_hotel from public.hoteles where slug = p_hotel;
  if v_hotel is null then raise exception 'Hotel no encontrado'; end if;
  if p_desde is null or p_hasta is null or p_desde < privado.hoy() - 1 then
    raise exception 'Elige un rango de fechas desde hoy';
  end if;
  if p_hasta <= p_desde or p_hasta - p_desde > 92 then
    raise exception 'El calendario muestra de 1 a 92 días';
  end if;
  if p_personas is null or p_personas not between 1 and 20 then
    raise exception 'Indica cuántas personas son';
  end if;
  -- Las pre-reservas vencidas se ignoran aquí; las libera el cron o la próxima consulta de disponibilidad.
  return query
    select d::date, coalesce(sum(l.libres), 0)::int, min(l.precio)::int,
           exists (select 1 from public.temporadas s where s.id = privado.temporada_de(v_hotel, d::date) and not s.es_base)
    from generate_series(p_desde, p_hasta - 1, interval '1 day') d
    left join lateral (
      select t.id as tipo,
        (select count(*) from public.habitaciones h
         where h.tipo_id = t.id and h.activa and h.estado <> 'mantenimiento'
           and not exists (select 1 from public.reservas r
             where r.habitacion_id = h.id and r.entrada <= d::date and r.salida > d::date
               and (r.estado in ('confirmada', 'en_curso') or (r.estado = 'prereserva' and r.vence_en >= now())))) as libres,
        (select f.precio_centavos from public.tarifas f
         where f.tipo_id = t.id and f.canal = 'directo'
           and (f.temporada_id is null or f.temporada_id = privado.temporada_de(v_hotel, d::date))
         order by f.temporada_id nulls last limit 1) as precio
      from public.tipos_habitacion t where t.hotel_id = v_hotel and t.max_personas >= p_personas
        and (p_tipo is null or t.clave = p_tipo or t.id::text = p_tipo)
    ) l on l.libres > 0
    group by d
    order by d;
end $$;

revoke execute on function public.calendario_publico(date, date, int, text, text) from public;
grant execute on function public.calendario_publico(date, date, int, text, text) to anon, authenticated, service_role;
