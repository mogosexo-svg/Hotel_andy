-- Calendario público de la web: cuartos libres y "desde" por día, sin revelar nada más.
begin;
select plan(17);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as r103 from habitaciones where hotel_id = :'h' and numero = '103' \gset
select id as suite from habitaciones where hotel_id = :'h' and tipo_id = (select id from tipos_habitacion where clave = 'suite') \gset
select privado.hoy() + 10 as d \gset

select is((select count(*)::int from calendario_publico(:'d'::date, :'d'::date + 5, 1)), 5, 'una fila por día de [desde, hasta)');
select is((select cuartos_libres from calendario_publico(:'d'::date, :'d'::date + 1, 1)), 23, 'sin reservas, libres todos los cuartos');
select is((select desde_centavos from calendario_publico(:'d'::date, :'d'::date + 1, 1)), 3500, 'desde = la tarifa directa más barata (doble sencilla, baja)');
select is((select desde_centavos from calendario_publico(:'d'::date, :'d'::date + 1, 3)), 5000, 'con 3 personas el desde sale de los tipos donde caben');

-- Suite es el único cuarto de 7 personas: ocupada dos noches
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
values (:'h', :'suite', :'d'::date, :'d'::date + 2, 2, 'confirmada', 'telefono');
select results_eq(
  format($$select cuartos_libres, desde_centavos from calendario_publico(%L, %L, 7) order by dia$$, :'d'::date, :'d'::date + 3),
  $$values (0, null::int), (0, null::int), (1, 13000)$$,
  'tipo con todos los cuartos ocupados: 0 libres y sin precio; la noche de salida vuelve a estar libre');
select is((select cuartos_libres from calendario_publico(:'d'::date, :'d'::date + 1, 1)), 22, 'la reserva descuenta un cuarto en las noches ocupadas');

-- Mantenimiento no cuenta
update habitaciones set estado = 'mantenimiento' where id = :'r103';
select is((select cuartos_libres from calendario_publico(:'d'::date + 8, :'d'::date + 9, 1)), 22, 'un cuarto en mantenimiento no cuenta');
update habitaciones set estado = 'libre' where id = :'r103';

-- Pre-reserva vigente ocupa; vencida no
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
values (:'h', :'r103', :'d'::date + 6, :'d'::date + 7, 2, 'prereserva', 'web');
select is((select cuartos_libres from calendario_publico(:'d'::date + 6, :'d'::date + 7, 1)), 22, 'una pre-reserva vigente ocupa el cuarto');
update reservas set vence_en = now() - interval '1 hour' where habitacion_id = :'r103' and estado = 'prereserva';
select is((select cuartos_libres from calendario_publico(:'d'::date + 6, :'d'::date + 7, 1)), 23, 'una pre-reserva vencida no ocupa');

-- Temporada alta
update temporadas set fechas = datemultirange(daterange(:'d'::date + 20, :'d'::date + 21)) where hotel_id = :'h' and not es_base;
select results_eq(
  format($$select temporada_alta, desde_centavos from calendario_publico(%L, %L, 1) order by dia$$, :'d'::date + 19, :'d'::date + 22),
  $$values (false, 3500), (true, 4500), (false, 3500)$$,
  'el día de temporada alta marca el flag y usa la tarifa alta');

-- Validaciones
select throws_ok(format($$select * from calendario_publico(%L, %L, 1)$$, :'d'::date, :'d'::date + 93), 'P0001', null, 'rango > 92 días falla');
select throws_ok(format($$select * from calendario_publico(%L, %L, 1)$$, privado.hoy() - 5, privado.hoy() + 3), 'P0001', null, 'desde en el pasado falla');
select throws_ok(format($$select * from calendario_publico(%L, %L, 0)$$, :'d'::date, :'d'::date + 3), 'P0001', null, 'personas fuera de 1-20 falla');
select throws_ok(format($$select * from calendario_publico(%L, %L, 1, 'otro')$$, :'d'::date, :'d'::date + 3), 'P0001', null, 'hotel inexistente falla');

-- anon: puede ejecutarla y no ve tablas
set local role anon;
select is((select count(*)::int from calendario_publico(:'d'::date, :'d'::date + 3, 1)), 3, 'anon puede ejecutar calendario_publico');
select throws_ok('select * from reservas', '42501', null, 'anon no lee reservas');
reset role;
select is((select proargnames::text[] from pg_proc where proname = 'calendario_publico'),
  array['p_desde', 'p_hasta', 'p_personas', 'p_hotel', 'dia', 'cuartos_libres', 'desde_centavos', 'temporada_alta'],
  'solo devuelve día, libres, desde y temporada');

select * from finish();
rollback;
