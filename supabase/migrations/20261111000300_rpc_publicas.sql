-- Hotel Andy · RPC públicas (web y bot, rol anon). La web no lee tablas: solo esto, con lo mínimo.

-- RF-25: libera las pre-reservas vencidas. La llaman el cron y cada consulta pública.
create function privado.liberar_prereservas_vencidas() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.reservas set estado = 'cancelada', motivo_cancelacion = 'Pre-reserva vencida: no llegó el anticipo'
  where estado = 'prereserva' and vence_en < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Cuartos que se pueden ofrecer: activos, no en arreglo y sin reserva activa que choque.
create function privado.cuartos_libres(p_hotel uuid, p_entrada date, p_salida date) returns setof habitaciones
language sql stable security definer set search_path = '' as $$
  select h.* from public.habitaciones h
  where h.hotel_id = p_hotel and h.activa and h.estado <> 'mantenimiento'
    and not exists (
      select 1 from public.reservas r
      where r.habitacion_id = h.id and r.estado in ('prereserva', 'confirmada', 'en_curso')
        and daterange(r.entrada, r.salida) && daterange(p_entrada, p_salida))
$$;

create function privado.hotel_publico(p_slug text, p_entrada date, p_salida date, p_personas int) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.hoteles where slug = p_slug;
  if v_id is null then raise exception 'Hotel no encontrado'; end if;
  if p_entrada is null or p_salida is null or p_entrada < privado.hoy() then
    raise exception 'Elige una fecha de entrada desde hoy';
  end if;
  if p_salida <= p_entrada or p_salida - p_entrada > 30 then
    raise exception 'La estadía debe ser de 1 a 30 noches';
  end if;
  if p_personas is null or p_personas not between 1 and 20 then
    raise exception 'Indica cuántas personas son';
  end if;
  return v_id;
end $$;

-- RF-02 / RF-04: tipos con "desde" (temporada base, canal directo) y reglas públicas. Nada privado.
create function public.catalogo_publico(p_hotel text default 'hotel-andy') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'hotel', jsonb_build_object(
      'nombre', h.nombre, 'ciudad', h.ciudad, 'provincia', h.provincia, 'telefono', h.telefono, 'dominio', h.dominio,
      'check_in', to_char(h.check_in, 'HH24:MI'), 'check_out', to_char(h.check_out, 'HH24:MI'),
      'booking', jsonb_build_object('calificacion', h.booking_calificacion, 'resenas', h.booking_resenas),
      'reglas', h.reglas),
    'tipos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'clave', t.clave, 'nombre', t.nombre, 'max_personas', t.max_personas, 'descripcion', t.descripcion,
        'cuartos', (select count(*) from public.habitaciones x where x.tipo_id = t.id and x.activa),
        'desde_centavos', (select min(f.precio_centavos) from public.tarifas f
                           left join public.temporadas s on s.id = f.temporada_id
                           where f.tipo_id = t.id and f.canal = 'directo' and (s.es_base or f.temporada_id is null)))
        order by t.orden)
      from public.tipos_habitacion t where t.hotel_id = h.id), '[]'))
  from public.hoteles h where h.slug = p_hotel
$$;

-- RF-03: tipos con cuartos libres para esas fechas y personas, con el total exacto (canal directo).
create function public.consultar_disponibilidad(p_entrada date, p_salida date, p_personas int, p_hotel text default 'hotel-andy')
returns table (tipo_id uuid, clave text, nombre text, max_personas int, cuartos_libres int, noches int, total_centavos int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_hotel uuid := privado.hotel_publico(p_hotel, p_entrada, p_salida, p_personas);
begin
  perform privado.liberar_prereservas_vencidas();
  return query
    select x.* from (
      select t.id, t.clave, t.nombre, t.max_personas, count(*)::int, p_salida - p_entrada,
             privado.cotizar(t.id, 'directo', p_entrada, p_salida) as total
      from privado.cuartos_libres(v_hotel, p_entrada, p_salida) h
      join public.tipos_habitacion t on t.id = h.tipo_id
      where t.max_personas >= p_personas
      group by t.id
    ) x
    where x.total is not null
    order by x.total;
end $$;

-- RF-25 / RF-11: pre-reserva desde la web o el bot. Consentimiento LOPDP obligatorio. Vence a las 2 h.
create function public.crear_prereserva(
  p_tipo_id uuid, p_entrada date, p_salida date, p_personas int,
  p_nombre text, p_telefono text, p_consentimiento boolean,
  p_mascota boolean default false, p_hotel text default 'hotel-andy'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hotel uuid := privado.hotel_publico(p_hotel, p_entrada, p_salida, p_personas);
  v_tel text := privado.normalizar_telefono(p_telefono);
  v_huesped uuid;
  v_hab uuid;
  v_res public.reservas;
begin
  if p_consentimiento is not true then
    raise exception 'Necesitamos tu permiso para guardar tus datos (aviso de privacidad)';
  end if;
  if length(trim(coalesce(p_nombre, ''))) not between 2 and 100 then raise exception 'Escribe tu nombre'; end if;
  if v_tel is null then raise exception 'Revisa tu número de teléfono'; end if;

  perform privado.liberar_prereservas_vencidas();
  -- shortcut: topes fijos contra abuso (2 pre-reservas activas por teléfono, 10 de la web por hotel); subirlos a config si molestan.
  if (select count(*) from public.reservas r join public.huespedes g on g.id = r.huesped_id
      where r.hotel_id = v_hotel and r.estado = 'prereserva' and g.telefono = v_tel) >= 2 then
    raise exception 'Ya tienes pre-reservas pendientes: escríbenos por WhatsApp';
  end if;
  if (select count(*) from public.reservas where hotel_id = v_hotel and estado = 'prereserva' and fuente = 'web') >= 10 then
    raise exception 'Ahora no podemos apartar más cuartos por la web: escríbenos por WhatsApp';
  end if;
  if not exists (select 1 from public.tipos_habitacion where id = p_tipo_id and hotel_id = v_hotel and max_personas >= p_personas) then
    raise exception 'Ese tipo de cuarto no es para % personas', p_personas;
  end if;

  select id into v_huesped from public.huespedes where hotel_id = v_hotel and telefono = v_tel order by creado_en limit 1;
  if v_huesped is null then
    insert into public.huespedes (hotel_id, nombre, telefono, consentimiento_en)
    values (v_hotel, trim(p_nombre), v_tel, now()) returning id into v_huesped;
  else
    update public.huespedes set consentimiento_en = now() where id = v_huesped;
  end if;

  for v_hab in
    select h.id from privado.cuartos_libres(v_hotel, p_entrada, p_salida) h where h.tipo_id = p_tipo_id order by h.piso, h.numero
  loop
    begin
      insert into public.reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, mascota, estado, fuente)
      values (v_hotel, v_hab, v_huesped, p_entrada, p_salida, p_personas, coalesce(p_mascota, false), 'prereserva', 'web')
      returning * into v_res;
      return jsonb_build_object('codigo', v_res.codigo, 'vence_en', v_res.vence_en, 'total_centavos', v_res.total_centavos,
        'entrada', v_res.entrada, 'salida', v_res.salida, 'noches', v_res.salida - v_res.entrada);
    exception when exclusion_violation then
      null; -- otra pre-reserva tomó este cuarto en el mismo instante: probar el siguiente
    end;
  end loop;
  raise exception 'Ya no quedan cuartos de ese tipo para esas fechas';
end $$;

revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.catalogo_publico(text), public.consultar_disponibilidad(date, date, int, text),
  public.crear_prereserva(uuid, date, date, int, text, text, boolean, boolean, text) to anon, authenticated, service_role;
