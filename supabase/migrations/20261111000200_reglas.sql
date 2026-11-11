-- Hotel Andy · reglas de negocio dentro de la base (RNF-04): estados, precios, stock, alertas y auditoría.

create function privado.palabra(e estado_habitacion) returns text language sql immutable set search_path = '' as $$
  select case e when 'libre' then 'Libre' when 'ocupado' then 'Ocupado' when 'por_limpiar' then 'Por limpiar'
    when 'limpiando' then 'Limpiando' when 'mantenimiento' then 'En arreglo' end
$$;

-- RF-22: libre → ocupado → por_limpiar → limpiando → libre; cualquiera → mantenimiento; solo la dueña lo saca.
create function privado.validar_estado() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = old.estado then return new; end if;
  if new.estado <> 'mantenimiento' and old.estado::text || '>' || new.estado::text not in (
    'libre>ocupado', 'ocupado>por_limpiar', 'por_limpiar>limpiando', 'limpiando>libre',
    'limpiando>por_limpiar',  -- deshacer "Empezar"
    'mantenimiento>libre', 'mantenimiento>por_limpiar') then
    raise exception 'Un cuarto "%" no puede pasar a "%"', privado.palabra(old.estado), privado.palabra(new.estado);
  end if;
  if old.estado = 'mantenimiento' and auth.uid() is not null and privado.rol_en(new.hotel_id) is distinct from 'duena' then
    raise exception 'Solo la dueña saca un cuarto de arreglo';
  end if;
  new.estado_desde := now();
  return new;
end $$;
create trigger validar_estado before update of estado on habitaciones
  for each row execute function privado.validar_estado();

-- Temporada de un día: la que lo marca en sus fechas; si ninguna, la base.
create function privado.temporada_de(p_hotel uuid, p_dia date) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.temporadas
  where hotel_id = p_hotel and (es_base or fechas @> p_dia)
  order by es_base, nombre limit 1
$$;

-- Total = suma de la tarifa de cada noche. Null si alguna noche no tiene tarifa (nunca se inventa).
create function privado.cotizar(p_tipo uuid, p_canal canal_venta, p_entrada date, p_salida date) returns int
language sql stable security definer set search_path = '' as $$
  select case when count(*) > 0 and count(*) = count(x.precio) then sum(x.precio)::int end
  from generate_series(p_entrada, p_salida - 1, interval '1 day') d
  left join lateral (
    select t.precio_centavos as precio from public.tarifas t
    where t.tipo_id = p_tipo and t.canal = p_canal
      and (t.temporada_id is null or t.temporada_id = privado.temporada_de(t.hotel_id, d::date))
    order by t.temporada_id nulls last limit 1
  ) x on true
$$;

-- RF-38a / RF-25: congela canal y total, valida capacidad y pone el vencimiento de la pre-reserva.
create function privado.reserva_antes() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tipo uuid;
  v_max int;
begin
  select h.tipo_id, t.max_personas into v_tipo, v_max
  from public.habitaciones h join public.tipos_habitacion t on t.id = h.tipo_id
  where h.id = new.habitacion_id;
  if new.personas > v_max then
    raise exception 'En ese cuarto caben máximo % personas', v_max;
  end if;

  new.canal := coalesce(new.canal, case new.fuente when 'booking' then 'booking' when 'airbnb' then 'airbnb'
    else 'directo' end::public.canal_venta);
  if tg_op = 'INSERT' then
    new.total_centavos := coalesce(new.total_centavos, privado.cotizar(v_tipo, new.canal, new.entrada, new.salida));
  elsif new.total_centavos is not distinct from old.total_centavos
    and (new.entrada, new.salida, new.habitacion_id, new.canal) is distinct from (old.entrada, old.salida, old.habitacion_id, old.canal) then
    new.total_centavos := coalesce(privado.cotizar(v_tipo, new.canal, new.entrada, new.salida), new.total_centavos);
  end if;
  if new.total_centavos is null and new.canal = 'directo' then
    raise exception 'No hay tarifa para esas fechas: cárgala en Configuración';
  end if;

  if new.estado = 'prereserva' then
    new.vence_en := coalesce(new.vence_en, now() + make_interval(hours => coalesce(
      (select (reglas ->> 'prereserva_horas')::int from public.hoteles where id = new.hotel_id), 2)));
  else
    new.vence_en := null;
  end if;
  return new;
end $$;
create trigger reserva_antes before insert or update on reservas
  for each row execute function privado.reserva_antes();

create function privado.huesped_antes() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.telefono := coalesce(privado.normalizar_telefono(new.telefono), new.telefono);
  return new;
end $$;
create trigger huesped_antes before insert or update of telefono on huespedes
  for each row execute function privado.huesped_antes();

-- ── Stock ───────────────────────────────────────────────────────────────────
-- RF-29: el stock solo cambia por un movimiento (este trigger enciende la bandera en su transacción).
create function privado.proteger_stock() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stock is distinct from (case when tg_op = 'UPDATE' then old.stock end)
    and current_setting('privado.mov_stock', true) is distinct from 'si' then
    raise exception 'El stock solo cambia con un movimiento (compra, conteo, merma...): usa ajustar_stock';
  end if;
  return new;
end $$;
create trigger proteger_stock before insert or update of stock on productos
  for each row execute function privado.proteger_stock();

create function privado.plural(p_unidad text, p_cantidad numeric) returns text
language sql immutable set search_path = '' as $$
  select case when p_cantidad = 1 then p_unidad
    when p_unidad ~ '[aeiou]$' then p_unidad || 's'
    when p_unidad ~ '[dlnr]$' then p_unidad || 'es'
    else p_unidad end
$$;

-- Aplica el movimiento al stock y abre/actualiza/cierra la alerta de stock bajo (una sola abierta por producto).
-- Stock null = sin contar: solo una compra o un conteo lo empiezan; las salidas no lo tocan ni alertan.
create function privado.aplicar_movimiento() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.productos;
  v_alcance text;
begin
  select * into p from public.productos where id = new.producto_id for update;
  if p.stock is null and new.tipo not in ('compra', 'conteo') then
    new.stock_resultante := null;
    return new;
  end if;

  new.stock_resultante := coalesce(p.stock, 0) + new.cantidad;
  perform set_config('privado.mov_stock', 'si', true);
  update public.productos set stock = new.stock_resultante where id = p.id;
  perform set_config('privado.mov_stock', '', true);

  if new.stock_resultante < 0 or new.stock_resultante <= p.minimo then
    select coalesce(
      ' (alcanza para unos ' || floor(greatest(new.stock_resultante, 0) / max(k.cantidad))::int || ' cuartos)',
      ' (alcanza para unos ' || floor(greatest(new.stock_resultante, 0) / p.consumo_diario)::int || ' días)', '')
    into v_alcance
    from public.kit_por_tipo k where k.producto_id = p.id and k.por = 'limpieza';

    update public.alertas
    set mensaje = format('⚠️ Se está acabando %s: quedan %s %s%s', p.nombre, trim_scale(new.stock_resultante),
      privado.plural(p.unidad, new.stock_resultante), v_alcance)
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
    if not found then
      insert into public.alertas (hotel_id, tipo, producto_id, mensaje)
      values (p.hotel_id, 'stock_bajo', p.id, format('⚠️ Se está acabando %s: quedan %s %s%s', p.nombre,
        trim_scale(new.stock_resultante), privado.plural(p.unidad, new.stock_resultante), v_alcance));
    end if;
  else
    update public.alertas set resuelta_en = now()
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
  end if;
  return new;
end $$;
create trigger aplicar_movimiento before insert on movimientos_insumo
  for each row execute function privado.aplicar_movimiento();

-- Los movimientos son historial: no se editan ni se borran (se corrigen con otro movimiento).
create function privado.solo_insertar() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial no se edita: registra un movimiento nuevo';
end $$;
create trigger solo_insertar before update or delete on movimientos_insumo
  for each row execute function privado.solo_insertar();
create trigger solo_insertar before update or delete on auditoria
  for each row execute function privado.solo_insertar();

-- ── Auditoría (RF-35) ───────────────────────────────────────────────────────
create function privado.auditar() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  d jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_fila jsonb := coalesce(d, a);
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, a -> k), jsonb_object_agg(k, d -> k) into a, d
    from jsonb_object_keys(d) k where a -> k is distinct from d -> k;
    if d is null then return null; end if;
  end if;
  insert into public.auditoria (hotel_id, tabla, registro_id, accion, antes, despues)
  values ((v_fila ->> 'hotel_id')::uuid, tg_table_name, (v_fila ->> 'id')::uuid, lower(tg_op), a, d);
  return null;
end $$;
create trigger auditar after insert or update or delete on reservas for each row execute function privado.auditar();
create trigger auditar after update of estado on habitaciones for each row execute function privado.auditar();
create trigger auditar after insert or update on pagos for each row execute function privado.auditar();
create trigger auditar after insert or update on compras for each row execute function privado.auditar();

revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
