-- RF-30, RF-62, RF-64: salidas del turno a mano. Ventas con medio entran a la caja; el resto es 'uso'. Stock, alerta,
-- validaciones y permisos.
begin;
select plan(22);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as cerveza from productos where hotel_id = :'h' and clave = 'cerveza' \gset
select id as agua from productos where hotel_id = :'h' and clave = 'agua' \gset
select id as papel from productos where hotel_id = :'h' and clave = 'papel' \gset
update productos set precio_venta_centavos = 250 where id = :'cerveza';
update productos set precio_venta_centavos = 100 where id = :'agua';
select ajustar_stock(:'cerveza', 'conteo', 10);
select ajustar_stock(:'papel', 'conteo', 15);
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');
insert into categorias (hotel_id, nombre) values (:'hb', 'Bebidas') returning id as cb \gset
insert into productos (hotel_id, categoria_id, clave, nombre, unidad, minimo, se_vende, precio_venta_centavos)
  values (:'hb', :'cb', 'cola', 'Cola', 'botella', 1, true, 100) returning id as cola_b \gset

-- ── Antes de anotar ─────────────────────────────────────────────────────────
select tests.como('recepcion@test');
select is((resumen_caja(:'h') ->> 'salidas_registradas')::int, 0, 'sin salidas anotadas: salidas_registradas = 0');

-- ── Ventas y usos ───────────────────────────────────────────────────────────
select registrar_salidas_turno(:'h', jsonb_build_array(
  jsonb_build_object('producto_id', :'cerveza', 'cantidad', 2, 'medio', 'efectivo'),
  jsonb_build_object('producto_id', :'agua', 'cantidad', 1, 'medio', 'transferencia'),
  jsonb_build_object('producto_id', :'papel', 'cantidad', 4),
  jsonb_build_object('producto_id', :'cerveza', 'cantidad', 1))) as r \gset
select is((:'r'::jsonb ->> 'ventas_centavos')::int, 600, 'devuelve el total vendido: 2 cervezas + 1 agua');
select is((select array_agg(x ->> 'tipo') from jsonb_array_elements(:'r'::jsonb -> 'items') x),
  array['venta', 'venta', 'uso', 'uso'], 'separa ventas (con medio) de usos (sin medio)');
select tests.salir();

select results_eq(
  format('select medio::text, cantidad, total_centavos from consumos where hotel_id = %L order by medio', :'h'),
  $$values ('efectivo', 2::numeric, 500), ('transferencia', 1::numeric, 100)$$,
  'las ventas quedan como consumos pagados con su medio');
select results_eq(
  format('select producto_id, cantidad from movimientos_insumo where hotel_id = %L and tipo = %L order by cantidad', :'h', 'uso'),
  format('values (%L::uuid, -4::numeric), (%L::uuid, -1::numeric)', :'papel', :'cerveza'),
  'los usos quedan como movimientos uso con cantidad negativa');
select is((select stock from productos where id = :'cerveza'), 7::numeric, 'la cerveza baja 3 (2 vendidas + 1 usada)');
select is((select stock from productos where id = :'papel'), 11::numeric, 'el papel baja 4');
select is((select count(*)::int from alertas where producto_id = :'papel' and tipo = 'stock_bajo' and resuelta_en is null), 1,
  'el papel bajo el mínimo abre la alerta');
select is((select mensaje from alertas where producto_id = :'papel' and resuelta_en is null), 'Se está acabando Papel higiénico: quedan 11 rollos',
  'la alerta dice cuánto queda, sin cálculo de días');

-- ── Caja ────────────────────────────────────────────────────────────────────
select tests.como('recepcion@test');
select resumen_caja(:'h') as caja \gset
select is((:'caja'::jsonb ->> 'efectivo_centavos')::int, 500, 'la venta en efectivo entra en la caja');
select is((:'caja'::jsonb ->> 'transferencia_centavos')::int, 100, 'la venta por transferencia entra en la caja');
select is((:'caja'::jsonb ->> 'salidas_registradas')::int, 4, 'salidas_registradas cuenta ventas y usos del turno');

-- ── Validaciones (todo o nada) ──────────────────────────────────────────────
prepare cero as select registrar_salidas_turno(:'h', jsonb_build_array(
  jsonb_build_object('producto_id', :'papel', 'cantidad', 1), jsonb_build_object('producto_id', :'agua', 'cantidad', 0)));
select throws_ok('cero', 'P0001', 'La cantidad tiene que ser mayor que 0', 'cantidad 0 no pasa');
select is((select stock from productos where id = :'papel'), 11::numeric, 'si un producto falla no se anota ninguno');
prepare tarjeta as select registrar_salidas_turno(:'h', jsonb_build_array(
  jsonb_build_object('producto_id', :'agua', 'cantidad', 1, 'medio', 'tarjeta')));
select throws_ok('tarjeta', 'P0001', 'La forma de pago es efectivo o transferencia', 'medio inválido no pasa');
prepare ajeno as select registrar_salidas_turno(:'h', jsonb_build_array(jsonb_build_object('producto_id', :'cola_b', 'cantidad', 1)));
select throws_ok('ajeno', 'P0001', 'Ese producto no está activo en este hotel', 'producto de otro hotel no pasa');
select tests.salir();
update productos set activo = false where id = :'agua';
select tests.como('recepcion@test');
prepare inactivo as select registrar_salidas_turno(:'h', jsonb_build_array(jsonb_build_object('producto_id', :'agua', 'cantidad', 1)));
select throws_ok('inactivo', 'P0001', 'Ese producto no está activo en este hotel', 'producto inactivo no pasa');
prepare vacio as select registrar_salidas_turno(:'h', '[]');
select throws_ok('vacio', 'P0001', 'Anota al menos un producto', 'lista vacía no pasa');

-- ── Permisos ────────────────────────────────────────────────────────────────
prepare uso_papel as select registrar_salidas_turno(:'h', jsonb_build_array(jsonb_build_object('producto_id', :'papel', 'cantidad', 1)));
select tests.como('duena@test');
select lives_ok('uso_papel', 'la dueña anota salidas');
select tests.como('limpieza@test');
select throws_ok('uso_papel', 'P0001', null, 'limpieza no anota salidas');
select tests.como('duena-b@test');
select throws_ok('uso_papel', 'P0001', null, 'la dueña de otro hotel no anota salidas aquí');
select tests.salir();
select ok(not has_function_privilege('anon', 'public.registrar_salidas_turno(uuid, jsonb)', 'execute'), 'anon no ejecuta la RPC');

select * from finish();
rollback;
