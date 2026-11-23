-- RF-62/RF-63: anular una venta (revierte stock, no cuenta en cuadre/cuenta/dinero del mes) y alertas con coma decimal.
begin;
select plan(12);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as cerveza from productos where hotel_id = :'h' and clave = 'cerveza' \gset
select id as r202 from habitaciones where hotel_id = :'h' and numero = '202' \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');

update productos set precio_venta_centavos = 250, precio_compra_centavos = 150 where id = :'cerveza';
select tests.como('recepcion@test');
select ajustar_stock(:'cerveza', 'conteo', 24);
select tests.salir();
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r202', privado.hoy(), privado.hoy() + 1, 2, 'confirmada', 'telefono') returning id as res \gset
select check_in(:'res');

select tests.como('recepcion@test');
select registrar_consumo(:'cerveza', 2, :'res', null) as cargo \gset
select registrar_consumo(:'cerveza', 1, null, 'efectivo') as pago \gset
select is((select stock from productos where id = :'cerveza'), 21::numeric, 'dos ventas descuentan 3');
select anular_consumo(:'cargo', 'se equivocó');
select is((select stock from productos where id = :'cerveza'), 23::numeric, 'anular devuelve el stock');
select is((select count(*)::int from movimientos_insumo where consumo_id = :'cargo' and tipo = 'anulacion'), 1, 'queda un movimiento de anulación');
select is((select count(*)::int from consumos where id = :'cargo' and anulado_en is not null), 1, 'la fila no se borra: queda anulada');
prepare dos_veces as select anular_consumo(:'cargo');
select throws_ok('dos_veces', 'P0001', 'Esa venta ya está anulada', 'no se anula dos veces');
select is((cuenta_reserva(:'res') ->> 'consumos_pendientes_centavos')::int, 0, 'la cuenta de la reserva ya no cuenta lo anulado');
select is((cuadre_dia(:'h') ->> 'total_centavos')::int, 250, 'el cuadre del día no cuenta lo anulado');
select is((resumen_inicio(:'h') ->> 'dinero_mes_centavos')::int, 250, 'el dinero del mes no cuenta lo anulado');
select check_out(:'res', 'efectivo');
select is((select count(*)::int from consumos where id = :'cargo' and medio is not null), 0, 'el check-out no cobra lo anulado');
select tests.como('limpieza@test');
prepare camarera as select anular_consumo(:'pago');
select throws_ok('camarera', 'P0001', null, 'limpieza no anula ventas');
select tests.como('duena-b@test');
prepare otro_hotel as select anular_consumo(:'pago');
select throws_ok('otro_hotel', 'P0001', null, 'otro hotel no anula ventas ajenas');
select tests.salir();

-- Alertas: decimales con coma y sin ceros de más
select id as cloro from productos where hotel_id = :'h' and clave = 'cloro' \gset
select tests.como('recepcion@test');
select ajustar_stock(:'cloro', 'conteo', 1.50);
select tests.salir();
select ok((select mensaje like '%quedan 1,5 %' from alertas where producto_id = :'cloro' and resuelta_en is null), 'la alerta escribe 1,5 con coma');

select * from finish();
rollback;
