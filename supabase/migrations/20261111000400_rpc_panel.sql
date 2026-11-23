-- Hotel Andy · RPC del panel (rol authenticated). Son security definer porque tocan tablas que el rol no
-- escribe directo (stock, pagos, auditoría) en una sola transacción; cada una valida el rol con privado.exigir_rol.

create function privado.reserva_para(p_reserva uuid, p_roles rol_usuario[]) returns reservas
language plpgsql stable security definer set search_path = '' as $$
declare r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva;
  if not found then raise exception 'No encontramos esa reserva'; end if;
  perform privado.exigir_rol(r.hotel_id, p_roles);
  return r;
end $$;

create function privado.habitacion_para(p_habitacion uuid, p_roles rol_usuario[]) returns habitaciones
language plpgsql stable security definer set search_path = '' as $$
declare h public.habitaciones;
begin
  select * into h from public.habitaciones where id = p_habitacion;
  if not found then raise exception 'No encontramos ese cuarto'; end if;
  perform privado.exigir_rol(h.hotel_id, p_roles);
  return h;
end $$;

-- ── Reservas ────────────────────────────────────────────────────────────────

-- Lo que debe la reserva: total, pagado y consumos cargados al cuarto que siguen pendientes.
create function public.cuenta_reserva(p_reserva uuid) returns jsonb
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
  where c.reserva_id = r.id and c.medio is null;
  return jsonb_build_object('total_centavos', r.total_centavos, 'pagado_centavos', v_pagado,
    'consumos_pendientes', v_pendientes, 'consumos_pendientes_centavos', v_pend,
    'saldo_centavos', coalesce(r.total_centavos, 0) + v_pend - v_pagado);
end $$;

create function public.check_in(p_reserva uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
begin
  if r.estado not in ('prereserva', 'confirmada') then
    raise exception 'Esta reserva no está para entrar (está %)', r.estado;
  end if;
  update public.reservas set estado = 'en_curso', check_in_en = now(), check_in_por = auth.uid() where id = r.id;
  update public.habitaciones set estado = 'ocupado' where id = r.habitacion_id;
end $$;

-- RF-26 / RF-62: devuelve la cuenta (con consumos pendientes). Con p_medio_consumos los cobra en el acto.
create function public.check_out(p_reserva uuid, p_medio_consumos medio_pago default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
  v_cuenta jsonb := public.cuenta_reserva(p_reserva);
begin
  if r.estado <> 'en_curso' then raise exception 'Esta reserva no está en curso'; end if;
  if p_medio_consumos is not null then
    update public.consumos set medio = p_medio_consumos, pagado_en = now() where reserva_id = r.id and medio is null;
  end if;
  update public.reservas set estado = 'finalizada', check_out_en = now(), check_out_por = auth.uid() where id = r.id;
  update public.habitaciones set estado = 'por_limpiar' where id = r.habitacion_id;
  insert into public.alertas (hotel_id, tipo, habitacion_id, reserva_id, mensaje)
  select r.hotel_id, 'por_limpiar', h.id, r.id, format('Cuarto %s desocupado, a limpiar', h.numero)
  from public.habitaciones h where h.id = r.habitacion_id;
  return v_cuenta;
end $$;

-- RF-25: registrar el anticipo (o cualquier pago) confirma la pre-reserva.
create function public.registrar_pago(p_reserva uuid, p_monto_centavos int, p_medio medio_pago, p_comprobante_path text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
  v_id uuid;
begin
  if r.estado = 'cancelada' then raise exception 'Esta reserva ya está cancelada o venció'; end if;
  insert into public.pagos (hotel_id, reserva_id, monto_centavos, medio, comprobante_path)
  values (r.hotel_id, r.id, p_monto_centavos, p_medio, p_comprobante_path) returning id into v_id;
  if r.estado = 'prereserva' then
    update public.reservas set estado = 'confirmada' where id = r.id;
  end if;
  return v_id;
end $$;

create function public.cancelar_reserva(p_reserva uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas := privado.reserva_para(p_reserva, '{duena,recepcion}');
begin
  if r.estado not in ('prereserva', 'confirmada') then
    raise exception 'Solo se cancela una reserva que aún no empieza';
  end if;
  update public.reservas set estado = 'cancelada', motivo_cancelacion = p_motivo where id = r.id;
end $$;

-- ── Cuartos y limpieza ──────────────────────────────────────────────────────

create function public.empezar_limpieza(p_habitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena,recepcion,limpieza}');
begin
  update public.habitaciones set estado = 'limpiando' where id = h.id;
end $$;

-- RF-27 / RF-30: "Listo" deja el cuarto libre y descuenta el kit en la misma transacción.
create function public.marcar_listo(p_habitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena,recepcion,limpieza}');
  v_personas int;
begin
  update public.habitaciones set estado = 'libre' where id = h.id;
  -- Toallas × huéspedes de la última estadía; sin estadía previa no se cuentan.
  select personas into v_personas from public.reservas
  where habitacion_id = h.id and estado = 'finalizada' order by check_out_en desc nulls last limit 1;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, habitacion_id)
  select h.hotel_id, k.producto_id, 'limpieza', -k.cantidad * case k.por when 'persona' then v_personas else 1 end, h.id
  from public.kit_por_tipo k join public.productos p on p.id = k.producto_id and p.activo
  where k.tipo_id = h.tipo_id and (k.por = 'limpieza' or v_personas > 0);
  update public.alertas set resuelta_en = now()
  where habitacion_id = h.id and tipo = 'por_limpiar' and resuelta_en is null;
end $$;

-- RF-28: daño con nota y foto → cuarto en arreglo y aviso.
create function public.reportar_dano(p_habitacion uuid, p_nota text, p_foto_path text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena,recepcion,limpieza}');
  v_id uuid;
begin
  insert into public.reportes_mantenimiento (hotel_id, habitacion_id, nota, foto_path)
  values (h.hotel_id, h.id, p_nota, p_foto_path) returning id into v_id;
  update public.habitaciones set estado = 'mantenimiento' where id = h.id;
  insert into public.alertas (hotel_id, tipo, habitacion_id, mensaje)
  values (h.hotel_id, 'mantenimiento', h.id, format('Cuarto %s en arreglo: %s', h.numero, p_nota));
  return v_id;
end $$;

create function public.liberar_mantenimiento(p_habitacion uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.habitaciones := privado.habitacion_para(p_habitacion, '{duena}');
begin
  update public.habitaciones set estado = 'libre' where id = h.id;
  update public.reportes_mantenimiento set resuelto_en = now(), resuelto_por = auth.uid()
  where habitacion_id = h.id and resuelto_en is null;
  update public.alertas set resuelta_en = now()
  where habitacion_id = h.id and tipo = 'mantenimiento' and resuelta_en is null;
end $$;

-- RF-27: vista de la camarera. Sin huésped ni dinero: solo el cuarto y cuándo llega el próximo.
create function public.cuartos_por_limpiar(p_hotel uuid)
returns table (habitacion_id uuid, numero text, piso int, tipo text, estado estado_habitacion, proxima_llegada date, llega_hoy boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion,limpieza}');
  return query
    select h.id, h.numero, h.piso, t.nombre, h.estado, n.entrada, coalesce(n.entrada = privado.hoy(), false)
    from public.habitaciones h
    join public.tipos_habitacion t on t.id = h.tipo_id
    left join lateral (
      select min(r.entrada) as entrada from public.reservas r
      where r.habitacion_id = h.id and r.estado in ('prereserva', 'confirmada') and r.entrada >= privado.hoy()
    ) n on true
    where h.hotel_id = p_hotel and h.estado in ('por_limpiar', 'limpiando')
    order by n.entrada nulls last, h.piso, h.numero;
end $$;

-- ── Inventario y compras ────────────────────────────────────────────────────

-- RF-29: conteo (cantidad = lo que hay), merma (lo que se perdió) o compra suelta (lo que entró).
create function public.ajustar_stock(p_producto uuid, p_tipo tipo_movimiento, p_cantidad numeric, p_nota text default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  p public.productos;
  v_stock numeric;
begin
  select * into p from public.productos where id = p_producto for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  perform privado.exigir_rol(p.hotel_id, '{duena,recepcion}');
  if p_tipo not in ('conteo', 'merma', 'compra') then raise exception 'El ajuste es conteo, merma o compra'; end if;
  if p_cantidad is null or p_cantidad < 0 or (p_tipo <> 'conteo' and p_cantidad = 0) then
    raise exception 'Revisa la cantidad';
  end if;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota)
  values (p.hotel_id, p.id, p_tipo,
    case p_tipo when 'conteo' then p_cantidad - coalesce(p.stock, 0) when 'merma' then -p_cantidad else p_cantidad end, p_nota)
  returning stock_resultante into v_stock;
  return v_stock;
end $$;

-- RF-29a: cabecera + líneas [{producto_id, cantidad, costo_unit_centavos}] en una llamada. Suma stock y guarda costo.
create function public.cargar_factura(p_hotel uuid, p_proveedor text, p_numero text, p_fecha date, p_lineas jsonb,
  p_foto_path text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La factura necesita al menos un producto';
  end if;
  insert into public.compras (hotel_id, proveedor, numero_factura, fecha, foto_path, total_centavos)
  values (p_hotel, p_proveedor, nullif(trim(p_numero), ''), p_fecha, p_foto_path,
    (select sum(round((l ->> 'cantidad')::numeric * (l ->> 'costo_unit_centavos')::int)) from jsonb_array_elements(p_lineas) l))
  returning id into v_id;
  insert into public.compras_lineas (hotel_id, compra_id, producto_id, cantidad, costo_unit_centavos)
  select p_hotel, v_id, (l ->> 'producto_id')::uuid, (l ->> 'cantidad')::numeric, (l ->> 'costo_unit_centavos')::int
  from jsonb_array_elements(p_lineas) l;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, compra_id)
  select p_hotel, producto_id, 'compra', cantidad, v_id from public.compras_lineas where compra_id = v_id;
  update public.productos p set precio_compra_centavos = l.costo_unit_centavos
  from public.compras_lineas l where l.compra_id = v_id and p.id = l.producto_id;
  return v_id;
end $$;

create function public.anular_factura(p_compra uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.compras;
begin
  select * into c from public.compras where id = p_compra for update;
  if not found then raise exception 'No encontramos esa factura'; end if;
  perform privado.exigir_rol(c.hotel_id, '{duena}');
  if c.anulada_en is not null then raise exception 'Esa factura ya está anulada'; end if;
  update public.compras set anulada_en = now(), anulada_por = auth.uid(), motivo_anulacion = p_motivo where id = c.id;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, compra_id, nota)
  select c.hotel_id, producto_id, 'anulacion', -cantidad, c.id, p_motivo from public.compras_lineas where compra_id = c.id;
end $$;

-- ── Ventas ──────────────────────────────────────────────────────────────────

-- RF-62: o se carga al cuarto (p_reserva) o se paga ya (p_medio). Descuenta stock.
create function public.registrar_consumo(p_producto uuid, p_cantidad numeric, p_reserva uuid default null,
  p_medio medio_pago default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.productos;
  v_id uuid;
begin
  select * into p from public.productos where id = p_producto;
  if not found then raise exception 'No encontramos ese producto'; end if;
  perform privado.exigir_rol(p.hotel_id, '{duena,recepcion}');
  if not (p.se_vende and p.activo) then raise exception '% no está a la venta', p.nombre; end if;
  if p.precio_venta_centavos is null then raise exception 'Ponle precio de venta a % primero', p.nombre; end if;
  if (p_reserva is null) = (p_medio is null) then raise exception 'Elige: cargar al cuarto o pagado ya'; end if;
  if p_reserva is not null and not exists (select 1 from public.reservas where id = p_reserva and hotel_id = p.hotel_id
                                           and estado in ('confirmada', 'en_curso')) then
    raise exception 'Esa reserva no está activa';
  end if;
  insert into public.consumos (hotel_id, producto_id, cantidad, precio_unit_centavos, costo_unit_centavos, reserva_id, medio, pagado_en)
  values (p.hotel_id, p.id, p_cantidad, p.precio_venta_centavos, p.precio_compra_centavos, p_reserva, p_medio,
    case when p_medio is not null then now() end)
  returning id into v_id;
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, consumo_id)
  values (p.hotel_id, p.id, 'venta', -p_cantidad, v_id);
  return v_id;
end $$;

-- RF-63: ventas del día por producto, categoría y forma de pago, con margen. Día en hora de Guayaquil.
create function public.cuadre_dia(p_hotel uuid, p_fecha date default null) returns jsonb
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
      where c.hotel_id = p_hotel and (c.creado_en at time zone 'America/Guayaquil')::date = v_dia
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

-- ── Inicio de la dueña y gráficos ───────────────────────────────────────────

-- RF-36: lo que se entiende en 5 segundos.
create function public.resumen_inicio(p_hotel uuid) returns jsonb
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
          'huesped', g.nombre, 'estado', r.estado) order by h.numero), '[]')
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

-- Gráficos: por día y canal, cuartos ocupados e ingresos (total de la reserva repartido por noche).
create function public.ocupacion_ingresos(p_hotel uuid, p_dias int default 30)
returns table (dia date, canal canal_venta, cuartos_ocupados int, cuartos_totales int, ingresos_centavos int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_total int := (select count(*) from public.habitaciones where hotel_id = p_hotel and activa);
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  if p_dias not between 1 and 366 then raise exception 'Elige entre 1 y 366 días'; end if;
  return query
    select d.dia, c.canal, count(r.id)::int, v_total,
           coalesce(sum(round(r.total_centavos::numeric / (r.salida - r.entrada))), 0)::int
    from (select g::date as dia from generate_series(privado.hoy() - p_dias + 1, privado.hoy(), interval '1 day') g) d
    cross join unnest(enum_range(null::public.canal_venta)) c (canal)
    left join public.reservas r on r.hotel_id = p_hotel and r.canal = c.canal
      and r.estado in ('confirmada', 'en_curso', 'finalizada') and d.dia >= r.entrada and d.dia < r.salida
    group by d.dia, c.canal
    order by d.dia, c.canal;
end $$;

-- ── Tareas programadas ──────────────────────────────────────────────────────

-- RF-30: consumo diario (cloro). Idempotente: una vez por producto y día.
create function privado.descontar_consumo_diario() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota)
  select p.hotel_id, p.id, 'consumo_diario', -p.consumo_diario, 'Consumo diario'
  from public.productos p
  where p.consumo_diario is not null and p.activo
    and not exists (select 1 from public.movimientos_insumo m where m.producto_id = p.id and m.tipo = 'consumo_diario'
                    and (m.creado_en at time zone 'America/Guayaquil')::date = privado.hoy());
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.catalogo_publico(text), public.consultar_disponibilidad(date, date, int, text),
  public.crear_prereserva(uuid, date, date, int, text, text, boolean, boolean, text) to anon, authenticated;
grant execute on function
  public.cuenta_reserva(uuid), public.check_in(uuid), public.check_out(uuid, medio_pago),
  public.registrar_pago(uuid, int, medio_pago, text), public.cancelar_reserva(uuid, text),
  public.empezar_limpieza(uuid), public.marcar_listo(uuid), public.reportar_dano(uuid, text, text),
  public.liberar_mantenimiento(uuid), public.cuartos_por_limpiar(uuid),
  public.ajustar_stock(uuid, tipo_movimiento, numeric, text), public.cargar_factura(uuid, text, text, date, jsonb, text),
  public.anular_factura(uuid, text), public.registrar_consumo(uuid, numeric, uuid, medio_pago),
  public.cuadre_dia(uuid, date), public.resumen_inicio(uuid), public.ocupacion_ingresos(uuid, int)
  to authenticated;
grant execute on all functions in schema public to service_role;
