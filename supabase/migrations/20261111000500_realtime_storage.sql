-- Hotel Andy · Realtime y Storage. Tolerante: en una base sin Supabase completo (tests locales) no hace nada.

-- RF-21 / RNF-03: cambios en vivo en el panel (Realtime respeta RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.habitaciones, public.reservas, public.productos, public.alertas;
  end if;
end $$;

-- Fotos privadas (comprobantes, daños, facturas, productos) en el bucket "hotel", carpeta = hotel_id.
-- Ruta: <hotel_id>/<comprobantes|danos|facturas|productos>/<archivo>. Sube cualquier rol; ve solo dueña y recepción.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('hotel', 'hotel', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
  on conflict (id) do nothing;
  create policy hotel_lee on storage.objects for select to authenticated using (
    bucket_id = 'hotel' and privado.rol_en(((storage.foldername(name))[1])::uuid) in ('duena', 'recepcion'));
  create policy hotel_sube on storage.objects for insert to authenticated with check (
    bucket_id = 'hotel' and privado.rol_en(((storage.foldername(name))[1])::uuid) is not null);
end $$;
