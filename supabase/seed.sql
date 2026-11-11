-- GENERADO por scripts/seed.mjs desde data/hotel.json. No editar a mano: corre `node scripts/seed.mjs`.
-- Temporada alta sin fechas (todo cuenta como baja hasta que la dueña cargue el calendario).
-- Sin tarifas de Booking ni Airbnb: los montos están pendientes con el cliente.
begin;

insert into hoteles (id, slug, nombre, ciudad, provincia, pais, estrellas, zona_horaria, moneda, idioma, dominio, telefono,
  check_in, check_out, booking_calificacion, booking_resenas, reglas)
values ('00000000-0000-4000-8000-0000000a0d1e', 'hotel-andy', 'Hotel Andy', 'Atacames', 'Esmeraldas', 'EC', 3, 'America/Guayaquil', 'USD', 'es-EC', 'hotelandyatacames.org', '+593 6276 0674', '13:30', '11:30', 8.7, 238, '{"anticipo":{"porcentaje":50,"medio":"transferencia"},"prereserva_horas":2,"cancelacion":{"politica":"flexible_caso_a_caso","bot":"No promete reembolso ni plazos: pasa el caso a la dueña."},"ninos":{"politica":"precio_fijo_por_habitacion","nota":"No se cobra por persona; manda la capacidad máxima del cuarto."},"mascotas":{"aceptadas":true,"cargo_adicional":null},"desayuno":false,"parqueadero":true,"ascensor":false,"piscina":{"abre":"08:00","cierra":"01:00"}}'::jsonb);

insert into config (hotel_id) values ('00000000-0000-4000-8000-0000000a0d1e');

insert into categorias (hotel_id, clave, nombre, icono, orden) values
  ('00000000-0000-4000-8000-0000000a0d1e', 'bano', 'Baño y amenidades', 'bano', 1),
  ('00000000-0000-4000-8000-0000000a0d1e', 'lenceria', 'Lencería', 'lenceria', 2),
  ('00000000-0000-4000-8000-0000000a0d1e', 'limpieza', 'Limpieza', 'limpieza', 3),
  ('00000000-0000-4000-8000-0000000a0d1e', 'piscina', 'Piscina', 'piscina', 4),
  ('00000000-0000-4000-8000-0000000a0d1e', 'bebidas', 'Bebidas', 'bebidas', 5),
  ('00000000-0000-4000-8000-0000000a0d1e', 'snacks', 'Snacks', 'snacks', 6);

insert into tipos_habitacion (hotel_id, clave, nombre, max_personas, orden) values
  ('00000000-0000-4000-8000-0000000a0d1e', 'doble_sencilla', 'Doble sencilla', 2, 1),
  ('00000000-0000-4000-8000-0000000a0d1e', 'doble_deluxe', 'Doble deluxe', 2, 2),
  ('00000000-0000-4000-8000-0000000a0d1e', 'triple', 'Triple', 3, 3),
  ('00000000-0000-4000-8000-0000000a0d1e', 'triple_deluxe', 'Triple deluxe', 3, 4),
  ('00000000-0000-4000-8000-0000000a0d1e', 'cuadruple', 'Cuádruple', 4, 5),
  ('00000000-0000-4000-8000-0000000a0d1e', 'familiar', 'Familiar', 5, 6),
  ('00000000-0000-4000-8000-0000000a0d1e', 'suite', 'Suite', 7, 7);

insert into habitaciones (hotel_id, tipo_id, numero, piso)
select '00000000-0000-4000-8000-0000000a0d1e', t.id, v.numero, v.piso
from (values
  ('101', 1, 'cuadruple'),
  ('102', 1, 'doble_deluxe'),
  ('103', 1, 'doble_sencilla'),
  ('104', 1, 'doble_sencilla'),
  ('105', 1, 'triple'),
  ('106', 1, 'doble_sencilla'),
  ('201', 2, 'doble_deluxe'),
  ('202', 2, 'doble_deluxe'),
  ('203', 2, 'doble_sencilla'),
  ('204', 2, 'doble_sencilla'),
  ('205', 2, 'triple'),
  ('206', 2, 'triple'),
  ('301', 3, 'doble_deluxe'),
  ('302', 3, 'doble_deluxe'),
  ('303', 3, 'doble_sencilla'),
  ('304', 3, 'familiar'),
  ('305', 3, 'triple'),
  ('401', 4, 'triple_deluxe'),
  ('402', 4, 'doble_deluxe'),
  ('403', 4, 'doble_sencilla'),
  ('404', 4, 'familiar'),
  ('405', 4, 'triple'),
  ('500', 5, 'suite')
) v (numero, piso, tipo)
join tipos_habitacion t on t.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and t.clave = v.tipo;

insert into temporadas (hotel_id, clave, nombre, es_base) values
  ('00000000-0000-4000-8000-0000000a0d1e', 'baja', 'Temporada baja', true),
  ('00000000-0000-4000-8000-0000000a0d1e', 'alta', 'Temporada alta y feriados', false);

insert into tarifas (hotel_id, tipo_id, canal, temporada_id, precio_centavos)
select '00000000-0000-4000-8000-0000000a0d1e', t.id, 'directo', s.id, v.precio
from (values
  ('doble_sencilla', 'baja', 3500),
  ('doble_sencilla', 'alta', 4500),
  ('doble_deluxe', 'baja', 5000),
  ('doble_deluxe', 'alta', 5500),
  ('triple', 'baja', 5000),
  ('triple', 'alta', 6500),
  ('triple_deluxe', 'baja', 6000),
  ('triple_deluxe', 'alta', 7000),
  ('cuadruple', 'baja', 7000),
  ('cuadruple', 'alta', 9000),
  ('familiar', 'baja', 8500),
  ('familiar', 'alta', 11000),
  ('suite', 'baja', 13000),
  ('suite', 'alta', 16000)
) v (tipo, temporada, precio)
join tipos_habitacion t on t.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and t.clave = v.tipo
join temporadas s on s.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and s.clave = v.temporada;

insert into productos (hotel_id, categoria_id, clave, nombre, unidad, minimo, se_vende, consumo_diario,
  precio_compra_centavos, precio_venta_centavos)
select '00000000-0000-4000-8000-0000000a0d1e', c.id, v.clave, v.nombre, v.unidad, v.minimo::numeric, v.se_vende, v.consumo_diario::numeric, v.compra::int, v.venta::int
from (values
  ('papel', 'Papel higiénico', 'rollo', 12, false, null, null, null, 'bano'),
  ('jabon', 'Jabón', 'unidad', 10, false, null, null, null, 'bano'),
  ('shampoo', 'Shampoo (recarga de dispensador)', 'recarga', 10, false, null, null, null, 'bano'),
  ('toallas', 'Toallas', 'juego', 8, false, null, null, null, 'lenceria'),
  ('sabanas', 'Sábanas', 'juego', 6, false, null, null, null, 'lenceria'),
  ('cloro', 'Cloro de piscina', 'kg', 4, false, 0.5, null, null, 'piscina'),
  ('cerveza', 'Cerveza', 'unidad', null, true, null, null, null, 'bebidas'),
  ('agua', 'Agua', 'unidad', null, true, null, null, null, 'bebidas'),
  ('powerade', 'Powerade', 'unidad', null, true, null, null, null, 'bebidas')
) v (clave, nombre, unidad, minimo, se_vende, consumo_diario, compra, venta, categoria)
join categorias c on c.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and c.clave = v.categoria;

-- Kit por tipo de cuarto: lo que se descuenta al marcar "Listo" (configurable por tipo).
insert into kit_por_tipo (hotel_id, tipo_id, producto_id, cantidad, por)
select '00000000-0000-4000-8000-0000000a0d1e', t.id, p.id, v.cantidad, v.por::kit_por
from (values
  ('papel', 2, 'limpieza'),
  ('jabon', 2, 'limpieza'),
  ('toallas', 1, 'persona'),
  ('sabanas', 1, 'limpieza')
) v (producto, cantidad, por)
join productos p on p.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and p.clave = v.producto
cross join tipos_habitacion t where t.hotel_id = '00000000-0000-4000-8000-0000000a0d1e';

-- Stock inicial como conteo: el historial empieza el día 1. Stock null = sin contar (no se inserta).
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota)
select '00000000-0000-4000-8000-0000000a0d1e', p.id, 'conteo', v.stock, 'Stock inicial (data/hotel.json)'
from (values
  ('papel', 350),
  ('jabon', 120),
  ('cloro', 4)
) v (producto, stock)
join productos p on p.hotel_id = '00000000-0000-4000-8000-0000000a0d1e' and p.clave = v.producto;

commit;
