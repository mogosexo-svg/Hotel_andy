-- RF-22, RF-27: deshacer "Empezar" (Limpiando → Por limpiar) y salidas_hoy con personas.
begin;
select plan(6);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as r from habitaciones where hotel_id = :'h' and numero = '201' \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_lim', 'limpieza', 'Camarera'), (:'h', :'u_duena', 'duena', 'Dueña');
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');

update habitaciones set estado = 'ocupado' where id = :'r';
update habitaciones set estado = 'por_limpiar' where id = :'r';

select tests.como('limpieza@test');
prepare deshacer as select deshacer_limpieza(:'r');
select throws_ok('deshacer', 'P0001', 'Ese cuarto no se está limpiando', 'desde Por limpiar falla con mensaje humano');
select empezar_limpieza(:'r');
select lives_ok('deshacer', 'limpieza puede deshacer');
select is((select estado::text from habitaciones where id = :'r'), 'por_limpiar', 'queda Por limpiar');
select tests.salir();

select empezar_limpieza(:'r');
select tests.como('duena-b@test');
select throws_ok('deshacer', 'P0001', null, 'usuario de otro hotel no puede');
select tests.salir();

insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', (select id from habitaciones where hotel_id = :'h' and numero = '202'), privado.hoy() - 1, privado.hoy(), 2, 'en_curso', 'telefono');
select tests.como('duena@test');
select is((resumen_inicio(:'h')->'salidas_hoy'->0->>'personas')::int, 2, 'salidas_hoy trae personas');
select tests.salir();
select ok(not has_function_privilege('anon', 'public.deshacer_limpieza(uuid)', 'execute'), 'anon no ejecuta deshacer_limpieza');

select * from finish();
rollback;
