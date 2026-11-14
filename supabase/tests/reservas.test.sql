-- RF-03, RF-24, RF-25, RF-28, RF-38a: reservas cruzadas, precio por temporada, pre-reservas y disponibilidad.
begin;
select plan(23);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as r103 from habitaciones where hotel_id = :'h' and numero = '103' \gset
select id as r104 from habitaciones where hotel_id = :'h' and numero = '104' \gset
select id as r500 from habitaciones where hotel_id = :'h' and numero = '500' \gset
select id as ds from tipos_habitacion where hotel_id = :'h' and clave = 'doble_sencilla' \gset
select id as suite from tipos_habitacion where hotel_id = :'h' and clave = 'suite' \gset
select privado.hoy() + 10 as d \gset

-- RF-24: cero reservas cruzadas
prepare r1 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r103', :'d'::date, :'d'::date + 3, 2, 'confirmada', 'telefono');
select lives_ok('r1', 'una reserva confirmada entra');

prepare r2 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r103', :'d'::date + 2, :'d'::date + 4, 1, 'prereserva', 'whatsapp');
select throws_ok('r2', '23P01', null, 'una reserva solapada en el mismo cuarto falla');

prepare r3 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r103', :'d'::date + 3, :'d'::date + 5, 2, 'confirmada', 'telefono');
select lives_ok('r3', 'salida y entrada el mismo día sí se permite');

prepare r4 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r103', :'d'::date + 1, :'d'::date + 2, 1, 'cancelada', 'telefono');
select lives_ok('r4', 'una reserva cancelada no choca');

update reservas set estado = 'cancelada' where habitacion_id = :'r103' and entrada = :'d'::date and estado = 'confirmada';
prepare r5 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r103', :'d'::date, :'d'::date + 2, 2, 'confirmada', 'walk_in');
select lives_ok('r5', 'cancelar una reserva libera sus fechas');

prepare r6 as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r104', :'d'::date + 30, :'d'::date + 31, 3, 'confirmada', 'telefono');
select throws_ok('r6', 'P0001', null, 'no entra más gente que la capacidad del cuarto');

-- RF-38a: cada reserva congela canal y precio
select is((select total_centavos from reservas where habitacion_id = :'r103' and entrada = :'d'::date + 3),
  7000, 'doble sencilla, 2 noches en temporada baja = 2 × $35');
select is((select canal::text from reservas where habitacion_id = :'r103' and entrada = :'d'::date + 3),
  'directo', 'por teléfono el canal es directo');

update temporadas set fechas = datemultirange(daterange(:'d'::date + 20, :'d'::date + 21))
  where hotel_id = :'h' and not es_base;
select is(privado.cotizar(:'ds', 'directo', :'d'::date + 19, :'d'::date + 22), 3500 + 4500 + 3500,
  'el total suma cada noche con la tarifa de su temporada');
select is((select total_centavos from consultar_disponibilidad(:'d'::date + 19, :'d'::date + 22, 2)
           where clave = 'doble_sencilla'), 11500, 'la disponibilidad da el mismo total que el panel');
select is((select total_centavos from reservas where habitacion_id = :'r103' and entrada = :'d'::date + 3),
  7000, 'cambiar la temporada no toca el precio ya congelado');
select is(privado.cotizar(:'ds', 'booking', :'d'::date, :'d'::date + 1), null, 'sin tarifa de Booking no hay precio inventado');

prepare rb as insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r104', :'d'::date, :'d'::date + 2, 2, 'confirmada', 'booking');
select lives_ok('rb', 'una reserva de Booking sin tarifa entra con el total pendiente');
select is((select canal::text from reservas where habitacion_id = :'r104' and entrada = :'d'::date), 'booking',
  'la fuente Booking congela el canal Booking');

-- RF-03 / RF-28: disponibilidad
update habitaciones set estado = 'mantenimiento' where id = :'r500';
select is((select count(*)::int from consultar_disponibilidad(:'d'::date + 40, :'d'::date + 41, 6)), 0,
  'un cuarto en mantenimiento no se ofrece (la suite es la única para 6)');
update habitaciones set estado = 'libre' where id = :'r500';
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r500', :'d'::date + 40, :'d'::date + 41, 6, 'confirmada', 'telefono');
select is((select count(*)::int from consultar_disponibilidad(:'d'::date + 40, :'d'::date + 41, 6)), 0,
  'un tipo sin cuartos libres no se ofrece');

-- RF-25: pre-reserva desde la web (anónimo)
select tests.anon();
select (crear_prereserva(:'suite', :'d'::date + 60, :'d'::date + 61, 4, 'Ana Pérez', '+593 99 123 4567', true)) ->> 'codigo' as cod \gset
select tests.salir();
select is((select estado::text from reservas where codigo = :'cod'), 'prereserva', 'la web crea una pre-reserva con código');
select ok((select vence_en between now() + interval '119 minutes' and now() + interval '121 minutes' from reservas where codigo = :'cod'),
  'la pre-reserva vence a las 2 horas');

select tests.anon();
prepare sin_consentimiento as select crear_prereserva(:'ds', :'d'::date + 70, :'d'::date + 71, 2, 'Ana Pérez', '0991234567', false);
select throws_ok('sin_consentimiento', 'P0001', null, 'sin consentimiento LOPDP no hay pre-reserva');
select crear_prereserva(:'ds', :'d'::date + 80, :'d'::date + 81, 2, 'Ana Pérez', '0991234567', true);
prepare tercera as select crear_prereserva(:'ds', :'d'::date + 90, :'d'::date + 91, 2, 'Ana Pérez', '099 123 4567', true);
select throws_ok('tercera', 'P0001', null, 'tope de pre-reservas activas por teléfono');
select tests.salir();

-- RF-25: la vencida se libera sola y deja de bloquear
update reservas set vence_en = now() - interval '1 minute' where codigo = :'cod';
select is((select count(*)::int from consultar_disponibilidad(:'d'::date + 60, :'d'::date + 61, 6)), 1,
  'la disponibilidad libera las vencidas antes de consultar');
select is((select estado::text from reservas where codigo = :'cod'), 'cancelada', 'la pre-reserva vencida queda cancelada');
update reservas set vence_en = now() - interval '1 minute' where estado = 'prereserva' and hotel_id = :'h';
select ok(privado.liberar_prereservas_vencidas() >= 1, 'la función del cron libera las vencidas');

select * from finish();
rollback;
