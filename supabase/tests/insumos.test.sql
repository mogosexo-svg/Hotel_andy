-- RF-27, RF-29, RF-29a, RF-30, RF-31: limpieza descuenta el kit, stock solo por movimientos, alertas y facturas.
begin;
select plan(24);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as papel from productos where hotel_id = :'h' and clave = 'papel' \gset
select id as jabon from productos where hotel_id = :'h' and clave = 'jabon' \gset
select id as sabanas from productos where hotel_id = :'h' and clave = 'sabanas' \gset
select id as toallas from productos where hotel_id = :'h' and clave = 'toallas' \gset
select id as cloro from productos where hotel_id = :'h' and clave = 'cloro' \gset
select id as r105 from habitaciones where hotel_id = :'h' and numero = '105' \gset
select id as r106 from habitaciones where hotel_id = :'h' and numero = '106' \gset
select privado.hoy() as hoy \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');

select is((select stock from productos where id = :'papel'), 350::numeric, 'el seed carga el stock de papel con un conteo');
select is((select stock from productos where id = :'sabanas'), null, 'sábanas sin contar quedan en NULL');

-- Stock solo por movimientos
prepare tocar_stock as update productos set stock = 999 where id = :'papel';
select throws_ok('tocar_stock', 'P0001', null, 'el stock no se edita a mano');

-- Limpieza con sábanas y toallas sin contar: no falla ni las descuenta
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r106', privado.hoy() - 1, privado.hoy(), 2, 'confirmada', 'telefono') returning id as res1 \gset
select check_in(:'res1');
select check_out(:'res1');
select tests.como('limpieza@test');
select empezar_limpieza(:'r106');
prepare listo106 as select marcar_listo(:'r106');
select lives_ok('listo106', 'Listo con insumos sin contar no falla');
select tests.salir();
select is((select stock from productos where id = :'sabanas'), null, 'producto con stock NULL no se descuenta');
select is((select estado::text from habitaciones where id = :'r106'), 'libre', 'Listo deja el cuarto libre');
select is((select stock from productos where id = :'papel'), 348::numeric, 'Listo descuenta 2 de papel');
select is((select count(*)::int from alertas where resuelta_en is null and tipo = 'por_limpiar' and habitacion_id = :'r106'), 0,
  'Listo cierra el aviso de por limpiar');

-- Kit exacto con 3 huéspedes
select tests.como('recepcion@test');
select ajustar_stock(:'sabanas', 'conteo', 50, 'conteo inicial');
select ajustar_stock(:'toallas', 'conteo', 40, 'conteo inicial');
select tests.salir();
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r105', privado.hoy() - 1, privado.hoy(), 3, 'confirmada', 'telefono') returning id as res2 \gset
select check_in(:'res2');
select check_out(:'res2');
select tests.como('limpieza@test');
select empezar_limpieza(:'r105');
select marcar_listo(:'r105');
select tests.salir();
select results_eq(
  format('select stock from productos where id in (%L, %L, %L, %L) order by clave', :'jabon', :'papel', :'sabanas', :'toallas'),
  $$values (116::numeric), (346::numeric), (49::numeric), (37::numeric)$$,
  'Listo descuenta exactamente el kit: jabón 2, papel 2, sábanas 1, toallas × 3 huéspedes');
select is((select count(*)::int from movimientos_insumo where habitacion_id = :'r105' and tipo = 'limpieza'), 4,
  'un movimiento por insumo del kit, con su cuarto');

-- RF-31: una sola alerta al cruzar el mínimo (papel: mínimo 12)
select ajustar_stock(:'papel', 'conteo', 15);
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'limpieza', -2);
select is((select count(*)::int from alertas where producto_id = :'papel'), 0, 'por encima del mínimo no hay alerta');
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'limpieza', -2);
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'limpieza', -2);
select is((select count(*)::int from alertas where producto_id = :'papel'), 1, 'una sola alerta al cruzar el mínimo, no una por limpieza');
select ok((select mensaje like '%quedan 9 rollo%' from alertas where producto_id = :'papel'), 'la alerta dice cuánto queda');

-- RF-29a: factura
select tests.como('recepcion@test');
select cargar_factura(:'h', 'Distribuidora Demo', '001-001-123', :'hoy',
  jsonb_build_array(jsonb_build_object('producto_id', :'papel', 'cantidad', 100, 'costo_unit_centavos', 45),
                    jsonb_build_object('producto_id', :'jabon', 'cantidad', 20, 'costo_unit_centavos', 30))) as compra \gset
select tests.salir();
select is((select stock from productos where id = :'papel'), 109::numeric, 'cargar la factura suma al stock');
select is((select precio_compra_centavos from productos where id = :'papel'), 45, 'la factura guarda el costo');
select is((select total_centavos from compras where id = :'compra'), 100 * 45 + 20 * 30, 'la factura guarda su total');
select is((select count(*)::int from alertas where producto_id = :'papel' and resuelta_en is null), 0, 'reponer cierra la alerta');

select tests.como('recepcion@test');
prepare anular as select anular_factura(:'compra', 'error de carga');
select throws_ok('anular', 'P0001', null, 'recepción no anula facturas');
select tests.como('duena@test');
select lives_ok('anular', 'la dueña anula la factura');
select tests.salir();
select is((select stock from productos where id = :'papel'), 9::numeric, 'anular revierte el stock');
select is((select count(*)::int from alertas where producto_id = :'papel' and resuelta_en is null), 1, 'al volver a bajar, una alerta nueva');

-- RF-30: consumo diario del cloro (empieza en el mínimo: ya hay aviso)
select is((select count(*)::int from alertas where producto_id = :'cloro' and resuelta_en is null), 1, 'el cloro en el mínimo ya avisa');
select privado.descontar_consumo_diario();
select privado.descontar_consumo_diario();
select is((select stock from productos where id = :'cloro'), 3.5, 'el cloro baja 0,5 kg una sola vez por día');
select is((select count(*)::int from alertas where producto_id = :'cloro'), 1, 'y no repite la alerta');

select * from finish();
rollback;
