-- Hotel Andy · esquema base: tablas, tipos, ayudantes de rol y RLS.
-- Todas las tablas llevan hotel_id. Las relaciones usan FK compuestas (hotel_id, id) para que una fila
-- nunca apunte a otra de un hotel distinto. Dinero en centavos (integer). Stock en numeric.

create extension if not exists btree_gist with schema extensions;

create schema if not exists privado;

create type rol_usuario as enum ('duena', 'recepcion', 'limpieza');
create type estado_habitacion as enum ('libre', 'ocupado', 'por_limpiar', 'limpiando', 'mantenimiento');
create type estado_reserva as enum ('prereserva', 'confirmada', 'en_curso', 'finalizada', 'cancelada');
create type fuente_reserva as enum ('whatsapp', 'telefono', 'web', 'booking', 'airbnb', 'walk_in');
create type canal_venta as enum ('directo', 'booking', 'airbnb');
create type medio_pago as enum ('efectivo', 'transferencia');
create type tipo_movimiento as enum ('compra', 'limpieza', 'venta', 'merma', 'conteo', 'anulacion', 'consumo_diario');
create type kit_por as enum ('limpieza', 'persona');
create type tipo_alerta as enum ('stock_bajo', 'por_limpiar', 'mantenimiento', 'cuarto_no_listo', 'conflicto_ical');

-- Código corto para el huésped (sin 0/O/1/I/L para dictarlo por teléfono).
create function privado.nuevo_codigo() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(b, i) % 31, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) x, generate_series(0, 5) i
$$;

create function privado.hoy() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Guayaquil')::date
$$;

-- +593: los celulares de Ecuador se escriben 09xxxxxxxx; se guardan como +5939xxxxxxxx.
create function privado.normalizar_telefono(p text) returns text language sql immutable set search_path = '' as $$
  select case
    when d ~ '^0\d{9}$' then '+593' || substr(d, 2)
    when length(d) between 8 and 15 then '+' || d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create table hoteles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nombre text not null,
  ciudad text,
  provincia text,
  pais text,
  estrellas int,
  zona_horaria text not null default 'America/Guayaquil',
  moneda text not null default 'USD',
  idioma text not null default 'es-EC',
  dominio text,
  telefono text,
  check_in time,
  check_out time,
  booking_calificacion numeric(3, 1),
  booking_resenas int,
  reglas jsonb not null default '{}',          -- reglas públicas (anticipo, mascotas, piscina...)
  plan text check (plan in ('E', 'C', 'P')),  -- null = sin definir con el cliente (RF-38)
  creado_en timestamptz not null default now()
);

-- Privada: solo la dueña y service_role. Nunca en RPC públicas ni logs.
create table config (
  hotel_id uuid primary key references hoteles on delete cascade,
  cuenta_transferencia jsonb,
  actualizado_en timestamptz not null default now()
);

create table usuarios_hotel (
  hotel_id uuid not null references hoteles on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rol rol_usuario not null,
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key (hotel_id, user_id)
);
create index on usuarios_hotel (user_id);

create table tipos_habitacion (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  clave text not null,
  nombre text not null,
  max_personas int not null check (max_personas between 1 and 20),
  descripcion text,
  orden int not null default 0,
  unique (hotel_id, clave),
  unique (hotel_id, id)
);

create table habitaciones (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  tipo_id uuid not null,
  numero text not null,
  piso int not null,
  estado estado_habitacion not null default 'libre',
  estado_desde timestamptz not null default now(),
  activa boolean not null default true,
  unique (hotel_id, numero),
  unique (hotel_id, id),
  foreign key (hotel_id, tipo_id) references tipos_habitacion (hotel_id, id)
);

-- La temporada base (es_base) cubre todo día que no caiga en otra. Las demás se marcan con fechas.
create table temporadas (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  clave text,
  nombre text not null,
  es_base boolean not null default false,
  fechas datemultirange not null default '{}',
  unique (hotel_id, clave),
  unique (hotel_id, id)
);
create unique index temporadas_una_base on temporadas (hotel_id) where es_base;

-- temporada_id null = el mismo precio todo el año (Booking).
create table tarifas (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  tipo_id uuid not null,
  canal canal_venta not null,
  temporada_id uuid,
  precio_centavos int not null check (precio_centavos >= 0),
  unique nulls not distinct (tipo_id, canal, temporada_id),
  foreign key (hotel_id, tipo_id) references tipos_habitacion (hotel_id, id) on delete cascade,
  foreign key (hotel_id, temporada_id) references temporadas (hotel_id, id) on delete cascade
);

create table huespedes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  documento text,
  telefono text,
  procedencia text,
  notas text,
  consentimiento_en timestamptz,               -- LOPDP: cuándo aceptó que guardemos sus datos
  acepta_campanas boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (hotel_id, id)
);
create index on huespedes (hotel_id, telefono);

create table reservas (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  codigo text not null default privado.nuevo_codigo(),
  habitacion_id uuid not null,
  huesped_id uuid,
  entrada date not null,
  salida date not null,
  personas int not null check (personas > 0),
  mascota boolean not null default false,
  estado estado_reserva not null default 'prereserva',
  fuente fuente_reserva not null,
  canal canal_venta not null,                  -- congelado al crear (se deduce de la fuente si no viene)
  total_centavos int check (total_centavos >= 0), -- congelado al crear; null solo si el canal no tiene tarifa
  vence_en timestamptz,                        -- solo pre-reservas
  notas text,
  motivo_cancelacion text,
  ical_uid text,
  check_in_en timestamptz,
  check_in_por uuid,
  check_out_en timestamptz,
  check_out_por uuid,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  check (salida > entrada),
  unique (hotel_id, codigo),
  unique (hotel_id, ical_uid),
  unique (hotel_id, id),
  foreign key (hotel_id, habitacion_id) references habitaciones (hotel_id, id),
  foreign key (hotel_id, huesped_id) references huespedes (hotel_id, id) on delete set null (huesped_id),
  -- RF-24: cero reservas cruzadas. Salida y entrada el mismo día no chocan ('[)').
  constraint sin_cruces exclude using gist (habitacion_id with =, daterange(entrada, salida, '[)') with &&)
    where (estado in ('prereserva', 'confirmada', 'en_curso'))
);
create index on reservas (hotel_id, entrada);
create index on reservas (estado, vence_en) where estado = 'prereserva';

create table pagos (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  reserva_id uuid not null,
  monto_centavos int not null check (monto_centavos > 0),
  medio medio_pago not null,
  comprobante_path text,                       -- Storage: hotel/<hotel_id>/...
  registrado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (hotel_id, reserva_id) references reservas (hotel_id, id)
);
create index on pagos (reserva_id);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  clave text,
  nombre text not null check (length(trim(nombre)) > 0),
  icono text,
  orden int not null default 0,
  unique (hotel_id, clave),
  unique (hotel_id, id)
);

-- Un solo inventario: insumos y productos de venta. Stock null = sin contar. Solo lo cambia movimientos_insumo.
create table productos (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  categoria_id uuid not null,
  clave text,
  nombre text not null check (length(trim(nombre)) > 0),
  unidad text not null default 'unidad',
  foto_path text,
  stock numeric,
  minimo numeric check (minimo >= 0),
  se_vende boolean not null default false,
  precio_compra_centavos int check (precio_compra_centavos >= 0),
  precio_venta_centavos int check (precio_venta_centavos >= 0),
  consumo_diario numeric check (consumo_diario > 0), -- p. ej. cloro 0,5 kg por día
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (hotel_id, clave),
  unique (hotel_id, id),
  foreign key (hotel_id, categoria_id) references categorias (hotel_id, id) -- no se borra una categoría con productos
);

create table kit_por_tipo (
  hotel_id uuid not null references hoteles on delete cascade,
  tipo_id uuid not null,
  producto_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  por kit_por not null,
  primary key (tipo_id, producto_id),
  foreign key (hotel_id, tipo_id) references tipos_habitacion (hotel_id, id) on delete cascade,
  foreign key (hotel_id, producto_id) references productos (hotel_id, id) on delete cascade
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  proveedor text not null check (length(trim(proveedor)) > 0),
  numero_factura text,
  fecha date not null,
  foto_path text,
  total_centavos int not null check (total_centavos >= 0),
  creada_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  anulada_en timestamptz,
  anulada_por uuid,
  motivo_anulacion text,
  unique (hotel_id, id)
);
create unique index compras_sin_duplicar on compras (hotel_id, lower(proveedor), numero_factura)
  where anulada_en is null and numero_factura is not null;

create table compras_lineas (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  compra_id uuid not null,
  producto_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  costo_unit_centavos int not null check (costo_unit_centavos >= 0),
  foreign key (hotel_id, compra_id) references compras (hotel_id, id),
  foreign key (hotel_id, producto_id) references productos (hotel_id, id)
);

-- consumo cargado al cuarto: reserva_id y medio null (pendiente). Pagado: medio y pagado_en.
create table consumos (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  producto_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  precio_unit_centavos int not null check (precio_unit_centavos >= 0), -- congelado al vender
  costo_unit_centavos int,                                             -- congelado para el margen
  total_centavos int generated always as (round(cantidad * precio_unit_centavos)::int) stored,
  reserva_id uuid,
  medio medio_pago,
  pagado_en timestamptz,
  registrado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  check (reserva_id is not null or medio is not null),
  check ((medio is null) = (pagado_en is null)),
  unique (hotel_id, id),
  foreign key (hotel_id, producto_id) references productos (hotel_id, id),
  foreign key (hotel_id, reserva_id) references reservas (hotel_id, id)
);
create index on consumos (hotel_id, creado_en);
create index on consumos (reserva_id) where medio is null;

create table movimientos_insumo (
  id bigint generated always as identity primary key,
  hotel_id uuid not null references hoteles on delete cascade,
  producto_id uuid not null,
  tipo tipo_movimiento not null,
  cantidad numeric not null,                   -- con signo: + entra, − sale
  stock_resultante numeric,                    -- null si el producto sigue sin contar
  habitacion_id uuid,
  compra_id uuid,
  consumo_id uuid,
  nota text,
  usuario_id uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  foreign key (hotel_id, producto_id) references productos (hotel_id, id),
  foreign key (hotel_id, habitacion_id) references habitaciones (hotel_id, id),
  foreign key (hotel_id, compra_id) references compras (hotel_id, id),
  foreign key (hotel_id, consumo_id) references consumos (hotel_id, id)
);
create index on movimientos_insumo (producto_id, creado_en);

create table reportes_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  habitacion_id uuid not null,
  nota text not null check (length(trim(nota)) > 0),
  foto_path text,
  reportado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid,
  foreign key (hotel_id, habitacion_id) references habitaciones (hotel_id, id)
);

create table alertas (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  tipo tipo_alerta not null,
  mensaje text not null,
  producto_id uuid,
  habitacion_id uuid,
  reserva_id uuid,
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz,
  notificada_en timestamptz,                   -- cuándo salió por WhatsApp (RF-31 plan C)
  foreign key (hotel_id, producto_id) references productos (hotel_id, id) on delete cascade,
  foreign key (hotel_id, habitacion_id) references habitaciones (hotel_id, id) on delete cascade,
  foreign key (hotel_id, reserva_id) references reservas (hotel_id, id) on delete cascade
);
-- RF-31: una sola alerta abierta por producto.
create unique index alertas_una_por_producto on alertas (producto_id) where tipo = 'stock_bajo' and resuelta_en is null;
create index on alertas (hotel_id) where resuelta_en is null;

create table mensajes_whatsapp (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  direccion text not null check (direccion in ('entrante', 'saliente')),
  telefono text not null,
  wa_message_id text unique,                   -- idempotencia del webhook (RNF-04)
  plantilla text,
  contenido jsonb not null default '{}',
  estado text,
  reserva_id uuid,
  creado_en timestamptz not null default now(),
  foreign key (hotel_id, reserva_id) references reservas (hotel_id, id) on delete set null (reserva_id)
);

create table nfc_destinos (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  lugar text not null check (lugar ~ '^[a-z0-9-]+$'),
  url text not null check (url ~ '^https://'),
  activo boolean not null default true,
  unique (hotel_id, lugar),
  unique (hotel_id, id)
);

create table nfc_toques (
  id bigint generated always as identity primary key,
  hotel_id uuid not null references hoteles on delete cascade,
  destino_id uuid not null,
  creado_en timestamptz not null default now(),
  foreign key (hotel_id, destino_id) references nfc_destinos (hotel_id, id) on delete cascade
);

create table calendarios_ical (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  habitacion_id uuid not null,
  canal canal_venta not null,
  url_importar text,
  token_exportar text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ultima_sincronizacion timestamptz,
  ultimo_error text,
  activo boolean not null default true,
  unique (habitacion_id, canal),
  unique (token_exportar),
  foreign key (hotel_id, habitacion_id) references habitaciones (hotel_id, id) on delete cascade
);

-- RF-35: solo inserción, escrita por triggers.
create table auditoria (
  id bigint generated always as identity primary key,
  hotel_id uuid not null references hoteles on delete cascade,
  tabla text not null,
  registro_id uuid not null,
  accion text not null,
  usuario_id uuid default auth.uid(),
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
create index on auditoria (hotel_id, registro_id);

-- ── Roles ───────────────────────────────────────────────────────────────────

create function privado.rol_en(p_hotel uuid) returns rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.usuarios_hotel where hotel_id = p_hotel and user_id = auth.uid() and activo
$$;

-- Para RPC: deja pasar al backend de confianza (sin JWT: cron/psql; o service_role) y a los roles pedidos.
create function privado.exigir_rol(p_hotel uuid, p_roles rol_usuario[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null and coalesce(auth.role(), 'service_role') = 'service_role' then return; end if;
  if coalesce(privado.rol_en(p_hotel) = any (p_roles), false) then return; end if;
  raise exception 'No tienes permiso para hacer esto en este hotel';
end $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- staff = cualquier rol del hotel · gestion = dueña y recepción · duena = solo la dueña.
-- p_escribe null = nadie escribe directo: solo por RPC.
create function privado.rls(p_tabla text, p_lee text, p_escribe text) returns void language plpgsql as $$
declare
  cond constant jsonb := jsonb_build_object(
    'staff', 'privado.rol_en(hotel_id) is not null',
    'gestion', 'privado.rol_en(hotel_id) in (''duena'', ''recepcion'')',
    'duena', 'privado.rol_en(hotel_id) = ''duena''');
begin
  execute format('alter table public.%I enable row level security', p_tabla);
  execute format('create policy lee on public.%I for select to authenticated using (%s)', p_tabla, cond ->> p_lee);
  if p_escribe is not null then
    execute format('create policy escribe on public.%I for all to authenticated using (%s) with check (%s)',
      p_tabla, cond ->> p_escribe, cond ->> p_escribe);
  end if;
end $$;

do $$ begin perform privado.rls(t, lee, escribe) from (values
  ('config', 'duena', 'duena'),
  ('tipos_habitacion', 'staff', 'duena'),
  ('habitaciones', 'staff', 'gestion'),          -- el cambio de estado lo valida un trigger
  ('temporadas', 'gestion', 'duena'),
  ('tarifas', 'gestion', 'duena'),
  ('huespedes', 'gestion', 'gestion'),
  ('reservas', 'gestion', 'gestion'),
  ('pagos', 'gestion', null),
  ('categorias', 'gestion', 'gestion'),
  ('productos', 'gestion', 'gestion'),           -- el stock lo protege un trigger
  ('kit_por_tipo', 'gestion', 'duena'),
  ('compras', 'gestion', null),
  ('compras_lineas', 'gestion', null),
  ('consumos', 'gestion', null),
  ('movimientos_insumo', 'gestion', null),
  ('reportes_mantenimiento', 'staff', null),
  ('alertas', 'gestion', 'gestion'),
  ('mensajes_whatsapp', 'gestion', null),
  ('nfc_destinos', 'gestion', 'duena'),
  ('nfc_toques', 'gestion', null),
  ('calendarios_ical', 'gestion', 'duena'),
  ('auditoria', 'duena', null)
) v (t, lee, escribe); end $$;

alter table hoteles enable row level security;
create policy lee on hoteles for select to authenticated using (privado.rol_en(id) is not null);
create policy escribe on hoteles for update to authenticated
  using (privado.rol_en(id) = 'duena') with check (privado.rol_en(id) = 'duena');

alter table usuarios_hotel enable row level security;
create policy lee on usuarios_hotel for select to authenticated
  using (user_id = auth.uid() or privado.rol_en(hotel_id) = 'duena');
create policy escribe on usuarios_hotel for all to authenticated
  using (privado.rol_en(hotel_id) = 'duena') with check (privado.rol_en(hotel_id) = 'duena');

-- ── Permisos ────────────────────────────────────────────────────────────────
-- anon (la web) no toca tablas: solo RPC públicas. authenticated pasa por RLS.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on auditoria from authenticated;
alter default privileges in schema public revoke all on tables from anon;

revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;
revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
-- Postgres da EXECUTE a PUBLIC en cada función nueva: cada migración que cree funciones repite los revoke/grant.
