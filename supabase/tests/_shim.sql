-- Shim mínimo de Supabase para correr los tests en un Postgres pelado (plan B, sin Docker).
-- NUNCA va en supabase/migrations. En un Supabase real todo esto ya existe y cada bloque es un no-op.
-- También define el esquema `tests` con helpers para hacerse pasar por un usuario (solo local).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

do $$
begin
  if to_regclass('auth.users') is not null then return; end if;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    instance_id uuid,
    aud text, role text,
    email text unique,
    encrypted_password text,
    email_confirmed_at timestamptz,
    confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create table auth.identities (
    id uuid primary key default gen_random_uuid(),
    provider_id text not null, user_id uuid not null references auth.users on delete cascade,
    identity_data jsonb not null, provider text not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
  );
  create function auth.jwt() returns jsonb language sql stable as
    $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
  create function auth.uid() returns uuid language sql stable as $f$ select (auth.jwt() ->> 'sub')::uuid $f$;
  create function auth.role() returns text language sql stable as $f$ select auth.jwt() ->> 'role' $f$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Supabase da a anon/authenticated/service_role todo sobre public por defecto; lo replicamos para que RLS sea lo que se prueba.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Helpers de test: tests.como('correo') entra como ese usuario; tests.anon() como visitante; tests.salir() vuelve a postgres.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.crear_usuario(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email) values (gen_random_uuid(), p_email) returning id
$$;

create or replace function tests.como(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.salir() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Si se corre como archivo de pgTAP (supabase test db), reporta un test que pasa.
select plan(1);
select pass('shim de Supabase listo');
select * from finish();
