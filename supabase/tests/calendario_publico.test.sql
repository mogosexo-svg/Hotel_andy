-- Calendario público de la web: cuartos libres y "desde" por día, sin revelar nada más.
begin;
select plan(24);

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

-- Por tipo: filtra libres y precio; sin tipo igual que antes; tipo desconocido no filtra datos ni revienta
select id as t_suite from tipos_habitacion where hotel_id = :'h' and clave = 'suite' \gset
select results_eq(
  format($$select cuartos_libres, desde_centavos from calendario_publico(%L, %L, 1, 'hotel-andy', 'suite') order by dia$$, :'d'::date, :'d'::date + 3),
  $$values (0, null::int), (0, null::int), (1, 13000)$$,
  'con tipo por clave: solo cuenta ese tipo (suite ocupada 2 noches)');
select is((select cuartos_libres from calendario_publico(:'d'::date + 5, :'d'::date + 6, 1, 'hotel-andy', :'t_suite')), 1, 'con tipo por id (uuid como texto) también filtra');
select is((select desde_centavos from calendario_publico(:'d'::date + 5, :'d'::date + 6, 1, 'hotel-andy', 'suite')), 13000, 'el precio es el del tipo, no el mínimo del hotel');
select is((select cuartos_libres from calendario_publico(:'d'::date + 5, :'d'::date + 6, 1, 'hotel-andy', null)), 23, 'tipo null: todo el hotel como antes');
select is((select cuartos_libres from calendario_publico(:'d'::date + 5, :'d'::date + 6, 1)), 23, 'sin el parámetro: igual que antes');
select results_eq(
  format($$select cuartos_libres, desde_centavos from calendario_publico(%L, %L, 1, 'hotel-andy', 'no-existe') order by dia$$, :'d'::date, :'d'::date + 2),
  $$values (0, null::int), (0, null::int)$$,
  'tipo inexistente: 0 libres y sin precio, sin error');
select is((select count(*)::int from pg_proc where proname = 'calendario_publico'), 1, 'una sola firma (sin sobrecarga ambigua)');

-- anon: puede ejecutarla y no ve tablas
set local role anon;
select is((select count(*)::int from calendario_publico(:'d'::date, :'d'::date + 3, 1)), 3, 'anon puede ejecutar calendario_publico');
select throws_ok('select * from reservas', '42501', null, 'anon no lee reservas');
reset role;
select is((select proargnames::text[] from pg_proc where proname = 'calendario_publico'),
  array['p_desde', 'p_hasta', 'p_personas', 'p_hotel', 'p_tipo', 'dia', 'cuartos_libres', 'desde_centavos', 'temporada_alta'],
  'solo devuelve día, libres, desde y temporada');

select * from finish();
rollback;
