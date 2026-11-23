-- RF-60 a RF-64: categorías, productos de venta, consumos al cuarto y cuadre del día.
begin;
select plan(12);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as cerveza from productos where hotel_id = :'h' and clave = 'cerveza' \gset
select id as agua from productos where hotel_id = :'h' and clave = 'agua' \gset
select id as bebidas from categorias where hotel_id = :'h' and clave = 'bebidas' \gset
select id as r202 from habitaciones where hotel_id = :'h' and numero = '202' \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');

select is((select precio_venta_centavos from productos where id = :'cerveza'), null, 'el seed no inventa precios de venta');

select tests.como('recepcion@test');
prepare borrar_categoria as delete from categorias where id = :'bebidas';
select throws_ok('borrar_categoria', '23503', null, 'no se borra una categoría con productos');
update productos set precio_venta_centavos = 250, precio_compra_centavos = 150 where id = :'cerveza';
select ajustar_stock(:'cerveza', 'conteo', 24);
prepare sin_precio as select registrar_consumo(:'agua', 1, null, 'efectivo');
select throws_ok('sin_precio', 'P0001', null, 'sin precio de venta no se registra la venta');
select tests.salir();

insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r202', privado.hoy(), privado.hoy() + 1, 2, 'confirmada', 'telefono') returning id as res \gset
select check_in(:'res');

select tests.como('recepcion@test');
select registrar_consumo(:'cerveza', 2, :'res', null);
select registrar_consumo(:'cerveza', 1, null, 'efectivo');
prepare ambos as select registrar_consumo(:'cerveza', 1, :'res', 'efectivo');
select throws_ok('ambos', 'P0001', null, 'o se carga al cuarto o se paga ya, no las dos');
select tests.salir();
select is((select stock from productos where id = :'cerveza'), 21::numeric, 'vender descuenta el stock');

select tests.como('limpieza@test');
prepare camarera_vende as select registrar_consumo(:'cerveza', 1, null, 'efectivo');
select throws_ok('camarera_vende', 'P0001', null, 'limpieza no registra ventas');
select tests.como('recepcion@test');
select is((cuenta_reserva(:'res') ->> 'consumos_pendientes_centavos')::int, 500, 'el consumo cargado al cuarto queda pendiente');
select is((check_out(:'res', 'transferencia') ->> 'consumos_pendientes_centavos')::int, 500, 'el check-out muestra los pendientes con su total');
select tests.salir();
select is((select count(*)::int from consumos where reserva_id = :'res' and medio is null), 0, 'al cobrar en el check-out quedan pagados');

select tests.como('recepcion@test');
select cuadre_dia(:'h') as cuadre \gset
select tests.salir();
select is((:'cuadre'::jsonb ->> 'total_centavos')::int, (select sum(total_centavos)::int from consumos where hotel_id = :'h'),
  'el cuadre del día coincide con la suma de los consumos');
select is((:'cuadre'::jsonb ->> 'margen_centavos')::int, 750 - 3 * 150, 'margen = venta − costo');
select is((select sum((x ->> 'total_centavos')::int)::int from jsonb_array_elements(:'cuadre'::jsonb -> 'por_medio') x), 750,
  'el desglose por forma de pago suma el total');

select * from finish();
rollback;
