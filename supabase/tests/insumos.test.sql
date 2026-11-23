-- RF-27, RF-29, RF-29a, RF-30, RF-31: Listo ya no descuenta (inventario a mano desde 23 nov 2026), stock solo por
-- movimientos, alertas y facturas.
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

-- Limpieza con sábanas y toallas sin contar: no falla
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r106', privado.hoy() - 1, privado.hoy(), 2, 'confirmada', 'telefono') returning id as res1 \gset
select check_in(:'res1');
select check_out(:'res1');
select tests.como('limpieza@test');
select empezar_limpieza(:'r106');
prepare listo106 as select marcar_listo(:'r106');
select lives_ok('listo106', 'Listo con insumos sin contar no falla');
select tests.salir();
select is((select stock from productos where id = :'sabanas'), null, 'producto con stock NULL sigue sin contar');
select is((select estado::text from habitaciones where id = :'r106'), 'libre', 'Listo deja el cuarto libre');
select is((select stock from productos where id = :'papel'), 350::numeric, 'Listo ya no descuenta papel');
select is((select count(*)::int from alertas where resuelta_en is null and tipo = 'por_limpiar' and habitacion_id = :'r106'), 0,
  'Listo cierra el aviso de por limpiar');

-- Con 3 huéspedes y todo contado: Listo no toca el stock
select tests.como('recepcion@test');
select ajustar_stock(:'sabanas', 'conteo', 50, 'conteo inicial');
select ajustar_stock(:'toallas', 'conteo', 40, 'conteo inicial');
select tests.salir();
select stock as jabon0 from productos where id = :'jabon' \gset
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
  format('values (%s::numeric), (350::numeric), (50::numeric), (40::numeric)', :'jabon0'),
  'Listo no descuenta el kit: jabón, papel, sábanas y toallas quedan igual');
select is((select count(*)::int from movimientos_insumo where tipo = 'limpieza'), 0,
  'Listo no crea movimientos de limpieza');

-- RF-31: una sola alerta al cruzar el mínimo (papel: mínimo 12)
select ajustar_stock(:'papel', 'conteo', 15);
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'uso', -2);
select is((select count(*)::int from alertas where producto_id = :'papel'), 0, 'por encima del mínimo no hay alerta');
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'uso', -2);
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'uso', -2);
select is((select count(*)::int from alertas where producto_id = :'papel'), 1, 'una sola alerta al cruzar el mínimo, no una por salida');
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

-- RF-30: sin consumo diario automático; el cloro se anota a mano (empieza en el mínimo: ya hay aviso)
select is((select count(*)::int from alertas where producto_id = :'cloro' and resuelta_en is null), 1, 'el cloro en el mínimo ya avisa');
select hasnt_function('privado', 'descontar_consumo_diario', 'ya no existe el descuento diario automático');
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'cloro', 'uso', -0.5);
select is((select count(*)::int from alertas where producto_id = :'cloro'), 1, 'anotar el uso no repite la alerta');

select * from finish();
rollback;
