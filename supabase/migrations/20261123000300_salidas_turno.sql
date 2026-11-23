-- Hotel Andy · inventario a mano (pedido del cliente, 23 nov 2026). Nada se descuenta solo: antes de cada cierre
-- de caja la recepción anota qué se usó y qué se vendió en el turno (registrar_salidas_turno).
-- kit_por_tipo, productos.consumo_diario y los tipos 'limpieza'/'consumo_diario' se quedan por el historial, sin uso.

-- RF-27: "Listo" deja el cuarto libre y cierra el aviso. Ya no descuenta el kit.
create or replace function public.marcar_listo(p_habitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena,recepcion,limpieza}');
begin
  update public.habitaciones set estado = 'libre' where id = h.id;
  update public.alertas set resuelta_en = now()
  where habitacion_id = h.id and tipo = 'por_limpiar' and resuelta_en is null;
end $$;

-- Sin consumo diario automático.
do $$
begin
  perform cron.unschedule('consumo-diario');
exception when others then
  raise notice 'consumo-diario no estaba agendado (%)', sqlerrm;
end $$;
drop function if exists privado.descontar_consumo_diario();

-- RF-31: alerta simple "Se está acabando X: quedan N" (ya no estima días ni cuartos con el kit o el consumo diario).
create or replace function privado.aplicar_movimiento() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.productos;
  v_mensaje text;
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
    v_mensaje := format('Se está acabando %s: quedan %s %s', p.nombre,
      replace(trim_scale(new.stock_resultante)::text, '.', ','), privado.plural(p.unidad, new.stock_resultante));
    update public.alertas set mensaje = v_mensaje
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
    if not found then
      insert into public.alertas (hotel_id, tipo, producto_id, mensaje) values (p.hotel_id, 'stock_bajo', p.id, v_mensaje);
    end if;
  else
    update public.alertas set resuelta_en = now()
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
  end if;
  return new;
end $$;

-- RF-30 / RF-62: salidas del turno [{producto_id, cantidad, medio?}] en una transacción.
-- Producto que se vende y trae medio → venta pagada (registrar_consumo, entra en la caja). Si no → movimiento 'uso'.
create function public.registrar_salidas_turno(p_hotel uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i jsonb;
  p public.productos;
  v_producto uuid;
  v_cant numeric;
  v_medio public.medio_pago;
  v_consumo uuid;
  v_total int;
  v_ventas int := 0;
  v_items jsonb := '[]';
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Anota al menos un producto';
  end if;

  for i in select * from jsonb_array_elements(p_items) loop
    begin
      v_producto := (i ->> 'producto_id')::uuid;
      v_cant := (i ->> 'cantidad')::numeric;
    exception when others then
      raise exception 'Revisa el producto y la cantidad';
    end;
    if v_cant is null or v_cant <= 0 then raise exception 'La cantidad tiene que ser mayor que 0'; end if;
    if nullif(i ->> 'medio', '') is not null and i ->> 'medio' not in ('efectivo', 'transferencia') then
      raise exception 'La forma de pago es efectivo o transferencia';
    end if;
    v_medio := nullif(i ->> 'medio', '')::public.medio_pago;

    select * into p from public.productos where id = v_producto and hotel_id = p_hotel and activo;
    if not found then raise exception 'Ese producto no está activo en este hotel'; end if;

    if p.se_vende and v_medio is not null then
      v_consumo := public.registrar_consumo(p.id, v_cant, null, v_medio);
      select total_centavos into v_total from public.consumos where id = v_consumo;
      v_ventas := v_ventas + v_total;
      v_items := v_items || jsonb_build_object('producto_id', p.id, 'producto', p.nombre, 'cantidad', v_cant,
        'tipo', 'venta', 'medio', v_medio, 'total_centavos', v_total, 'consumo_id', v_consumo);
    else
      insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota)
      values (p.hotel_id, p.id, 'uso', -v_cant, 'Salida del turno');
      v_items := v_items || jsonb_build_object('producto_id', p.id, 'producto', p.nombre, 'cantidad', v_cant, 'tipo', 'uso');
    end if;
  end loop;

  return jsonb_build_object('ventas_centavos', v_ventas, 'items', v_items);
end $$;

-- resumen_caja + salidas_registradas: movimientos 'uso' y 'venta' desde el último cierre (0 = aún no se anotó nada).
create or replace function public.resumen_caja(p_hotel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t record;
  v_desde timestamptz := privado.desde_caja(p_hotel);
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  select * into t from privado.turno_caja(p_hotel);
  return (
    with m as (select * from privado.movimientos_caja(p_hotel, v_desde, now()))
    select jsonb_build_object(
      'fecha', t.fecha, 'turno', t.turno, 'hora', to_char(t.hora, 'HH24:MI'), 'cerrado', t.cerrado,
      'horas', jsonb_build_object('tarde', to_char(privado.hora_cierre(p_hotel, 'tarde'), 'HH24:MI'),
                                  'noche', to_char(privado.hora_cierre(p_hotel, 'noche'), 'HH24:MI')),
      'desde', v_desde, 'hasta', now(),
      'efectivo_centavos', coalesce(sum(monto_centavos) filter (where medio = 'efectivo'), 0),
      'transferencia_centavos', coalesce(sum(monto_centavos) filter (where medio = 'transferencia'), 0),
      'total_centavos', coalesce(sum(monto_centavos), 0),
      'movimientos_cuenta', count(*),
      'movimientos', coalesce((select jsonb_agg(x order by x.hora desc) from
        (select * from m order by hora desc limit 50) x), '[]'),
      'salidas_registradas', (select count(*) from public.movimientos_insumo mi where mi.hotel_id = p_hotel
        and mi.tipo in ('uso', 'venta') and mi.creado_en > v_desde))
    from m);
end $$;

revoke execute on function public.registrar_salidas_turno(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_salidas_turno(uuid, jsonb) to authenticated, service_role;
