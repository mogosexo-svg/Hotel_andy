-- Sin emojis: los íconos de categoría son claves que la web y el panel dibujan. Solo se tocan los 6 emojis de origen.
update public.categorias set icono = case icono
  when '🧻' then 'bano' when '🛏️' then 'lenceria' when '🧽' then 'limpieza'
  when '🏊' then 'piscina' when '🥤' then 'bebidas' when '🍫' then 'snacks' end
where icono in ('🧻', '🛏️', '🧽', '🏊', '🥤', '🍫');
