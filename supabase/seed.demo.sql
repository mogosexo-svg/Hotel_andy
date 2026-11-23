-- AVISO  DEMO · DATOS FICTICIOS · NUNCA EN PRODUCCIÓN
-- Usuarios de prueba y ~30 días de reservas, limpiezas, compras y consumos inventados para que el panel
-- y los gráficos tengan datos en desarrollo. No está en config.toml: se aplica a mano, solo en local:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.demo.sql
--   (o scripts/test-db.sh --demo en el plan B sin Docker)
-- Se niega a correr si el hotel ya tiene reservas. Contraseña de los tres usuarios: demo-hotel-andy
begin;

do $$
declare
  hid constant uuid := '00000000-0000-4000-8000-0000000a0d1e';
  u_duena constant uuid := '00000000-0000-4000-8000-00000000de01';
  u_rec constant uuid := '00000000-0000-4000-8000-00000000de02';
  u_lim constant uuid := '00000000-0000-4000-8000-00000000de03';
  hoy constant date := privado.hoy();
  zona constant text := 'America/Guayaquil';
  nombres constant text[] := array['María Quiñónez', 'Carlos Cevallos', 'Lucía Bravo', 'Andrés Vera', 'Gabriela Mina',
    'Jorge Cortez', 'Valeria Ortiz', 'Diego Montaño', 'Paola Castillo', 'Luis Preciado', 'Daniela Arroyo', 'Fernando Ayoví',
    'Sofía Valencia', 'Miguel Caicedo', 'Camila Reascos', 'José Estupiñán', 'Andrea Quintero', 'Ricardo Angulo'];
  fuentes constant fuente_reserva[] := array['whatsapp', 'whatsapp', 'whatsapp', 'telefono', 'web', 'booking', 'booking',
    'booking', 'walk_in', 'walk_in']::fuente_reserva[];
  hab record;
  d date;
  noches int;
  v_fuente fuente_reserva;
  v_estado estado_reserva;
  v_total int;
  v_res uuid;
  v_compra uuid;
  f record;
begin
  if exists (select 1 from reservas where hotel_id = hid) then
    raise exception 'Esta base ya tiene reservas: seed.demo.sql solo va en una base local recién creada';
  end if;
  perform setseed(0.42);

  -- Usuarios de prueba (Supabase Auth)
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
    extensions.crypt('demo-hotel-andy', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', u.nombre), now(), now(), '', '', '', ''
  from (values (u_duena, 'duena@demo.test', 'Dueña (demo)'), (u_rec, 'recepcion@demo.test', 'Recepción (demo)'),
               (u_lim, 'limpieza@demo.test', 'Camarera (demo)')) u (id, email, nombre);
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users where id in (u_duena, u_rec, u_lim);
  insert into usuarios_hotel (hotel_id, user_id, rol, nombre) values
    (hid, u_duena, 'duena', 'Dueña (demo)'), (hid, u_rec, 'recepcion', 'Recepción (demo)'), (hid, u_lim, 'limpieza', 'Camarera (demo)');

  -- Precios de venta y conteo de lencería (inventados)
  update productos set precio_venta_centavos = v.precio
  from (values ('cerveza', 250), ('agua', 100), ('powerade', 200)) v (clave, precio)
  where productos.hotel_id = hid and productos.clave = v.clave;
  insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota, usuario_id, creado_en)
  select hid, id, 'conteo', v.n, 'DEMO: conteo inicial', u_rec, (hoy - 30 + time '09:00') at time zone zona
  from productos join (values ('sabanas', 260), ('toallas', 480)) v (clave, n) using (clave) where hotel_id = hid;

  -- Facturas
  for f in select * from (values
    (hoy - 28, 'Distribuidora Atacames (demo)', 'D-0101', '[["papel",200,45],["jabon",250,30],["cloro",8,350]]'),
    (hoy - 20, 'Bebidas del Pacífico (demo)', 'B-2208', '[["cerveza",120,150],["agua",96,50],["powerade",96,120]]'),
    (hoy - 7, 'Distribuidora Atacames (demo)', 'D-0117', '[["papel",100,45],["jabon",150,30],["cloro",5,350]]')
  ) x (fecha, proveedor, numero, lineas) loop
    insert into compras (hotel_id, proveedor, numero_factura, fecha, total_centavos, creada_por, creado_en)
    select hid, f.proveedor, f.numero, f.fecha, sum((l ->> 1)::int * (l ->> 2)::int), u_rec, (f.fecha + time '10:00') at time zone zona
    from jsonb_array_elements(f.lineas::jsonb) l
    returning id into v_compra;
    insert into compras_lineas (hotel_id, compra_id, producto_id, cantidad, costo_unit_centavos)
    select hid, v_compra, p.id, (l ->> 1)::numeric, (l ->> 2)::int
    from jsonb_array_elements(f.lineas::jsonb) l join productos p on p.hotel_id = hid and p.clave = l ->> 0;
    insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, compra_id, usuario_id, creado_en)
    select hid, producto_id, 'compra', cantidad, v_compra, u_rec, (f.fecha + time '10:00') at time zone zona
    from compras_lineas where compra_id = v_compra;
    update productos p set precio_compra_centavos = l.costo_unit_centavos
    from compras_lineas l where l.compra_id = v_compra and p.id = l.producto_id;
  end loop;

  -- Reservas: hace 30 días hasta dentro de 14, ~60 % de ocupación
  for hab in select h.id, t.id as tipo_id, t.max_personas from habitaciones h join tipos_habitacion t on t.id = h.tipo_id
             where h.hotel_id = hid order by h.numero loop
    d := hoy - 30 + floor(random() * 3)::int;
    while d < hoy + 14 loop
      noches := 1 + floor(random() * 4)::int;
      if random() < 0.6 then
        v_fuente := fuentes[1 + floor(random() * array_length(fuentes, 1))::int];
        v_estado := case when d + noches <= hoy then 'finalizada' when d < hoy then 'en_curso'
                         when d > hoy + 1 and v_fuente in ('web', 'whatsapp') and random() < 0.3 then 'prereserva'
                         else 'confirmada' end;
        v_total := case when v_fuente = 'booking' then privado.cotizar(hab.tipo_id, 'directo', d, d + noches) end;
        insert into huespedes (hotel_id, nombre, telefono, procedencia, consentimiento_en, notas)
        values (hid, nombres[1 + floor(random() * array_length(nombres, 1))::int],
                '+59399' || lpad(floor(random() * 10000000)::text, 7, '0'),
                (array['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Santo Domingo', 'Bogotá'])[1 + floor(random() * 6)::int],
                now(), 'DEMO')
        returning id into v_res;
        insert into reservas (hotel_id, habitacion_id, huesped_id, entrada, salida, personas, estado, fuente, total_centavos,
          vence_en, check_in_en, check_in_por, check_out_en, check_out_por, creado_por, creado_en, notas)
        values (hid, hab.id, v_res, d, d + noches, 1 + floor(random() * hab.max_personas)::int, v_estado, v_fuente, v_total,
          case when v_estado = 'prereserva' then now() + interval '90 minutes' end,
          case when v_estado in ('en_curso', 'finalizada') then (d + time '14:00') at time zone zona end,
          case when v_estado in ('en_curso', 'finalizada') then u_rec end,
          case when v_estado = 'finalizada' then (d + noches + time '11:00') at time zone zona end,
          case when v_estado = 'finalizada' then u_rec end,
          u_rec, (d - 3 - floor(random() * 10)::int + time '10:00') at time zone zona, 'DEMO')
        returning id into v_res;
        d := d + noches;
      else
        d := d + 1 + floor(random() * 2)::int;
      end if;
    end loop;
  end loop;

  -- Pagos de venta directa: anticipo del 50 % y el saldo al entrar
  insert into pagos (hotel_id, reserva_id, monto_centavos, medio, registrado_por, creado_en)
  select hid, id, total_centavos / 2, 'transferencia', u_rec, creado_en + interval '1 hour'
  from reservas where hotel_id = hid and canal = 'directo' and estado in ('confirmada', 'en_curso', 'finalizada');
  insert into pagos (hotel_id, reserva_id, monto_centavos, medio, registrado_por, creado_en)
  select hid, id, total_centavos - total_centavos / 2, (array['efectivo', 'transferencia']::medio_pago[])[1 + floor(random() * 2)::int],
    u_rec, check_in_en
  from reservas where hotel_id = hid and canal = 'directo' and estado in ('en_curso', 'finalizada');

  -- Consumos: algunos cargados al cuarto (cobrados al salir), otros pagados en el momento
  insert into consumos (hotel_id, producto_id, cantidad, precio_unit_centavos, costo_unit_centavos, reserva_id, medio,
    pagado_en, registrado_por, creado_en)
  select hid, p.id, 1 + floor(random() * 3)::int, p.precio_venta_centavos, p.precio_compra_centavos, r.id, m.medio,
    case when m.medio is not null then coalesce(r.check_out_en, r.check_in_en + interval '5 hours') end,
    u_rec, r.check_in_en + interval '5 hours'
  from reservas r
  cross join lateral (select * from productos where hotel_id = hid and se_vende and r.id is not null order by random() limit 1) p
  cross join lateral (select case when r.estado = 'finalizada' or random() < 0.5
    then (array['efectivo', 'transferencia']::medio_pago[])[1 + floor(random() * 2)::int] end as medio) m
  where r.hotel_id = hid and r.estado in ('en_curso', 'finalizada') and random() < 0.6;

  insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, consumo_id, usuario_id, creado_en)
  select hid, producto_id, 'venta', -cantidad, id, u_rec, creado_en from consumos where hotel_id = hid order by creado_en;

  -- Limpiezas de cada salida (kit por tipo, toallas × huéspedes) y cloro diario
  insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, habitacion_id, usuario_id, creado_en)
  select hid, k.producto_id, 'limpieza', -k.cantidad * case k.por when 'persona' then r.personas else 1 end, r.habitacion_id, u_lim,
    (r.salida + time '13:00') at time zone zona
  from reservas r join habitaciones h on h.id = r.habitacion_id join kit_por_tipo k on k.tipo_id = h.tipo_id
  where r.hotel_id = hid and r.estado = 'finalizada' and r.salida < hoy
  order by r.salida;
  insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota, creado_en)
  select hid, p.id, 'consumo_diario', -p.consumo_diario, 'Consumo diario', (g::date + time '00:05') at time zone zona
  from productos p cross join generate_series(hoy - 30, hoy - 1, interval '1 day') g
  where p.hotel_id = hid and p.consumo_diario is not null order by g;

  -- Estado de hoy: ocupados, por limpiar (salieron hoy), uno limpiando y uno en arreglo
  update habitaciones set estado = 'ocupado'
  where id in (select habitacion_id from reservas where hotel_id = hid and estado = 'en_curso');
  update habitaciones set estado = 'ocupado'
  where estado = 'libre' and id in (select habitacion_id from reservas where hotel_id = hid and estado = 'finalizada' and salida = hoy);
  update habitaciones set estado = 'por_limpiar'
  where estado = 'ocupado' and id in (select habitacion_id from reservas where hotel_id = hid and estado = 'finalizada' and salida = hoy)
    and id not in (select habitacion_id from reservas where hotel_id = hid and estado = 'en_curso');
  insert into alertas (hotel_id, tipo, habitacion_id, mensaje)
  select hid, 'por_limpiar', id, format('Cuarto %s desocupado, a limpiar', numero) from habitaciones where hotel_id = hid and estado = 'por_limpiar';
  update habitaciones set estado = 'limpiando'
  where id = (select id from habitaciones where hotel_id = hid and estado = 'por_limpiar' order by numero limit 1);
  perform reportar_dano((select id from habitaciones where hotel_id = hid and estado = 'libre' order by numero desc limit 1),
    'DEMO: el aire acondicionado no enfría', null);

  -- NFC (destinos de ejemplo, no son los reales)
  insert into nfc_destinos (hotel_id, lugar, url) values
    (hid, 'piscina', 'https://example.com/resena-demo'), (hid, 'llavero', 'https://example.com/resena-demo');
  insert into nfc_toques (hotel_id, destino_id, creado_en)
  select hid, n.id, now() - random() * interval '30 days' from nfc_destinos n, generate_series(1, 12) where n.hotel_id = hid;
end $$;

commit;
