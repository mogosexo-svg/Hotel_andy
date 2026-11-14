-- Sin emojis: ningún mensaje de alerta empieza con símbolo ni lleva emojis.
begin;
select plan(3);

select id as h from hoteles where slug = 'hotel-andy' \gset
select id as papel from productos where hotel_id = :'h' and clave = 'papel' \gset

select ajustar_stock(:'papel', 'conteo', 15);
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad) values (:'h', :'papel', 'limpieza', -6);
select is((select count(*)::int from alertas where producto_id = :'papel'), 1, 'cruzar el mínimo genera la alerta');
select matches((select mensaje from alertas where producto_id = :'papel'), '^Se está acabando ', 'la alerta de stock empieza por el texto, sin símbolo');
select is((select count(*)::int from alertas where mensaje ~ '[^[:alnum:][:space:][:punct:]¡¿áéíóúüñÁÉÍÓÚÜÑ]'), 0,
  'ningún mensaje tiene caracteres fuera de letras, números y puntuación');

select * from finish();
rollback;
