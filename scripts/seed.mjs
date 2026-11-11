#!/usr/bin/env node
// Genera supabase/seed.sql desde data/hotel.json (seed único: nada a mano).
// Si existe data/hotel.private.json, genera además supabase/seed.private.sql (gitignored) con la cuenta bancaria.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const leer = (p) => JSON.parse(readFileSync(new URL(p, raiz), 'utf8'));
const datos = leer('data/hotel.json');

// Id fijo de Hotel Andy: el panel y los tests lo pueden usar sin buscarlo.
const H = '00000000-0000-4000-8000-0000000a0d1e';

const q = (v) =>
  v === null || v === undefined ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : typeof v === 'object' ? `${q(JSON.stringify(v))}::jsonb`
  : `'${String(v).replaceAll("'", "''")}'`;
const centavos = (usd) => (usd === null || usd === undefined ? null : Math.round(usd * 100));
const filas = (arr) => arr.map((f) => `  (${f.map(q).join(', ')})`).join(',\n');
// Quita las notas internas (_verificar, _alerta...) y los objetos que quedan vacíos.
const limpiar = (o) =>
  Object.fromEntries(
    Object.entries(o)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? limpiar(v) : v])
      .filter(([, v]) => !(v && typeof v === 'object' && Object.keys(v).length === 0)),
  );

const { hotel, tipos_habitacion: tipos, habitaciones, insumos, categorias, reglas } = datos;
const venta = datos.productos_venta.productos;
const productos = [...insumos, ...venta];

const sql = `-- GENERADO por scripts/seed.mjs desde data/hotel.json. No editar a mano: corre \`node scripts/seed.mjs\`.
-- Temporada alta sin fechas (todo cuenta como baja hasta que la dueña cargue el calendario).
-- Sin tarifas de Booking ni Airbnb: los montos están pendientes con el cliente.
begin;

insert into hoteles (id, slug, nombre, ciudad, provincia, pais, estrellas, zona_horaria, moneda, idioma, dominio, telefono,
  check_in, check_out, booking_calificacion, booking_resenas, reglas)
values (${[H, 'hotel-andy', hotel.nombre, hotel.ciudad, hotel.provincia, hotel.pais, hotel.estrellas, hotel.zona_horaria,
  hotel.moneda, hotel.idioma, hotel.dominio, hotel.telefono, hotel.check_in, hotel.check_out, hotel.booking.calificacion,
  hotel.booking.resenas, limpiar(reglas)].map(q).join(', ')});

insert into config (hotel_id) values (${q(H)});

insert into categorias (hotel_id, clave, nombre, icono, orden) values
${filas(categorias.map((c, i) => [H, c.id, c.nombre, c.icono, i + 1]))};

insert into tipos_habitacion (hotel_id, clave, nombre, max_personas, orden) values
${filas(Object.entries(tipos).map(([clave, t], i) => [H, clave, t.nombre, t.max_personas, i + 1]))};

insert into habitaciones (hotel_id, tipo_id, numero, piso)
select ${q(H)}, t.id, v.numero, v.piso
from (values
${filas(habitaciones.map((h) => [h.numero, h.piso, h.tipo]))}
) v (numero, piso, tipo)
join tipos_habitacion t on t.hotel_id = ${q(H)} and t.clave = v.tipo;

insert into temporadas (hotel_id, clave, nombre, es_base) values
  (${q(H)}, 'baja', 'Temporada baja', true),
  (${q(H)}, 'alta', 'Temporada alta y feriados', false);

insert into tarifas (hotel_id, tipo_id, canal, temporada_id, precio_centavos)
select ${q(H)}, t.id, 'directo', s.id, v.precio
from (values
${filas(Object.entries(tipos).flatMap(([clave, t]) => [
  [clave, 'baja', centavos(t.precio_baja)],
  [clave, 'alta', centavos(t.precio_alta)],
]))}
) v (tipo, temporada, precio)
join tipos_habitacion t on t.hotel_id = ${q(H)} and t.clave = v.tipo
join temporadas s on s.hotel_id = ${q(H)} and s.clave = v.temporada;

insert into productos (hotel_id, categoria_id, clave, nombre, unidad, minimo, se_vende, consumo_diario,
  precio_compra_centavos, precio_venta_centavos)
select ${q(H)}, c.id, v.clave, v.nombre, v.unidad, v.minimo::numeric, v.se_vende, v.consumo_diario::numeric, v.compra::int, v.venta::int
from (values
${filas(productos.map((p) => [
  p.id, p.nombre, p.unidad ?? 'unidad', p.minimo ?? null, p.se_vende, p.consumo?.por === 'dia' ? p.consumo.cantidad : null,
  centavos(p.precio_compra), centavos(p.precio_venta), p.categoria,
]))}
) v (clave, nombre, unidad, minimo, se_vende, consumo_diario, compra, venta, categoria)
join categorias c on c.hotel_id = ${q(H)} and c.clave = v.categoria;

-- Kit por tipo de cuarto: lo que se descuenta al marcar "Listo" (configurable por tipo).
insert into kit_por_tipo (hotel_id, tipo_id, producto_id, cantidad, por)
select ${q(H)}, t.id, p.id, v.cantidad, v.por::kit_por
from (values
${filas(insumos.filter((i) => ['limpieza', 'persona'].includes(i.consumo?.por)).map((i) => [i.id, i.consumo.cantidad, i.consumo.por]))}
) v (producto, cantidad, por)
join productos p on p.hotel_id = ${q(H)} and p.clave = v.producto
cross join tipos_habitacion t where t.hotel_id = ${q(H)};

-- Stock inicial como conteo: el historial empieza el día 1. Stock null = sin contar (no se inserta).
insert into movimientos_insumo (hotel_id, producto_id, tipo, cantidad, nota)
select ${q(H)}, p.id, 'conteo', v.stock, 'Stock inicial (data/hotel.json)'
from (values
${filas(productos.filter((p) => p.stock !== null && p.stock !== undefined).map((p) => [p.id, p.stock]))}
) v (producto, stock)
join productos p on p.hotel_id = ${q(H)} and p.clave = v.producto;

commit;
`;

writeFileSync(new URL('supabase/seed.sql', raiz), sql);

const privado = new URL('data/hotel.private.json', raiz);
if (existsSync(privado)) {
  const p = JSON.parse(readFileSync(privado, 'utf8'));
  writeFileSync(
    new URL('supabase/seed.private.sql', raiz),
    `-- GENERADO desde data/hotel.private.json. Gitignored: nunca al repo.\n` +
      `update config set cuenta_transferencia = ${q(p.cuenta_transferencia ?? p)} where hotel_id = ${q(H)};\n`,
  );
}
process.stdout.write('seed.sql generado\n');
