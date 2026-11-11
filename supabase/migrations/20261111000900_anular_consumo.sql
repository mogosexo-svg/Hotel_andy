-- RF-62/RF-63: anular una venta (historial, no se borra) y alertas de stock con coma decimal.
alter table public.consumos
  add column anulado_en timestamptz,
  add column anulado_por uuid,
  add column motivo_anulacion text;

create function public.anular_consumo(p_consumo uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.consumos;
begin
  select * into c from public.consumos where id = p_consumo for update;
  if not found then raise exception 'No encontramos esa venta'; end if;
  perform privado.exigir_rol(c.hotel_id, '{duena,recepcion}');
  if c.anulado_en is not null then raise exception 'Esa venta ya está anulada'; end if;
  update public.consumos set anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = p_motivo where id = c.id;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, consumo_id, nota)
  values (c.hotel_id, c.producto_id, 'anulacion', c.cantidad, c.id, coalesce(p_motivo, 'Venta anulada'));
end $$;

create or replace function public.cuenta_reserva(p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
  v_pagado int := (select coalesce(sum(monto_centavos), 0) from public.pagos where reserva_id = r.id);
  v_pendientes jsonb;
  v_pend int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'producto', p.nombre, 'cantidad', c.cantidad,
           'total_centavos', c.total_centavos, 'creado_en', c.creado_en) order by c.creado_en), '[]'),
         coalesce(sum(c.total_centavos), 0)
  into v_pendientes, v_pend
  from public.consumos c join public.productos p on p.id = c.producto_id
  where c.reserva_id = r.id and c.medio is null and c.anulado_en is null;
  return jsonb_build_object('total_centavos', r.total_centavos, 'pagado_centavos', v_pagado,
    'consumos_pendientes', v_pendientes, 'consumos_pendientes_centavos', v_pend,
    'saldo_centavos', coalesce(r.total_centavos, 0) + v_pend - v_pagado);
end $$;

create or replace function public.check_out(p_reserva uuid, p_medio_consumos medio_pago default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
  v_cuenta jsonb := public.cuenta_reserva(p_reserva);
begin
  if r.estado <> 'en_curso' then raise exception 'Esta reserva no está en curso'; end if;
  if p_medio_consumos is not null then
    update public.consumos set medio = p_medio_consumos, pagado_en = now() where reserva_id = r.id and medio is null and anulado_en is null;
  end if;
  update public.reservas set estado = 'finalizada', check_out_en = now(), check_out_por = auth.uid() where id = r.id;
  update public.habitaciones set estado = 'por_limpiar' where id = r.habitacion_id;
  insert into public.alertas (hotel_id, tipo, habitacion_id, reserva_id, mensaje)
  select r.hotel_id, 'por_limpiar', h.id, r.id, format('Cuarto %s desocupado, a limpiar', h.numero)
  from public.habitaciones h where h.id = r.habitacion_id;
  return v_cuenta;
end $$;

create or replace function public.cuadre_dia(p_hotel uuid, p_fecha date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_dia date := coalesce(p_fecha, privado.hoy());
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  return (
    with c as (
      select c.*, p.nombre as producto, k.nombre as categoria,
             round(c.cantidad * coalesce(c.costo_unit_centavos, 0))::int as costo
      from public.consumos c
      join public.productos p on p.id = c.producto_id
      join public.categorias k on k.id = p.categoria_id
      where c.hotel_id = p_hotel and c.anulado_en is null and (c.creado_en at time zone 'America/Guayaquil')::date = v_dia
    )
    select jsonb_build_object(
      'fecha', v_dia,
      'total_centavos', coalesce(sum(total_centavos), 0),
      'costo_centavos', coalesce(sum(costo), 0),
      'margen_centavos', coalesce(sum(total_centavos - costo), 0),
      'sin_costo', count(*) filter (where costo_unit_centavos is null),
      'por_producto', coalesce((select jsonb_agg(x order by x.total_centavos desc) from (
        select producto, categoria, sum(cantidad) as cantidad, sum(total_centavos) as total_centavos,
               sum(total_centavos - costo) as margen_centavos from c group by producto, categoria) x), '[]'),
      'por_categoria', coalesce((select jsonb_agg(x order by x.total_centavos desc) from (
        select categoria, sum(total_centavos) as total_centavos from c group by categoria) x), '[]'),
      'por_medio', coalesce((select jsonb_agg(x order by x.medio) from (
        select coalesce(medio::text, 'al_cuarto') as medio, sum(total_centavos) as total_centavos from c group by 1) x), '[]'))
    from c);
end $$;

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
        + (select coalesce(sum(total_centavos), 0) from public.consumos where hotel_id = p_hotel and anulado_en is null and pagado_en >= v_mes))
    from public.habitaciones where hotel_id = p_hotel and activa);
end $$;

-- Alerta de stock: decimales con coma ("1,5 kg").
create or replace function privado.aplicar_movimiento() returns trigger language plpgsql security definer set search_path = '' as $$
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
    set mensaje = format('⚠️ Se está acabando %s: quedan %s %s%s', p.nombre, replace(trim_scale(new.stock_resultante)::text, '.', ','),
      privado.plural(p.unidad, new.stock_resultante), v_alcance)
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
    if not found then
      insert into public.alertas (hotel_id, tipo, producto_id, mensaje)
      values (p.hotel_id, 'stock_bajo', p.id, format('⚠️ Se está acabando %s: quedan %s %s%s', p.nombre,
        replace(trim_scale(new.stock_resultante)::text, '.', ','), privado.plural(p.unidad, new.stock_resultante), v_alcance));
    end if;
  else
    update public.alertas set resuelta_en = now()
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
  end if;
  return new;
end $$;

update public.alertas set mensaje = regexp_replace(mensaje, '(\d)\.(\d)', '\1,\2', 'g')
where tipo = 'stock_bajo' and resuelta_en is null;

revoke execute on function public.anular_consumo(uuid, text) from public, anon;
grant execute on function public.anular_consumo(uuid, text) to authenticated, service_role;
