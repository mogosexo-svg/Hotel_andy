-- Comprobantes de anticipo por WhatsApp: recibir (n8n, service_role), asociar, aceptar y rechazar desde el panel.
begin;
select plan(44);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as r202 from habitaciones where hotel_id = :'h' and numero = '202' \gset
select id as r203 from habitaciones where hotel_id = :'h' and numero = '203' \gset
select id as r301 from habitaciones where hotel_id = :'h' and numero = '301' \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');

insert into huespedes (hotel_id, nombre, telefono) values (:'h', 'Ana Pérez', '0991234567') returning id as ana \gset
-- Pre-reserva de Ana con vencimiento normal (2 h) y otra más vieja que ya venció pero el cron no ha pasado.
insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente, creado_en)
  values (:'h', :'r202', :'ana', privado.hoy() + 10, privado.hoy() + 12, 2, 'prereserva', 'whatsapp', now() - interval '1 hour')
  returning id as vieja, codigo as cod_vieja \gset
insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r203', :'ana', privado.hoy() + 20, privado.hoy() + 22, 2, 'prereserva', 'whatsapp')
  returning id as nueva, codigo as cod_nueva, vence_en as vence_nueva \gset

-- ── recibir_comprobante ─────────────────────────────────────────────────────
select recibir_comprobante(:'h', '593991234567', :'h' || '/comprobantes/a.jpg', 'wamid.1') as rec1 \gset
select is((:'rec1'::jsonb ->> 'reserva_id')::uuid, :'nueva'::uuid, 'por teléfono (sin +, como lo manda WhatsApp) asocia la pre-reserva más reciente');
select is((:'rec1'::jsonb ->> 'codigo'), :'cod_nueva', 'devuelve el código de la reserva');
select is((:'rec1'::jsonb ->> 'asociado')::boolean, true, 'asociado = true');
select (:'rec1'::jsonb ->> 'comprobante_id') as c1 \gset
select is((select telefono from comprobantes where id = :'c1'), '+593991234567', 'guarda el teléfono normalizado');
select is((select estado::text from comprobantes where id = :'c1'), 'pendiente', 'queda pendiente');
select is(recibir_comprobante(:'h', '593991234567', :'h' || '/comprobantes/a.jpg', 'wamid.1') ->> 'comprobante_id', :'c1',
  'mismo wa_message_id devuelve el mismo comprobante');
select is((select count(*)::int from comprobantes where wa_message_id = 'wamid.1'), 1, 'idempotente: no duplica');
select is((select count(*)::int from alertas where tipo = 'comprobante' and comprobante_id = :'c1'), 1, 'idempotente: una sola alerta');
select is((select mensaje from alertas where comprobante_id = :'c1'), 'Comprobante de Ana Pérez para la reserva ' || :'cod_nueva',
  'la alerta trae un mensaje listo para mostrar');
select is((select vence_en from reservas where id = :'nueva'), now() + interval '24 hours', 'extiende el vencimiento a 24 h desde ahora');

-- Por código, aunque haya otra más reciente
select recibir_comprobante(:'h', '+593 99 123 4567', :'h' || '/comprobantes/b.jpg', 'wamid.2', lower(:'cod_vieja'), 4000) as rec2 \gset
select (:'rec2'::jsonb ->> 'comprobante_id') as c2 \gset
select is((:'rec2'::jsonb ->> 'reserva_id')::uuid, :'vieja'::uuid, 'por código asocia esa reserva (sin importar mayúsculas)');
select is((select monto_declarado_centavos from comprobantes where id = :'c2'), 4000, 'guarda el monto declarado');

-- No acorta nunca: si ya vencía más tarde, se queda
update reservas set vence_en = now() + interval '30 hours' where id = :'nueva';
select recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/c.jpg', 'wamid.3') as rec3 \gset
select (:'rec3'::jsonb ->> 'comprobante_id') as c3 \gset
select is((select vence_en from reservas where id = :'nueva'), now() + interval '30 hours', 'no acorta un vencimiento más largo');

-- Sin reserva
select recibir_comprobante(:'h', '0987654321', :'h' || '/comprobantes/d.jpg', 'wamid.4') as rec4 \gset
select (:'rec4'::jsonb ->> 'comprobante_id') as c4 \gset
select is((:'rec4'::jsonb ->> 'asociado')::boolean, false, 'teléfono sin pre-reserva: asociado = false');
select is((:'rec4'::jsonb ->> 'reserva_id'), null, 'sin reserva_id');
select is((select mensaje from alertas where comprobante_id = :'c4'), 'Comprobante sin reserva asociada (+593987654321)', 'alerta de comprobante suelto');
select is((recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/e.jpg', null, 'NOEXISTE') ->> 'asociado')::boolean, false,
  'código que no existe: no se asocia a otra por teléfono');

-- Validaciones
prepare foto_ajena as select recibir_comprobante(:'h', '0991234567', :'hb' || '/comprobantes/x.jpg');
select throws_ok('foto_ajena', 'P0001', 'La foto del comprobante no está en la carpeta de este hotel', 'ruta de otro hotel rechazada');
prepare foto_fuera as select recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/../facturas/x.jpg');
select throws_ok('foto_fuera', 'P0001', 'La foto del comprobante no está en la carpeta de este hotel', 'sin escaparse con ..');

-- Cron: la pre-reserva vencida que recibió comprobante ya no se libera
update reservas set vence_en = now() - interval '1 minute' where id = :'vieja';
select recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/f.jpg', 'wamid.5', :'cod_vieja') as rec5 \gset
select (:'rec5'::jsonb ->> 'comprobante_id') as c5 \gset
select privado.liberar_prereservas_vencidas();
select is((select estado::text from reservas where id = :'vieja'), 'prereserva', 'el cron no libera la pre-reserva mientras se revisa');

-- ── Permisos de recibir ─────────────────────────────────────────────────────
select tests.anon();
prepare anon_recibe as select recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/z.jpg');
select throws_ok('anon_recibe', '42501', null, 'anon no llama recibir_comprobante');
select tests.como('duena@test');
prepare auth_recibe as select recibir_comprobante(:'h', '0991234567', :'h' || '/comprobantes/z.jpg');
select throws_ok('auth_recibe', '42501', null, 'authenticated (ni la dueña) no llama recibir_comprobante');
select tests.salir();

-- ── Lectura ─────────────────────────────────────────────────────────────────
select tests.como('recepcion@test');
select is((select count(*)::int from comprobantes), 6, 'recepción ve los comprobantes de su hotel');
select is((select count(*)::int from comprobantes_pendientes(:'h')), 6, 'la lista del panel trae los pendientes');
select is((select anticipo_centavos from comprobantes_pendientes(:'h') where comprobante_id = :'c1'),
  (select round(total_centavos * 0.5)::int from reservas where id = :'nueva'), 'anticipo esperado = 50 % del total');
select is((select huesped || '|' || habitacion from comprobantes_pendientes(:'h') where comprobante_id = :'c1'), 'Ana Pérez|203',
  'trae huésped y cuarto');
prepare directo as insert into comprobantes (hotel_id, telefono, foto_path, origen) values (:'h', '+593991234567', :'h' || '/comprobantes/q.jpg', 'recepcion');
select throws_ok('directo', '42501', null, 'nadie inserta comprobantes directo: solo por RPC');
select tests.como('limpieza@test');
select is((select count(*)::int from comprobantes), 0, 'limpieza no ve comprobantes');
prepare lista_limpieza as select * from comprobantes_pendientes(:'h');
select throws_ok('lista_limpieza', 'P0001', null, 'limpieza no abre la lista');
select tests.como('duena-b@test');
select is((select count(*)::int from comprobantes), 0, 'otro hotel no ve nada');
prepare aceptar_ajeno as select aceptar_comprobante(:'c1', 5000);
select throws_ok('aceptar_ajeno', 'P0001', null, 'otro hotel no acepta comprobantes ajenos');
select tests.salir();

-- ── Aceptar ─────────────────────────────────────────────────────────────────
select tests.como('recepcion@test');
select aceptar_comprobante(:'c1', 5000) as pago1 \gset
select tests.salir();
select is((select monto_centavos || '|' || medio || '|' || comprobante_path from pagos where id = :'pago1'),
  '5000|transferencia|' || :'h' || '/comprobantes/a.jpg', 'aceptar registra el pago por transferencia con la foto');
select is((select estado::text from reservas where id = :'nueva'), 'confirmada', 'la pre-reserva pasa a confirmada');
select is((select estado || '|' || pago_id || '|' || (revisado_por = :'u_rec') from comprobantes where id = :'c1'),
  'aceptado|' || :'pago1' || '|true', 'el comprobante queda aceptado con pago y quién lo revisó');
select isnt((select resuelta_en from alertas where comprobante_id = :'c1'), null, 'la alerta queda resuelta');
select tests.como('duena@test');
prepare dos_veces as select aceptar_comprobante(:'c1', 5000);
select throws_ok('dos_veces', 'P0001', 'Este comprobante ya fue revisado', 'no se acepta dos veces');
prepare sin_reserva as select aceptar_comprobante(:'c4', 5000);
select throws_ok('sin_reserva', 'P0001', 'Asocia el comprobante a una reserva antes de aceptarlo', 'sin reserva no se acepta');
select cancelar_reserva(:'vieja', 'Cambió de planes');
prepare cancelada as select aceptar_comprobante(:'c2', 4000);
select throws_ok('cancelada', 'P0001', 'La reserva ' || :'cod_vieja' || ' está cancelada: no se puede aceptar el comprobante. Si el huésped pagó, crea una reserva nueva y registra el pago ahí.',
  'reserva cancelada: falla con mensaje claro');

-- ── Asociar ─────────────────────────────────────────────────────────────────
select tests.salir();
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r301', privado.hoy() + 40, privado.hoy() + 41, 1, 'prereserva', 'telefono') returning id as otra, codigo as cod_otra \gset
select tests.como('recepcion@test');
select asociar_comprobante(:'c4', :'otra');
select is((select reserva_id from comprobantes where id = :'c4'), :'otra'::uuid, 'recepción asocia el comprobante suelto');
select is((select vence_en from reservas where id = :'otra'), now() + interval '24 hours', 'al asociar también retiene la pre-reserva');

-- ── Rechazar ────────────────────────────────────────────────────────────────
prepare sin_motivo as select rechazar_comprobante(:'c4', '  ');
select throws_ok('sin_motivo', 'P0001', 'Escribe el motivo del rechazo para avisarle al huésped', 'rechazar exige motivo');
select rechazar_comprobante(:'c4', 'La foto no se lee');
select is((select estado || '|' || motivo_rechazo from comprobantes where id = :'c4'), 'rechazado|La foto no se lee', 'queda rechazado con motivo');
select is((select vence_en from reservas where id = :'otra'), now() + interval '2 hours', 'devuelve el vencimiento normal de la pre-reserva');
select isnt((select resuelta_en from alertas where comprobante_id = :'c4'), null, 'rechazar resuelve la alerta');
select tests.salir();

select * from finish();
rollback;
