-- Cierres de caja (tarde y noche): resumen por medio, cierre encadenado, alerta, mensaje de WhatsApp y permisos.
begin;
select plan(48);

select id as h, nombre as hotel from hoteles where slug = 'hotel-andy' \gset
select id as r101 from habitaciones where hotel_id = :'h' and numero = '101' \gset
select id as r102 from habitaciones where hotel_id = :'h' and numero = '102' \gset
select id as cerveza from productos where hotel_id = :'h' and clave = 'cerveza' \gset
select id as agua from productos where hotel_id = :'h' and clave = 'agua' \gset
update productos set precio_venta_centavos = 250 where id = :'cerveza';
update productos set precio_venta_centavos = 100 where id = :'agua';
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');

-- ── Configuración ───────────────────────────────────────────────────────────
select is((select reglas -> 'cierres_caja' from hoteles where id = :'h'), '{"tarde": "15:00", "noche": "22:00"}'::jsonb,
  'las horas salen del seed (data/hotel.json)');
select is(privado.hora_cierre(:'hb', 'noche'), '22:00'::time, 'hotel sin horas: 22:00 por defecto');

-- ── Aviso ───────────────────────────────────────────────────────────────────
select is(privado.avisar_cierres_caja((privado.hoy() + time '14:59') at time zone 'America/Guayaquil'), 0, 'antes de las 15:00 no avisa');
select privado.avisar_cierres_caja((privado.hoy() + time '15:05') at time zone 'America/Guayaquil');
select privado.avisar_cierres_caja((privado.hoy() + time '15:10') at time zone 'America/Guayaquil');
select is((select array_agg(mensaje) from alertas where hotel_id = :'h' and tipo = 'cierre_caja' and resuelta_en is null),
  array['Toca el cierre de la tarde'], 'pasadas las 15:00 avisa la tarde, una sola vez aunque el cron pase dos veces');
select privado.avisar_cierres_caja((privado.hoy() + time '22:05') at time zone 'America/Guayaquil');
select is((select count(*)::int from alertas where hotel_id = :'h' and tipo = 'cierre_caja' and resuelta_en is null), 2,
  'pasadas las 22:00 suma la de la noche');
prepare duplicada as insert into alertas (hotel_id, tipo, mensaje, caja_fecha, caja_turno)
  values (:'h', 'cierre_caja', 'otra', privado.hoy(), 'tarde');
select throws_ok('duplicada', '23505', null, 'nunca dos alertas abiertas del mismo turno y fecha');

-- ── Movimientos ─────────────────────────────────────────────────────────────
-- Cierre de anoche hace 10 h: el de hoy arranca ahí.
insert into cierres_caja (hotel_id, turno, fecha, desde, hasta, efectivo_esperado_centavos, transferencia_centavos,
  efectivo_contado_centavos, mensaje)
values (:'h', 'noche', privado.hoy() - 1, now() - interval '20 hours', now() - interval '10 hours', 0, 0, 0, 'x');
insert into huespedes (hotel_id, nombre, telefono) values (:'h', 'Ana Pérez', '0991234567') returning id as ana \gset
insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r101', :'ana', privado.hoy(), privado.hoy() + 2, 2, 'confirmada', 'telefono') returning id as res, codigo as cod \gset
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r102', privado.hoy(), privado.hoy() + 1, 1, 'confirmada', 'telefono');
select check_in(:'res');
insert into pagos (hotel_id, reserva_id, monto_centavos, medio, creado_en) values
  (:'h', :'res', 5000, 'efectivo', now() - interval '5 hours'),
  (:'h', :'res', 3000, 'transferencia', now() - interval '5 hours'),
  (:'h', :'res', 999, 'efectivo', now() - interval '11 hours');  -- ya entró en el cierre de anoche
select registrar_consumo(:'cerveza', 2, null, 'efectivo');
select registrar_consumo(:'agua', 1, null, 'transferencia');
select registrar_consumo(:'cerveza', 1, :'res', null);             -- al cuarto: aún no es caja
select registrar_consumo(:'agua', 3, null, 'efectivo') as anulado \gset
select anular_consumo(:'anulado', 'Error');
update consumos set creado_en = now() - interval '4 hours', pagado_en = case when medio is not null then now() - interval '4 hours' end
  where hotel_id = :'h';

select tests.como('recepcion@test');
select resumen_caja(:'h') as r1 \gset
select is((:'r1'::jsonb ->> 'efectivo_centavos')::int, 5000 + 500, 'efectivo: pagos + ventas en efectivo (sin anuladas ni lo de anoche)');
select is((:'r1'::jsonb ->> 'transferencia_centavos')::int, 3000 + 100, 'transferencia: pagos + ventas por transferencia');
select is((:'r1'::jsonb ->> 'total_centavos')::int, 8600, 'total = efectivo + transferencia; lo cargado al cuarto no cuenta');
select is((:'r1'::jsonb ->> 'movimientos_cuenta')::int, 4, 'detalle: 2 pagos + 2 ventas cobradas');
select ok((:'r1'::jsonb -> 'movimientos') @> jsonb_build_array(jsonb_build_object(
  'concepto', 'Pago reserva ' || :'cod' || ' · cuarto 101', 'medio', 'efectivo', 'monto_centavos', 5000)), 'el detalle trae concepto, medio y monto');
select ok((:'r1'::jsonb -> 'movimientos') @> '[{"concepto": "2 Cervezas", "monto_centavos": 500}]', 'las ventas salen con cantidad y producto');
select is(:'r1'::jsonb ->> 'turno', 'tarde', 'sin cierres hoy toca la tarde');
select is(:'r1'::jsonb ->> 'hora', '15:00', 'con su hora');
select is((:'r1'::jsonb ->> 'cerrado')::boolean, false, 'y no está cerrada');
select is((:'r1'::jsonb ->> 'desde')::timestamptz, now() - interval '10 hours', 'cuenta desde el último cierre');

-- ── Cierre de la tarde ──────────────────────────────────────────────────────
select cerrar_caja(:'h', 'tarde', 5300, '  Faltó cambio  ') as c1 \gset
select is((:'c1'::jsonb ->> 'efectivo_esperado_centavos')::int || '|' || (:'c1'::jsonb ->> 'transferencia_centavos') || '|'
  || (:'c1'::jsonb ->> 'total_centavos'), '5500|3100|8600', 'el servidor recalcula los montos');
select is((:'c1'::jsonb ->> 'diferencia_centavos')::int, -200, 'diferencia con signo: faltan 2 dólares');
select is((:'c1'::jsonb ->> 'cerrado_por')::uuid, :'u_rec'::uuid, 'guarda quién cerró');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 1) like '*Cierre de la tarde · ' || :'hotel' || ' · % %, __:__*', true,
  'título con turno, hotel, día y hora');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 2), 'Entró: $86,00 (efectivo $55,00 · transferencias $31,00)', 'línea de lo que entró');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 3), 'Caja: contado $53,00, faltan $2,00', 'faltan');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 4), 'Ventas: 3 Cervezas, 1 Agua ($8,50)',
  'ventas por producto: incluye lo cargado al cuarto, no las anuladas');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 5), 'Habitaciones: 1 ocupada de '
  || (select count(*) from habitaciones where hotel_id = :'h' and activa) || ' · 1 llegada pendiente hoy', 'ocupadas y llegadas pendientes');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 6), 'Cerró: Recepción', 'quién cerró');
select is(split_part(:'c1'::jsonb ->> 'mensaje', e'\n', 7), 'Nota: Faltó cambio', 'la nota al final, limpia');
select is((select mensaje from cierres_caja where id = (:'c1'::jsonb ->> 'id')::uuid), :'c1'::jsonb ->> 'mensaje', 'el mensaje queda guardado');
prepare dos_veces as select cerrar_caja(:'h', 'tarde', 0, null);
select throws_ok('dos_veces', 'P0001', 'El cierre de la tarde ya se hizo hoy', 'no se cierra dos veces el mismo turno');
prepare sin_contado as select cerrar_caja(:'h', 'noche', null, null);
select throws_ok('sin_contado', 'P0001', 'Escribe cuánto efectivo hay contado en la caja', 'el contado es obligatorio');
select tests.salir();
select is((select array_agg(caja_turno) from alertas where hotel_id = :'h' and tipo = 'cierre_caja' and resuelta_en is null),
  array['noche'], 'cerrar la tarde resuelve su alerta; la de la noche sigue');
select privado.avisar_cierres_caja((privado.hoy() + time '22:10') at time zone 'America/Guayaquil');
select is((select count(*)::int from alertas where hotel_id = :'h' and tipo = 'cierre_caja' and caja_turno = 'tarde'), 1,
  'ya cerrada, la tarde no se vuelve a avisar');

-- ── Cierre de la noche: parte donde terminó la tarde ────────────────────────
update cierres_caja set hasta = now() - interval '2 hours' where id = (:'c1'::jsonb ->> 'id')::uuid;
insert into pagos (hotel_id, reserva_id, monto_centavos, medio, creado_en) values (:'h', :'res', 1000, 'efectivo', now() - interval '1 hour');
select tests.como('duena@test');
select is((resumen_caja(:'h') ->> 'turno'), 'noche', 'cerrada la tarde, toca la noche');
select cerrar_caja(:'h', 'noche', 1500, null) as c2 \gset
select tests.salir();
select is((:'c2'::jsonb ->> 'desde')::timestamptz, now() - interval '2 hours', 'el segundo cierre parte donde terminó el primero');
select is((:'c2'::jsonb ->> 'efectivo_esperado_centavos')::int, 1000, 'y solo cuenta lo que entró después');
select is((:'c2'::jsonb ->> 'diferencia_centavos')::int, 500, 'diferencia con signo: sobran 5 dólares');
select is(split_part(:'c2'::jsonb ->> 'mensaje', e'\n', 3), 'Caja: contado $15,00, sobran $5,00', 'sobran');
select is(split_part(:'c2'::jsonb ->> 'mensaje', e'\n', 4) like 'Habitaciones:%', true, 'sin ventas no hay línea de Ventas');
select is((select count(*)::int from alertas where hotel_id = :'h' and tipo = 'cierre_caja' and resuelta_en is null), 0,
  'cerrar la noche resuelve su alerta');
select tests.como('recepcion@test');
select is((resumen_caja(:'h') ->> 'cerrado')::boolean, true, 'los dos cierres hechos: cerrado');
prepare tarde_tarde as select cerrar_caja(:'h', 'tarde', 0, null);
select throws_ok('tarde_tarde', 'P0001', 'El cierre de la tarde ya se hizo hoy', 'tampoco la tarde otra vez');

-- ── Permisos ────────────────────────────────────────────────────────────────
prepare directo as insert into cierres_caja (hotel_id, turno, fecha, desde, hasta, efectivo_esperado_centavos,
  transferencia_centavos, efectivo_contado_centavos, mensaje) values (:'h', 'tarde', privado.hoy() + 1, now(), now(), 0, 0, 0, 'x');
select throws_ok('directo', '42501', null, 'nadie escribe cierres directo: solo por RPC');
select tests.como('limpieza@test');
select is((select count(*)::int from cierres_caja), 0, 'limpieza no ve los cierres');
prepare resumen_limpieza as select resumen_caja(:'h');
select throws_ok('resumen_limpieza', 'P0001', null, 'limpieza no abre el resumen de caja');
prepare cierre_limpieza as select cerrar_caja(:'h', 'tarde', 0, null);
select throws_ok('cierre_limpieza', 'P0001', null, 'limpieza no cierra caja');
select tests.como('duena-b@test');
select is((select count(*)::int from cierres_caja), 0, 'otro hotel no ve los cierres');
prepare resumen_ajeno as select resumen_caja(:'h');
select throws_ok('resumen_ajeno', 'P0001', null, 'otro hotel no abre el resumen');
-- Caja sin movimientos que cuadra (hotel B)
select is(split_part(cerrar_caja(:'hb', 'tarde', 0, null) ->> 'mensaje', e'\n', 3), 'Caja: contado $0,00, cuadra', 'cuadra');
select tests.anon();
prepare anon_resumen as select resumen_caja(:'h');
select throws_ok('anon_resumen', '42501', null, 'anon no llama resumen_caja');
select tests.salir();

select * from finish();
rollback;
