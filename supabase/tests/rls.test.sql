-- RF-39, RNF-05: aislamiento entre hoteles, roles y visitante anónimo.
begin;
select plan(19);

select id as h from hoteles where slug = 'hotel-andy' \gset
select tests.crear_usuario('duena@test') as u_duena \gset
select tests.crear_usuario('recepcion@test') as u_rec \gset
select tests.crear_usuario('limpieza@test') as u_lim \gset
select tests.crear_usuario('duena-b@test') as u_b \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
  (:'h', :'u_duena', 'duena', 'Dueña'), (:'h', :'u_rec', 'recepcion', 'Recepción'), (:'h', :'u_lim', 'limpieza', 'Camarera');

-- Hotel B con al menos una fila en cada tabla
insert into hoteles (slug, nombre) values ('hotel-b', 'Hotel B') returning id as hb \gset
insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values (:'hb', :'u_b', 'duena', 'Dueña B');
insert into config (hotel_id, cuenta_transferencia) values (:'hb', '{"banco":"B"}');
insert into tipos_habitacion (hotel_id, clave, nombre, max_personas) values (:'hb', 'doble', 'Doble', 2) returning id as tb \gset
insert into habitaciones (hotel_id, tipo_id, numero, piso) values (:'hb', :'tb', '1', 1) returning id as rb \gset
insert into temporadas (hotel_id, nombre, es_base) values (:'hb', 'Baja', true) returning id as sb \gset
insert into tarifas (hotel_id, tipo_id, canal, temporada_id, precio_centavos) values (:'hb', :'tb', 'directo', :'sb', 1000);
insert into huespedes (hotel_id, nombre, telefono) values (:'hb', 'Huésped B', '0990000000') returning id as gb \gset
insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente)
  values (:'hb', :'rb', :'gb', privado.hoy(), privado.hoy() + 1, 1, 'confirmada', 'telefono') returning id as resb \gset
insert into pagos (hotel_id, reserva_id, monto_centavos, medio) values (:'hb', :'resb', 500, 'efectivo');
insert into categorias (hotel_id, clave, nombre) values (:'hb', 'bebidas', 'Bebidas') returning id as cb \gset
insert into productos (hotel_id, categoria_id, clave, nombre, unidad, se_vende, precio_venta_centavos)
  values (:'hb', :'cb', 'agua', 'Agua', 'botella', true, 100) returning id as pb \gset
insert into kit_por_tipo (hotel_id, tipo_id, producto_id, cantidad, por) values (:'hb', :'tb', :'pb', 1, 'limpieza');
select ajustar_stock(:'pb', 'conteo', 1);
select cargar_factura(:'hb', 'Prov B', 'F-1', privado.hoy(), jsonb_build_array(jsonb_build_object('producto_id', :'pb', 'cantidad', 10, 'costo_unit_centavos', 50)));
select registrar_consumo(:'pb', 1, :'resb', null);
select reportar_dano(:'rb', 'Daño B', null);
insert into mensajes_whatsapp (hotel_id, direccion, telefono, contenido) values (:'hb', 'entrante', '0990000000', '{}');
insert into nfc_destinos (hotel_id, lugar, url) values (:'hb', 'piscina', 'https://example.com') returning id as nb \gset
insert into nfc_toques (hotel_id, destino_id) values (:'hb', :'nb');
insert into calendarios_ical (hotel_id, habitacion_id, canal) values (:'hb', :'rb', 'booking');

-- Estructura: todas las tablas con hotel_id y RLS
select is(array(select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '{}'::text[], 'RLS activo en todas las tablas');
select is(array(select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind = 'r'
                  and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname in ('hotel_id') and not a.attisdropped)
                  and c.relname <> 'hoteles'), '{}'::text[], 'todas las tablas llevan hotel_id');

create function pg_temp.filas(p_tabla text, p_hotel uuid) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where %I = $1', p_tabla, case when p_tabla = 'hoteles' then 'id' else 'hotel_id' end)
    into n using p_hotel;
  return n;
end $$;
grant execute on function pg_temp.filas(text, uuid) to authenticated;
create temp view tablas as select c.oid, c.relname::text as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
grant select on tablas to authenticated;

select is(array(select t from tablas where pg_temp.filas(t, :'hb') = 0), '{}'::text[], 'el hotel B tiene filas en todas las tablas (el test no es vacío)');

-- Hotel A no ve ni escribe nada del hotel B
select tests.como('duena@test');
select is(array(select t from tablas where pg_temp.filas(t, :'hb') > 0), '{}'::text[], 'la dueña de A no ve nada del hotel B, en ninguna tabla');
prepare escribir_b as insert into productos (hotel_id, categoria_id, clave, nombre, unidad) values (:'hb', :'cb', 'x', 'X', 'u');
select throws_ok('escribir_b', '42501', null, 'la dueña de A no inserta en el hotel B');
update habitaciones set numero = 'hackeado' where id = :'rb';
prepare checkin_b as select check_in(:'resb');
select throws_ok('checkin_b', 'P0001', null, 'la dueña de A no opera reservas del hotel B por RPC');
prepare cuadre_b as select cuadre_dia(:'hb');
select throws_ok('cuadre_b', 'P0001', null, 'la dueña de A no ve el cuadre del hotel B');
select is((select count(*)::int from config), 1, 'la dueña ve su configuración privada');
select tests.salir();
select is((select numero from habitaciones where id = :'rb'), '1', 'la dueña de A no modifica nada del hotel B');

select tests.como('duena-b@test');
select is(array(select t from tablas where pg_temp.filas(t, :'h') > 0), '{}'::text[], 'y al revés: B no ve nada del hotel A');
select tests.salir();

-- Rol limpieza: sin huéspedes, pagos ni dinero
insert into huespedes (hotel_id, nombre, telefono) values (:'h', 'Huésped A', '0991111111') returning id as ga \gset
insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente)
  select :'h', id, :'ga', privado.hoy(), privado.hoy() + 1, 1, 'confirmada', 'telefono' from habitaciones where hotel_id = :'h' and numero = '301'
  returning id as resa \gset
insert into pagos (hotel_id, reserva_id, monto_centavos, medio) values (:'h', :'resa', 1750, 'transferencia');
select tests.como('limpieza@test');
select is(array(select t from tablas where pg_temp.filas(t, :'h') > 0 order by t),
  array['habitaciones', 'hoteles', 'tipos_habitacion', 'usuarios_hotel'],
  'limpieza no ve huéspedes, reservas, pagos, productos ni dinero: solo cuartos, tipos, su hotel y su usuario');
select is((select count(*)::int from usuarios_hotel), 1, 'limpieza solo ve su propio usuario');
select is((select count(*)::int from cuartos_por_limpiar(:'h')), 0, 'la vista de camarera funciona para limpieza');
prepare resumen_limpieza as select resumen_inicio(:'h');
select throws_ok('resumen_limpieza', 'P0001', null, 'limpieza no ve el resumen con dinero');
select tests.como('recepcion@test');
select is((select count(*)::int from config), 0, 'recepción no ve la cuenta bancaria');
prepare borrar_auditoria as delete from auditoria;
select throws_ok('borrar_auditoria', '42501', null, 'la auditoría no se borra');
select tests.salir();

-- Visitante anónimo: ninguna tabla, solo las RPC públicas
select is(array(select t from tablas where has_table_privilege('anon', oid, 'select,insert,update,delete')),
  '{}'::text[], 'anon no lee ni escribe ninguna tabla directamente');
update config set cuenta_transferencia = '{"numero":"CUENTA-SECRETA-123"}' where hotel_id = :'h';
select tests.anon();
prepare anon_checkin as select check_in(:'resb');
select throws_ok('anon_checkin', '42501', null, 'anon no llama RPC del panel');
select ok(catalogo_publico()::text not like '%CUENTA-SECRETA-123%', 'el catálogo público no expone la cuenta bancaria');
select tests.salir();

select * from finish();
rollback;
