-- Hotel Andy · comprobantes de anticipo. El huésped manda la foto por WhatsApp (n8n → recibir_comprobante con
-- service_role); la dueña o recepción la acepta (registra el pago y confirma) o la rechaza (con motivo) en el panel.
-- n8n se entera del rechazo leyendo la fila (estado = 'rechazado' + motivo_rechazo) por Realtime o webhook de BD.

-- Se usa solo dentro de cuerpos plpgsql: así la migración corre en una transacción sin "unsafe use of new value".
alter type tipo_alerta add value if not exists 'comprobante';

alter table pagos add unique (hotel_id, id);

create table comprobantes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hoteles on delete cascade,
  reserva_id uuid,                             -- null = llegó sin poder asociarse
  telefono text not null check (telefono ~ '^\+[0-9]{8,15}$'),
  foto_path text not null,
  monto_declarado_centavos int check (monto_declarado_centavos > 0),
  origen text not null default 'whatsapp' check (origen in ('whatsapp', 'recepcion', 'web')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  motivo_rechazo text,
  pago_id uuid,
  revisado_por uuid,                           -- null si lo revisó el backend (service_role)
  revisado_en timestamptz,
  vence_antes timestamptz,                     -- vencimiento de la pre-reserva antes de retenerla (para devolverlo al rechazar)
  wa_message_id text unique,                   -- idempotencia del webhook
  creado_en timestamptz not null default now(),
  unique (hotel_id, id),
  foreign key (hotel_id, reserva_id) references reservas (hotel_id, id) on delete set null (reserva_id),
  foreign key (hotel_id, pago_id) references pagos (hotel_id, id),
  check (starts_with(foto_path, hotel_id::text || '/comprobantes/') and foto_path !~ '\.\.'),
  check (case estado
    when 'pendiente' then pago_id is null and revisado_en is null and motivo_rechazo is null
    when 'aceptado' then pago_id is not null and reserva_id is not null and revisado_en is not null and motivo_rechazo is null
    when 'rechazado' then pago_id is null and revisado_en is not null and length(trim(motivo_rechazo)) > 0
  end)
);
create index on comprobantes (hotel_id, creado_en) where estado = 'pendiente';
create index on comprobantes (reserva_id);

alter table alertas add column comprobante_id uuid;
alter table alertas add foreign key (hotel_id, comprobante_id) references comprobantes (hotel_id, id) on delete cascade;
create index on alertas (comprobante_id) where comprobante_id is not null;

-- Leen dueña y recepción; nadie escribe directo (solo RPC).
do $$ begin perform privado.rls('comprobantes', 'gestion', null); end $$;
revoke all on comprobantes from anon;
create trigger auditar after insert or update on comprobantes for each row execute function privado.auditar();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.comprobantes;
  end if;
end $$;

-- ── Pagos: una sola regla para registrar_pago y aceptar_comprobante ─────────

create function privado.registrar_pago(r public.reservas, p_monto_centavos int, p_medio public.medio_pago, p_comprobante_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if r.estado = 'cancelada' then raise exception 'Esta reserva ya está cancelada o venció'; end if;
  insert into public.pagos (hotel_id, reserva_id, monto_centavos, medio, comprobante_path)
  values (r.hotel_id, r.id, p_monto_centavos, p_medio, p_comprobante_path) returning id into v_id;
  if r.estado = 'prereserva' then
    update public.reservas set estado = 'confirmada' where id = r.id;
  end if;
  return v_id;
end $$;

create or replace function public.registrar_pago(p_reserva uuid, p_monto_centavos int, p_medio medio_pago, p_comprobante_path text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return privado.registrar_pago(privado.reserva_para(p_reserva, '{duena,recepcion}'), p_monto_centavos, p_medio, p_comprobante_path);
end $$;

-- ── Retener y soltar la pre-reserva mientras se revisa ──────────────────────

-- Asocia el comprobante a la reserva; si es pre-reserva, la retiene hasta 24 h (nunca acorta) y rehace la alerta.
create function privado.asociar_comprobante(p_comprobante uuid, r public.reservas) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.comprobantes set reserva_id = r.id,
    vence_antes = case when r.estado = 'prereserva' then coalesce(
      (select min(o.vence_antes) from public.comprobantes o
       where o.reserva_id = r.id and o.estado = 'pendiente' and o.id <> p_comprobante), r.vence_en) end
  where id = p_comprobante;
  if r.estado = 'prereserva' then
    update public.reservas set vence_en = greatest(vence_en, now() + interval '24 hours') where id = r.id;
  end if;
  update public.alertas a set reserva_id = r.id,
    mensaje = format('Comprobante de %s para la reserva %s', coalesce(g.nombre, c.telefono), r.codigo)
  from public.comprobantes c left join public.huespedes g on g.id = r.huesped_id
  where c.id = p_comprobante and a.comprobante_id = c.id;
end $$;

-- Devuelve el vencimiento normal (ahora + prereserva_horas, sin pasar del que tenía si aún no llegó),
-- salvo que la reserva tenga otro comprobante pendiente.
create function privado.soltar_prereserva(c public.comprobantes) returns void
language plpgsql security definer set search_path = '' as $$
declare v_normal timestamptz := now() + make_interval(hours => coalesce(
  (select (reglas ->> 'prereserva_horas')::int from public.hoteles where id = c.hotel_id), 2));
begin
  if c.reserva_id is null or exists (select 1 from public.comprobantes o
      where o.reserva_id = c.reserva_id and o.estado = 'pendiente' and o.id <> c.id) then
    return;
  end if;
  update public.reservas
  set vence_en = case when c.vence_antes > now() then least(c.vence_antes, v_normal) else v_normal end
  where id = c.reserva_id and estado = 'prereserva';
end $$;

-- Busca el comprobante, lo bloquea y valida el rol.
create function privado.comprobante_para(p_comprobante uuid) returns comprobantes
language plpgsql security definer set search_path = '' as $$
declare c public.comprobantes;
begin
  select * into c from public.comprobantes where id = p_comprobante for update;
  if not found then raise exception 'No encontramos ese comprobante'; end if;
  perform privado.exigir_rol(c.hotel_id, '{duena,recepcion}');
  if c.estado <> 'pendiente' then raise exception 'Este comprobante ya fue revisado'; end if;
  return c;
end $$;

-- ── RPC ─────────────────────────────────────────────────────────────────────

-- Entrada de n8n (solo service_role). Idempotente por wa_message_id.
create function public.recibir_comprobante(p_hotel uuid, p_telefono text, p_foto_path text,
  p_wa_message_id text default null, p_codigo text default null, p_monto_centavos int default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tel text := privado.normalizar_telefono(p_telefono);
  r public.reservas;
  c public.comprobantes;
begin
  if p_wa_message_id is not null then
    select * into c from public.comprobantes where wa_message_id = p_wa_message_id and hotel_id = p_hotel;
  end if;
  if c.id is null then
    if v_tel is null then raise exception 'El teléfono del comprobante no es válido'; end if;
    if p_foto_path is null or not starts_with(p_foto_path, p_hotel::text || '/comprobantes/') or p_foto_path ~ '\.\.' then
      raise exception 'La foto del comprobante no está en la carpeta de este hotel';
    end if;

    if nullif(trim(p_codigo), '') is not null then
      select * into r from public.reservas where hotel_id = p_hotel and codigo = upper(trim(p_codigo));
    else
      select x.* into r from public.reservas x join public.huespedes g on g.id = x.huesped_id
      where x.hotel_id = p_hotel and x.estado = 'prereserva' and g.telefono = v_tel
      order by x.creado_en desc limit 1;
    end if;

    insert into public.comprobantes (hotel_id, telefono, foto_path, monto_declarado_centavos, wa_message_id)
    values (p_hotel, v_tel, p_foto_path, p_monto_centavos, p_wa_message_id)
    on conflict (wa_message_id) do nothing
    returning * into c;
    if c.id is null then  -- otro webhook con el mismo id ganó la carrera
      select * into c from public.comprobantes where wa_message_id = p_wa_message_id and hotel_id = p_hotel;
      if c.id is null then raise exception 'Ese mensaje ya se registró en otro hotel'; end if;
    else
      insert into public.alertas (hotel_id, tipo, comprobante_id, mensaje)
      values (p_hotel, 'comprobante', c.id, format('Comprobante sin reserva asociada (%s)', v_tel));
      if r.id is not null then
        perform privado.asociar_comprobante(c.id, r);
        c.reserva_id := r.id;
      end if;
    end if;
  end if;

  return jsonb_build_object('comprobante_id', c.id, 'reserva_id', c.reserva_id,
    'codigo', (select codigo from public.reservas where id = c.reserva_id), 'asociado', c.reserva_id is not null);
end $$;

create function public.aceptar_comprobante(p_comprobante uuid, p_monto_centavos int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.comprobantes := privado.comprobante_para(p_comprobante);
  r public.reservas;
  v_pago uuid;
begin
  if c.reserva_id is null then raise exception 'Asocia el comprobante a una reserva antes de aceptarlo'; end if;
  if p_monto_centavos is null or p_monto_centavos <= 0 then raise exception 'Escribe el monto que llegó a la cuenta'; end if;
  select * into r from public.reservas where id = c.reserva_id for update;
  if r.estado = 'cancelada' and r.motivo_cancelacion like 'Pre-reserva vencida%' then
    raise exception 'La pre-reserva % venció y el cuarto se liberó: no se puede aceptar el comprobante. Si el huésped pagó, crea una reserva nueva y registra el pago ahí.', r.codigo;
  elsif r.estado = 'cancelada' then
    raise exception 'La reserva % está cancelada: no se puede aceptar el comprobante. Si el huésped pagó, crea una reserva nueva y registra el pago ahí.', r.codigo;
  end if;
  v_pago := privado.registrar_pago(r, p_monto_centavos, 'transferencia', c.foto_path);
  update public.comprobantes set estado = 'aceptado', pago_id = v_pago, revisado_por = auth.uid(), revisado_en = now()
  where id = c.id;
  update public.alertas set resuelta_en = now() where comprobante_id = c.id and resuelta_en is null;
  return v_pago;
end $$;

create function public.rechazar_comprobante(p_comprobante uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.comprobantes := privado.comprobante_para(p_comprobante);
begin
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo del rechazo para avisarle al huésped'; end if;
  update public.comprobantes set estado = 'rechazado', motivo_rechazo = trim(p_motivo), revisado_por = auth.uid(), revisado_en = now()
  where id = c.id;
  perform privado.soltar_prereserva(c);
  update public.alertas set resuelta_en = now() where comprobante_id = c.id and resuelta_en is null;
end $$;

-- Recepción asigna (o corrige) la reserva de un comprobante pendiente.
create function public.asociar_comprobante(p_comprobante uuid, p_reserva uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.comprobantes := privado.comprobante_para(p_comprobante);
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva and hotel_id = c.hotel_id;
  if not found then raise exception 'No encontramos esa reserva'; end if;
  if c.reserva_id is not distinct from r.id then return; end if;
  perform privado.soltar_prereserva(c);
  perform privado.asociar_comprobante(c.id, r);
end $$;

-- Lista del panel: pendientes, los más viejos primero, con lo necesario para decidir.
create function public.comprobantes_pendientes(p_hotel uuid)
returns table (comprobante_id uuid, creado_en timestamptz, origen text, telefono text, foto_path text,
  monto_declarado_centavos int, huesped text, reserva_id uuid, codigo text, reserva_estado estado_reserva,
  habitacion text, tipo text, entrada date, salida date, total_centavos int, anticipo_centavos int,
  pagado_centavos int, vence_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_pct numeric := coalesce((select (reglas -> 'anticipo' ->> 'porcentaje')::numeric from public.hoteles where id = p_hotel), 50);
begin
  perform privado.exigir_rol(p_hotel, '{duena,recepcion}');
  return query
    select c.id, c.creado_en, c.origen, c.telefono, c.foto_path, c.monto_declarado_centavos, g.nombre, r.id, r.codigo,
      r.estado, h.numero, t.nombre, r.entrada, r.salida, r.total_centavos, round(r.total_centavos * v_pct / 100)::int,
      (select coalesce(sum(p.monto_centavos), 0)::int from public.pagos p where p.reserva_id = r.id), r.vence_en
    from public.comprobantes c
    left join public.reservas r on r.id = c.reserva_id
    left join public.huespedes g on g.id = r.huesped_id
    left join public.habitaciones h on h.id = r.habitacion_id
    left join public.tipos_habitacion t on t.id = h.tipo_id
    where c.hotel_id = p_hotel and c.estado = 'pendiente'
    order by c.creado_en;
end $$;

revoke execute on all functions in schema privado from public;
grant execute on function privado.rol_en(uuid), privado.nuevo_codigo() to authenticated, service_role;
revoke execute on function public.recibir_comprobante(uuid, text, text, text, text, int),
  public.aceptar_comprobante(uuid, int), public.rechazar_comprobante(uuid, text), public.asociar_comprobante(uuid, uuid),
  public.comprobantes_pendientes(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_comprobante(uuid, int), public.rechazar_comprobante(uuid, text),
  public.asociar_comprobante(uuid, uuid), public.comprobantes_pendientes(uuid) to authenticated;
grant execute on function public.recibir_comprobante(uuid, text, text, text, text, int),
  public.aceptar_comprobante(uuid, int), public.rechazar_comprobante(uuid, text), public.asociar_comprobante(uuid, uuid),
  public.comprobantes_pendientes(uuid) to service_role;
