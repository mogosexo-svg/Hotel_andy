-- RF-22, RF-26, RF-28, RF-35: máquina de estados del cuarto, check-in/out, daños y auditoría.
begin;
select plan(17);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as r from habitaciones where hotel_id = :'h' and numero = '201' \gset
select id as r2 from habitaciones where hotel_id = :'h' and numero = '202' \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');

-- Transiciones directas (como recepción)
select tests.como('recepcion@test');
prepare a_ocupado as update habitaciones set estado = 'ocupado' where id = :'r';
prepare a_por_limpiar as update habitaciones set estado = 'por_limpiar' where id = :'r';
prepare a_limpiando as update habitaciones set estado = 'limpiando' where id = :'r';
prepare a_libre as update habitaciones set estado = 'libre' where id = :'r';
prepare a_mant as update habitaciones set estado = 'mantenimiento' where id = :'r';
select throws_ok('a_limpiando', 'P0001', null, 'libre → limpiando se rechaza');
select lives_ok('a_ocupado', 'libre → ocupado pasa');
select lives_ok('a_por_limpiar', 'ocupado → por limpiar pasa');
select throws_ok('a_ocupado', 'P0001', null, 'por limpiar → ocupado lo rechaza la base de datos');
select lives_ok('a_limpiando', 'por limpiar → limpiando pasa');
select lives_ok('a_libre', 'limpiando → libre pasa');
select lives_ok('a_mant', 'libre → mantenimiento pasa');
select throws_ok('a_libre', 'P0001', null, 'recepción no saca un cuarto de mantenimiento');
select tests.como('duena@test');
select lives_ok('a_libre', 'la dueña libera el mantenimiento');
select lives_ok('a_ocupado', 'libre → ocupado otra vez');
select lives_ok('a_mant', 'ocupado → mantenimiento pasa (desde cualquier estado)');
select tests.salir();

-- RF-26: check-in / check-out con un toque
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r2', privado.hoy(), privado.hoy() + 1, 2, 'confirmada', 'telefono') returning id as res \gset
select tests.como('recepcion@test');
select check_in(:'res');
select tests.salir();
select is((select estado::text from habitaciones where id = :'r2'), 'ocupado', 'check-in deja el cuarto ocupado');
select tests.como('recepcion@test');
select check_out(:'res');
select tests.salir();
select is((select estado::text || '/' || (check_out_por = :'u_rec')::text from reservas where id = :'res'),
  'finalizada/true', 'check-out finaliza la reserva y guarda quién');
select is((select estado::text from habitaciones where id = :'r2'), 'por_limpiar', 'check-out pasa el cuarto a por limpiar');
select is((select count(*)::int from alertas where habitacion_id = :'r2' and tipo = 'por_limpiar' and resuelta_en is null), 1,
  'check-out deja un aviso para limpieza');

-- RF-28: daño reportado por la camarera
select tests.como('limpieza@test');
select reportar_dano(:'r2', 'Gotea la ducha', null);
select tests.salir();
select is((select estado::text from habitaciones where id = :'r2'), 'mantenimiento', 'reportar daño bloquea el cuarto');

-- RF-35: auditoría con quién
select is((select count(*)::int from auditoria where registro_id = :'r2' and usuario_id = :'u_lim'), 1,
  'la auditoría guarda quién cambió el estado');

select * from finish();
rollback;
