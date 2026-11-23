-- Hotel Andy · cierres de caja (2 al día: tarde y noche). Cada cierre cuenta lo que entró desde el anterior
-- (pagos de reservas + ventas cobradas, por medio), guarda el efectivo contado y la diferencia, y deja un
-- mensaje corto listo para WhatsApp (n8n lo envía escuchando los INSERT de cierres_caja).
-- Horas en hoteles.reglas.cierres_caja {tarde, noche} (por defecto 15:00 y 22:00, America/Guayaquil).

-- Se usa solo dentro de cuerpos plpgsql: así la migración corre en una transacción.
alter type tipo_alerta add value if not exists 'cierre_caja';

create table cierres_caja (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  turno text not null check (turno in ('tarde', 'noche')),
  fecha date not null,                         -- día en Guayaquil al que pertenece el turno
  desde timestamptz not null,
  hasta timestamptz not null,
  efectivo_esperado_centavos int not null check (efectivo_esperado_centavos >= 0),
  transferencia_centavos int not null check (transferencia_centavos >= 0),
  total_centavos int generated always as (efectivo_esperado_centavos + transferencia_centavos) stored,
  efectivo_contado_centavos int not null check (efectivo_contado_centavos >= 0),
  diferencia_centavos int generated always as (efectivo_contado_centavos - efectivo_esperado_centavos) stored,
  nota text,
  mensaje text not null,                       -- resumen para WhatsApp
  cerrado_por uuid default auth.uid(),
  cerrado_en timestamptz not null default now(),
  unique (hotel_id, fecha, turno),
  check (hasta >= desde)
);
create index on cierres_caja (hotel_id, hasta desc);

-- Leen dueña y recepción; nadie escribe directo (solo RPC).
do $$ begin perform privado.rls('cierres_caja', 'gestion', null); end $$;
revoke all on cierres_caja from anon;
create trigger auditar after insert or update on cierres_caja for each row execute function privado.auditar();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.cierres_caja;
  end if;
end $$;

-- Alerta "Toca el cierre de...": una sola abierta por hotel, fecha y turno.
alter table alertas add column caja_fecha date, add column caja_turno text check (caja_turno in ('tarde', 'noche'));
create unique index alertas_una_por_cierre on alertas (hotel_id, caja_fecha, caja_turno)
  where resuelta_en is null and caja_turno is not null;

-- Horas por defecto en el hotel ya cargado (por confirmar con el cliente; el seed las trae de data/hotel.json).
update hoteles set reglas = reglas || '{"cierres_caja": {"tarde": "15:00", "noche": "22:00"}}' where not reglas ? 'cierres_caja';

-- ── Ayudantes ───────────────────────────────────────────────────────────────

-- $1.234,50
create function privado.dolares(p_centavos int) returns text language sql immutable set search_path = '' as $$
  select '$' || translate(to_char(p_centavos / 100.0, 'FM999,999,999,990.00'), ',.', '.,')
$$;

create function privado.hora_cierre(p_hotel uuid, p_turno text) returns time language sql stable set search_path = '' as $$
  select coalesce((select (reglas -> 'cierres_caja' ->> p_turno)::time from public.hoteles where id = p_hotel),
    case p_turno when 'tarde' then time '15:00' else time '22:00' end)
$$;

-- Qué turno toca. Antes de la hora de la tarde, si ayer se cerró la tarde pero no la noche, sigue la noche de ayer
-- (cierre pasada la medianoche). Si hoy ya se cerró la noche, no queda nada: cerrado = true.
create function privado.turno_caja(p_hotel uuid, p_ahora timestamptz default now(),
  out fecha date, out turno text, out hora time, out cerrado boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'America/Guayaquil';
  v_hoy date := v_local::date;
begin
  if v_local::time < privado.hora_cierre(p_hotel, 'tarde')
     and exists (select 1 from public.cierres_caja c where c.hotel_id = p_hotel and c.fecha = v_hoy - 1 and c.turno = 'tarde')
     and not exists (select 1 from public.cierres_caja c where c.hotel_id = p_hotel and c.fecha = v_hoy - 1 and c.turno = 'noche') then
    fecha := v_hoy - 1; turno := 'noche'; cerrado := false;
  elsif exists (select 1 from public.cierres_caja c where c.hotel_id = p_hotel and c.fecha = v_hoy and c.turno = 'noche') then
    fecha := v_hoy; turno := 'noche'; cerrado := true;
  elsif exists (select 1 from public.cierres_caja c where c.hotel_id = p_hotel and c.fecha = v_hoy and c.turno = 'tarde') then
    fecha := v_hoy; turno := 'noche'; cerrado := false;
  else
    fecha := v_hoy; turno := 'tarde'; cerrado := false;
  end if;
  hora := privado.hora_cierre(p_hotel, turno);
end $$;

-- Desde dónde cuenta el próximo cierre: donde terminó el último; sin cierres, desde el inicio de hoy.
create function privado.desde_caja(p_hotel uuid) returns timestamptz language sql stable security definer set search_path = '' as $$
  select coalesce((select max(hasta) from public.cierres_caja where hotel_id = p_hotel),
    privado.hoy()::timestamp at time zone 'America/Guayaquil')
$$;

-- Lo que entró a caja en (desde, hasta]: pagos de reservas + ventas cobradas (no anuladas) por la hora del cobro.
-- Lo cargado al cuarto entra cuando se cobra (check_out pone medio y pagado_en), así no se cuenta dos veces.
create function privado.movimientos_caja(p_hotel uuid, p_desde timestamptz, p_hasta timestamptz)
returns table (hora timestamptz, concepto text, medio public.medio_pago, monto_centavos int)
language sql stable security definer set search_path = '' as $$
  select p.creado_en, format('Pago reserva %s · cuarto %s', r.codigo, h.numero), p.medio, p.monto_centavos
  from public.pagos p join public.reservas r on r.id = p.reserva_id join public.habitaciones h on h.id = r.habitacion_id
  where p.hotel_id = p_hotel and p.creado_en > p_desde and p.creado_en <= p_hasta
  union all
  select c.pagado_en, format('%s %s', replace(trim_scale(c.cantidad)::text, '.', ','), privado.plural(pr.nombre, c.cantidad))
    || coalesce(' · cuarto ' || h.numero, ''), c.medio, c.total_centavos
  from public.consumos c join public.productos pr on pr.id = c.producto_id
  left join public.reservas r on r.id = c.reserva_id left join public.habitaciones h on h.id = r.habitacion_id
  where c.hotel_id = p_hotel and c.anulado_en is null and c.medio is not null
    and c.pagado_en > p_desde and c.pagado_en <= p_hasta
$$;

-- Revisa cada 5 min (pg_cron): pasada la hora del turno y sin cierre de hoy, abre "Toca el cierre de la ...".
create function privado.avisar_cierres_caja(p_ahora timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'America/Guayaquil';
  v_hoy date := v_local::date;
  v_n int;
begin
  insert into public.alertas (hotel_id, tipo, mensaje, caja_fecha, caja_turno)
  select h.id, 'cierre_caja', 'Toca el cierre de la ' || t.turno, v_hoy, t.turno
  from public.hoteles h cross join (values ('tarde'), ('noche')) t (turno)
  where v_local::time >= privado.hora_cierre(h.id, t.turno)
    and not exists (select 1 from public.cierres_caja c where c.hotel_id = h.id and c.fecha = v_hoy
                    and (c.turno = t.turno or c.turno = 'noche'))  -- cerrar la noche incluye la tarde
  on conflict (hotel_id, caja_fecha, caja_turno) where resuelta_en is null and caja_turno is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── RPC ─────────────────────────────────────────────────────────────────────

create function public.resumen_caja(p_hotel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t record;
  v_desde timestamptz := privado.desde_caja(p_hotel);
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  select * into t from privado.turno_caja(p_hotel);
  return (
    with m as (select * from privado.movimientos_caja(p_hotel, v_desde, now()))
    select jsonb_build_object(
      'fecha', t.fecha, 'turno', t.turno, 'hora', to_char(t.hora, 'HH24:MI'), 'cerrado', t.cerrado,
      'horas', jsonb_build_object('tarde', to_char(privado.hora_cierre(p_hotel, 'tarde'), 'HH24:MI'),
                                  'noche', to_char(privado.hora_cierre(p_hotel, 'noche'), 'HH24:MI')),
      'desde', v_desde, 'hasta', now(),
      'efectivo_centavos', coalesce(sum(monto_centavos) filter (where medio = 'efectivo'), 0),
      'transferencia_centavos', coalesce(sum(monto_centavos) filter (where medio = 'transferencia'), 0),
      'total_centavos', coalesce(sum(monto_centavos), 0),
      'movimientos_cuenta', count(*),
      'movimientos', coalesce((select jsonb_agg(x order by x.hora desc) from
        (select * from m order by hora desc limit 50) x), '[]'))
    from m);
end $$;

create function public.cerrar_caja(p_hotel uuid, p_turno text, p_efectivo_contado_centavos int, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t record;
  v_fecha date;
  v_desde timestamptz;
  v_efectivo int;
  v_transf int;
  v_nota text := nullif(trim(p_nota), '');
  v_local timestamp := now() at time zone 'America/Guayaquil';
  v_lineas text[];
  v_dif int;
  v_ventas text;
  v_ventas_total int;
  v_ocupadas int;
  v_cuartos int;
  v_llegadas int;
  v_salidas int;
  v_quien text;
  c public.cierres_caja;
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  if p_turno is null or p_turno not in ('tarde', 'noche') then raise exception 'Elige el cierre: tarde o noche'; end if;
  if p_efectivo_contado_centavos is null or p_efectivo_contado_centavos < 0 then
    raise exception 'Escribe cuánto efectivo hay contado en la caja';
  end if;
  perform 1 from public.hoteles where id = p_hotel for update;  -- un cierre a la vez por hotel
  if not found then raise exception 'No encontramos ese hotel'; end if;

  select * into t from privado.turno_caja(p_hotel);
  v_fecha := case when p_turno = t.turno then t.fecha else privado.hoy() end;
  if exists (select 1 from public.cierres_caja where hotel_id = p_hotel and fecha = v_fecha and turno = p_turno) then
    raise exception 'El cierre de la % ya se hizo hoy', p_turno;
  end if;
  if p_turno = 'tarde' and exists (select 1 from public.cierres_caja where hotel_id = p_hotel and fecha = v_fecha and turno = 'noche') then
    raise exception 'El cierre de la noche ya se hizo: lo de la tarde quedó incluido ahí';
  end if;

  v_desde := privado.desde_caja(p_hotel);
  select coalesce(sum(monto_centavos) filter (where medio = 'efectivo'), 0),
         coalesce(sum(monto_centavos) filter (where medio = 'transferencia'), 0)
  into v_efectivo, v_transf
  from privado.movimientos_caja(p_hotel, v_desde, now());

  -- Mensaje para WhatsApp
  v_dif := p_efectivo_contado_centavos - v_efectivo;
  select string_agg(format('%s %s', replace(trim_scale(x.cant)::text, '.', ','), privado.plural(x.nombre, x.cant)), ', '
           order by x.cant desc, x.nombre),
         sum(x.total)
  into v_ventas, v_ventas_total
  from (select pr.nombre, sum(cs.cantidad) as cant, sum(cs.total_centavos)::int as total
        from public.consumos cs join public.productos pr on pr.id = cs.producto_id
        where cs.hotel_id = p_hotel and cs.anulado_en is null and cs.creado_en > v_desde and cs.creado_en <= now()
        group by pr.nombre) x;
  select count(*) filter (where estado = 'ocupado'), count(*) into v_ocupadas, v_cuartos
  from public.habitaciones where hotel_id = p_hotel and activa;
  select count(*) filter (where entrada = privado.hoy() and estado in ('prereserva', 'confirmada')),
         count(*) filter (where salida = privado.hoy() and estado = 'en_curso')
  into v_llegadas, v_salidas
  from public.reservas where hotel_id = p_hotel;
  select nombre into v_quien from public.usuarios_hotel where hotel_id = p_hotel and user_id = auth.uid();

  v_lineas := array[
    format('*Cierre de la %s · %s · %s %s %s, %s*', p_turno, (select nombre from public.hoteles where id = p_hotel),
      (array['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow from v_local)::int + 1],
      extract(day from v_local)::int,
      (array['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'])[extract(month from v_local)::int],
      to_char(v_local, 'HH24:MI')),
    format('Entró: %s (efectivo %s · transferencias %s)', privado.dolares(v_efectivo + v_transf),
      privado.dolares(v_efectivo), privado.dolares(v_transf)),
    format('Caja: contado %s, %s', privado.dolares(p_efectivo_contado_centavos), case
      when v_dif = 0 then 'cuadra'
      when v_dif < 0 then 'faltan ' || privado.dolares(-v_dif)
      else 'sobran ' || privado.dolares(v_dif) end)];
  if v_ventas is not null then
    v_lineas := v_lineas || format('Ventas: %s (%s)', v_ventas, privado.dolares(v_ventas_total));
  end if;
  v_lineas := v_lineas || (format('Habitaciones: %s %s de %s', v_ocupadas, case when v_ocupadas = 1 then 'ocupada' else 'ocupadas' end, v_cuartos) || case
    when v_llegadas + v_salidas = 0 then ''
    else ' · ' || concat_ws(' y ',
        case when v_llegadas > 0 then v_llegadas || case when v_llegadas = 1 then ' llegada' else ' llegadas' end end,
        case when v_salidas > 0 then v_salidas || case when v_salidas = 1 then ' salida' else ' salidas' end end)
      || case when v_llegadas + v_salidas = 1 then ' pendiente hoy' else ' pendientes hoy' end
    end);
  if v_quien is not null then v_lineas := v_lineas || ('Cerró: ' || v_quien); end if;
  if v_nota is not null then v_lineas := v_lineas || ('Nota: ' || regexp_replace(v_nota, '\s+', ' ', 'g')); end if;

  insert into public.cierres_caja (hotel_id, turno, fecha, desde, hasta, efectivo_esperado_centavos, transferencia_centavos,
    efectivo_contado_centavos, nota, mensaje)
  values (p_hotel, p_turno, v_fecha, v_desde, now(), v_efectivo, v_transf, p_efectivo_contado_centavos, v_nota,
    array_to_string(v_lineas, e'\n'))
  returning * into c;

  -- Este cierre cubre todo lo anterior: resuelve sus avisos y los que hayan quedado atrás.
  update public.alertas set resuelta_en = now()
  where hotel_id = p_hotel and caja_turno is not null and resuelta_en is null
    and (caja_fecha < v_fecha or (caja_fecha = v_fecha and (caja_turno = p_turno or p_turno = 'noche')));

  return to_jsonb(c);
end $$;

revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
revoke execute on function public.resumen_caja(uuid), public.cerrar_caja(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.resumen_caja(uuid), public.cerrar_caja(uuid, text, int, text) to authenticated, service_role;

-- Agenda (tolerante, como 20261111000600_cron.sql).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('avisar-cierres-caja', '*/5 * * * *', 'select privado.avisar_cierres_caja()');
exception when others then
  raise notice 'pg_cron no disponible (%): agenda avisar-cierres-caja a mano en producción', sqlerrm;
end $$;
