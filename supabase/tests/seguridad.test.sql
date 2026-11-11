-- Revisión de seguridad: abuso de la web, huéspedes ajenos, doble descuento, auditoría, permisos y fugas.
begin;
select plan(34);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as ds from tipos_habitacion where hotel_id = :'h' and clave = 'doble_sencilla' \gset
select id as r201 from habitaciones where hotel_id = :'h' and numero = '201' \gset
select id as r202 from habitaciones where hotel_id = :'h' and numero = '202' \gset
select id as cerveza from productos where hotel_id = :'h' and clave = 'cerveza' \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');
select privado.hoy() + 10 as d \gset
select privado.hoy() + 366 as lejos \gset

-- 1. La web no aparta más de 14 noches ni más de un año adelante (ni las ofrece)
select tests.anon();
prepare larga as select crear_prereserva(:'ds', :'d'::date, :'d'::date + 15, 2, 'Ana Pérez', '0991000001', true);
select throws_ok('larga', 'P0001', 'Por la web se reservan hasta 14 noches. Para estadías más largas escríbenos por WhatsApp',
  'la web no aparta 15 noches');
prepare lejana as select crear_prereserva(:'ds', :'lejos'::date, :'lejos'::date + 1, 2, 'Ana Pérez', '0991000001', true);
select throws_ok('lejana', 'P0001', 'Por la web se reserva hasta un año antes. Para fechas más lejanas escríbenos por WhatsApp',
  'la web no aparta a más de un año');
prepare ver_larga as select * from consultar_disponibilidad(:'d'::date, :'d'::date + 15, 2);
select throws_ok('ver_larga', 'P0001', null, 'la disponibilidad tampoco ofrece 15 noches');
prepare ver_lejana as select * from consultar_disponibilidad(:'lejos'::date, :'lejos'::date + 1, 2);
select throws_ok('ver_lejana', 'P0001', null, 'la disponibilidad tampoco ofrece fechas a más de un año');
prepare catorce as select crear_prereserva(:'ds', :'d'::date, :'d'::date + 14, 2, 'Ana Pérez', '0991000001', true);
select lives_ok('catorce', '14 noches sí se apartan');
select tests.salir();

-- 2. La web no se cuelga de un huésped existente ni lo modifica; el tope por teléfono sigue y no delata
insert into huespedes (hotel_id, nombre, telefono) values (:'h', 'Juan Cliente', '0997776655') returning id as juan \gset
select tests.anon();
select (crear_prereserva(:'ds', :'d'::date + 20, :'d'::date + 21, 2, 'Otra Persona', '099 777 6655', true)) ->> 'codigo' as cod \gset
select tests.salir();
select isnt((select huesped_id from reservas where codigo = :'cod'), :'juan'::uuid, 'la pre-reserva no queda a nombre del huésped existente');
select is((select g.nombre from reservas r join huespedes g on g.id = r.huesped_id where r.codigo = :'cod'), 'Otra Persona',
  'se usa el nombre enviado');
select is((select consentimiento_en from huespedes where id = :'juan'), null, 'no se toca el consentimiento del huésped existente');
select tests.anon();
select crear_prereserva(:'ds', :'d'::date + 30, :'d'::date + 31, 2, 'Otra Persona', '0997776655', true);
prepare tercera as select crear_prereserva(:'ds', :'d'::date + 40, :'d'::date + 41, 2, 'Otra Persona', '0997776655', true);
select throws_ok('tercera', 'P0001', 'Ahora no podemos apartar más cuartos por la web: escríbenos por WhatsApp',
  'tope por teléfono con mensaje genérico');
select tests.salir();
select is((select count(*)::int from huespedes where hotel_id = :'h' and telefono = '+593997776655'), 3,
  'cada pre-reserva web crea su huésped (la fusión es en el panel)');

-- 3. "Listo" solo desde Limpiando: un doble toque no descuenta el kit dos veces
update habitaciones set estado = 'ocupado' where id = :'r201';
update habitaciones set estado = 'por_limpiar' where id = :'r201';
update habitaciones set estado = 'limpiando' where id = :'r201';
select tests.como('limpieza@test');
select marcar_listo(:'r201');
prepare otra_vez as select marcar_listo(:'r201');
select throws_ok('otra_vez', 'P0001', 'Ese cuarto ya está listo', 'el segundo toque falla con mensaje humano');
select tests.salir();
select is((select count(*)::int from movimientos_insumo where habitacion_id = :'r201' and tipo = 'limpieza'),
  (select count(*)::int from kit_por_tipo k join habitaciones x on x.tipo_id = k.tipo_id where x.id = :'r201' and k.por = 'limpieza'),
  'el kit se descuenta una sola vez');
update habitaciones set estado = 'ocupado' where id = :'r201';
select tests.como('limpieza@test');
prepare ocupado as select marcar_listo(:'r201');
select throws_ok('ocupado', 'P0001', 'Ese cuarto no se está limpiando', 'un cuarto Ocupado no pasa a Listo');
select tests.salir();

-- 4. Auditoría de config (sin la cuenta en claro), usuarios, anulación de ventas y borrado de huéspedes
select tests.como('duena@test');
update config set cuenta_transferencia = '{"banco":"Banco Secreto","numero":"2200334455"}' where hotel_id = :'h';
update usuarios_hotel set activo = false where hotel_id = :'h' and user_id = :'u_lim';
update usuarios_hotel set rol = 'duena' where hotel_id = :'h' and user_id = :'u_lim';
select tests.salir();
select is((select count(*)::int from auditoria where tabla = 'config' and registro_id = :'h' and usuario_id = :'u_duena'), 1,
  'cambiar la cuenta queda auditado con quién');
select ok((select bool_and(coalesce(antes::text, '') || coalesce(despues::text, '') not like '%2200334455%'
                       and coalesce(antes::text, '') || coalesce(despues::text, '') not like '%Banco Secreto%')
           from auditoria where tabla = 'config'), 'la auditoría no guarda la cuenta en claro');
select ok((select despues ? 'cuenta_transferencia' from auditoria where tabla = 'config' and registro_id = :'h'),
  'la auditoría dice que la cuenta cambió');
select is((select despues ->> 'activo' from auditoria where tabla = 'usuarios_hotel' and registro_id = :'u_lim' and despues ? 'activo'),
  'false', 'desactivar un usuario queda auditado');
select is((select despues ->> 'rol' from auditoria where tabla = 'usuarios_hotel' and registro_id = :'u_lim' and despues ? 'rol'),
  'duena', 'cambiar el rol queda auditado');
update usuarios_hotel set rol = 'limpieza', activo = true where hotel_id = :'h' and user_id = :'u_lim';

update productos set precio_venta_centavos = 250 where id = :'cerveza';
insert into reservas (hotel_id, habitacion_id, entrada, salida, personas, estado, fuente)
  values (:'h', :'r202', privado.hoy(), privado.hoy() + 1, 2, 'confirmada', 'telefono') returning id as res \gset
select tests.como('recepcion@test');
select registrar_consumo(:'cerveza', 1, :'res', null) as cargo \gset
select registrar_consumo(:'cerveza', 1, null, 'efectivo') as pagada \gset
select anular_consumo(:'cargo');
select tests.salir();
select is((select usuario_id from auditoria where tabla = 'consumos' and registro_id = :'cargo' and despues ? 'anulado_en'), :'u_rec'::uuid,
  'anular una venta queda auditado con quién');

select tests.como('recepcion@test');
delete from huespedes where id = :'juan';
select tests.salir();
select is((select usuario_id from auditoria where tabla = 'huespedes' and registro_id = :'juan' and accion = 'delete'), :'u_rec'::uuid,
  'borrar un huésped queda auditado con quién');
select is((select antes from auditoria where tabla = 'huespedes' and registro_id = :'juan'), null,
  'la auditoría del borrado no guarda los datos personales');

-- 5. Recepción solo anula ventas no cobradas; las cobradas, la dueña
select tests.como('recepcion@test');
prepare anular_pagada as select anular_consumo(:'pagada');
select throws_ok('anular_pagada', 'P0001', 'Una venta ya cobrada solo la anula la dueña', 'recepción no anula una venta cobrada');
select tests.como('duena@test');
select lives_ok('anular_pagada', 'la dueña sí anula una venta cobrada');
select tests.salir();

-- 6. Rol authenticated sin claims no pasa como backend; service_role y postgres (cron) sí
select set_config('request.jwt.claims', '', true);
select set_config('role', 'authenticated', true);
prepare sin_claims as select cuadre_dia(:'h');
select throws_ok('sin_claims', 'P0001', 'No tienes permiso para hacer esto en este hotel', 'authenticated sin claims no es backend');
select tests.salir();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('role', 'service_role', true);
select lives_ok('sin_claims', 'service_role sí pasa');
select tests.salir();
select lives_ok('sin_claims', 'postgres sin JWT (pg_cron) sí pasa');

-- 7. El catálogo público solo publica las reglas que usa la web
select tests.anon();
select catalogo_publico() -> 'hotel' -> 'reglas' as reglas \gset
select tests.salir();
update hoteles set reglas = reglas || '{"secreto":{"bot":"instrucción interna"}}' where id = :'h';
select ok(not (:'reglas'::jsonb ? 'cancelacion'), 'no publica la instrucción interna del bot');
select ok(:'reglas'::jsonb ? 'piscina' and :'reglas'::jsonb ? 'anticipo' and :'reglas'::jsonb ? 'prereserva_horas',
  'sigue publicando lo que la web muestra');
select tests.anon();
select ok(not ((catalogo_publico() -> 'hotel' -> 'reglas') ? 'secreto'), 'una clave nueva no se publica sola');
select tests.salir();

-- 8. La nota de un daño tiene largo razonable
select tests.como('limpieza@test');
prepare nota_larga as select reportar_dano(:'r201', repeat('x', 501));
select throws_ok('nota_larga', 'P0001', 'La nota es muy larga: escribe máximo 500 letras', 'nota de más de 500 letras falla');
prepare nota_ok as select reportar_dano(:'r201', repeat('x', 500));
select lives_ok('nota_ok', 'nota de 500 letras sí entra');
select tests.salir();

-- 9. Bucket privado (solo en un Supabase con Storage; en la base local no hay storage)
create function pg_temp.bucket_publico() returns boolean language plpgsql as $$
declare v boolean;
begin
  execute 'select public from storage.buckets where id = ''hotel''' into v;
  return v;
end $$;
select case when to_regclass('storage.buckets') is null
  then skip('sin storage en esta base: se verifica en el remoto')
  else ok(not pg_temp.bucket_publico(), 'el bucket hotel es privado') end;

-- Permisos de las funciones recreadas
select ok(not has_function_privilege('anon', 'public.marcar_listo(uuid)', 'execute'), 'anon no ejecuta marcar_listo');
select ok(has_function_privilege('anon', 'public.crear_prereserva(uuid, date, date, int, text, text, boolean, boolean, text)', 'execute'),
  'anon sigue creando pre-reservas (web)');

select * from finish();
rollback;
