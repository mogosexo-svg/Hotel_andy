-- Sin emojis en las alertas. Única función que antepone símbolo: la de stock bajo (las de cuarto no lo hacen).
create or replace function privado.aplicar_movimiento() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.productos;
  v_alcance text;
begin
  select * into p from public.productos where id = new.producto_id for update;
  if p.stock is null and new.tipo not in ('compra', 'conteo') then
    new.stock_resultante := null;
    return new;
  end if;

  new.stock_resultante := coalesce(p.stock, 0) + new.cantidad;
  perform set_config('privado.mov_stock', 'si', true);
  update public.productos set stock = new.stock_resultante where id = p.id;
  perform set_config('privado.mov_stock', '', true);

  if new.stock_resultante < 0 or new.stock_resultante <= p.minimo then
    select coalesce(
      ' (alcanza para unos ' || floor(greatest(new.stock_resultante, 0) / max(k.cantidad))::int || ' cuartos)',
      ' (alcanza para unos ' || floor(greatest(new.stock_resultante, 0) / p.consumo_diario)::int || ' días)', '')
    into v_alcance
    from public.kit_por_tipo k where k.producto_id = p.id and k.por = 'limpieza';

    update public.alertas
    set mensaje = format('Se está acabando %s: quedan %s %s%s', p.nombre, replace(trim_scale(new.stock_resultante)::text, '.', ','),
      privado.plural(p.unidad, new.stock_resultante), v_alcance)
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
    if not found then
      insert into public.alertas (hotel_id, tipo, producto_id, mensaje)
      values (p.hotel_id, 'stock_bajo', p.id, format('Se está acabando %s: quedan %s %s%s', p.nombre,
        replace(trim_scale(new.stock_resultante)::text, '.', ','), privado.plural(p.unidad, new.stock_resultante), v_alcance));
    end if;
  else
    update public.alertas set resuelta_en = now()
    where producto_id = p.id and tipo = 'stock_bajo' and resuelta_en is null;
  end if;
  return new;
end $$;

-- Alertas ya creadas (abiertas y cerradas): quita el prefijo y los espacios que deja.
update public.alertas set mensaje = regexp_replace(mensaje, '^[^[:alnum:]¡¿]+', '') where mensaje ~ '^[^[:alnum:]¡¿]';

