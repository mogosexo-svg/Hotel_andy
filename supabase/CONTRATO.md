# Contrato de datos · Hotel Andy

Lo que web, panel y automatizaciones pueden usar de la base. Fuente: `supabase/migrations/*.sql`.
Tipos: `src/lib/database.types.ts` (regenerar con `scripts/gen-types.sh` tras cada migración).

- **Hotel Andy**: `id = 00000000-0000-4000-8000-0000000a0d1e`, `slug = 'hotel-andy'`.
- Dinero en **centavos** (`int`). Stock en `numeric` (el cloro va en 0,5 kg). Fechas `date`; "hoy" = `America/Guayaquil`.
- Errores de negocio: `P0001` con el mensaje listo para mostrar (español, sin jerga). `23P01` = reserva cruzada. `42501` = sin permiso / RLS.

## Levantar la base local

| Opción | Comando | Notas |
|---|---|---|
| Supabase completo (Docker) | `npx supabase@3 start` y luego `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.demo.sql` | API `http://127.0.0.1:54321`. Claves: `npx supabase@3 status` (la anon/publishable sale ahí). `db reset` aplica migraciones + `seed.sql` (+ `seed.private.sql` si existe). |
| Plan B sin Docker (Postgres 16 + pgTAP) | `scripts/test-db.sh` (tests) · `scripts/test-db.sh --demo` (tests + datos demo) | Base `postgresql://postgres:postgres@127.0.0.1:5432/hotel_andy_test`. Requiere `apt install postgresql-16-pgtap` (trae `pg_prove`). Usa `supabase/tests/_shim.sql` (roles y `auth` falsos; **nunca** va en migraciones). No hay API REST: solo SQL. |

Tests: `scripts/test-db.sh` (o `npx supabase@3 test db` con Docker). Seed: `node scripts/seed.mjs` regenera `supabase/seed.sql` desde `data/hotel.json`.

### Usuarios DEMO (`supabase/seed.demo.sql`, solo local, nunca en producción)
| Correo | Rol | Contraseña |
|---|---|---|
| `duena@demo.test` | duena | `demo-hotel-andy` |
| `recepcion@demo.test` | recepcion | `demo-hotel-andy` |
| `limpieza@demo.test` | limpieza | `demo-hotel-andy` |

El demo inventa ~30 días de reservas, pagos, limpiezas, 3 facturas, consumos, precios de venta y 2 destinos NFC (`example.com`). Se niega a correr si el hotel ya tiene reservas.

## Roles

| Rol | Ve | Escribe directo |
|---|---|---|
| `anon` (web, bot sin sesión) | **Ninguna tabla.** Solo las 3 RPC públicas. | Nada (solo `crear_prereserva`). |
| `limpieza` | `hoteles`, `tipos_habitacion`, `habitaciones`, `reportes_mantenimiento`, su fila de `usuarios_hotel`. Sin huéspedes, reservas, pagos, productos ni dinero. | Nada: usa RPC (`empezar_limpieza`, `marcar_listo`, `reportar_dano`, `cuartos_por_limpiar`). |
| `recepcion` | Todo menos `config` y `auditoria`. | `habitaciones`, `huespedes`, `reservas`, `categorias`, `productos` (sin `stock`), `alertas`. |
| `duena` | Todo, incluida `config` (cuenta bancaria) y `auditoria`. | Lo de recepción + `hoteles`, `config`, `usuarios_hotel`, `tipos_habitacion`, `temporadas`, `tarifas`, `kit_por_tipo`, `nfc_destinos`, `calendarios_ical`. |
| `service_role` (Edge Functions) | Todo (salta RLS). Puede llamar todas las RPC. | Todo. |

El resto de tablas (pagos, compras, consumos, movimientos, mensajes, toques NFC) solo se escriben por RPC o con `service_role`.

## Tablas (`public`, todas con `hotel_id` + RLS)

| Tabla | Para qué | Notas |
|---|---|---|
| `hoteles` | Datos y `reglas` públicas (jsonb) del hotel, `plan` (E/C/P, null = sin definir). | |
| `config` | Privada: `cuenta_transferencia` (jsonb). | Solo dueña y service_role. |
| `usuarios_hotel` | `user_id` (auth.users) × `rol` (`duena`/`recepcion`/`limpieza`), `activo`. | |
| `tipos_habitacion` | 7 tipos: `clave`, `nombre`, `max_personas`, `orden`. | |
| `habitaciones` | 23 cuartos: `numero`, `piso`, `estado`, `estado_desde`, `activa`. | **Realtime.** Trigger valida transiciones. |
| `temporadas` | `es_base` (baja, cubre todo) + otras con `fechas` (`datemultirange`). | Alta sin fechas hasta que la dueña las cargue. |
| `tarifas` | `tipo_id` × `canal` × `temporada_id` → `precio_centavos`. `temporada_id` null = todo el año (Booking). | Sin filas de Booking/Airbnb aún. |
| `huespedes` | `nombre`, `documento`, `telefono` (normalizado `+593…`), `procedencia`, `consentimiento_en`, `acepta_campanas`. | Borrar un huésped deja sus reservas con `huesped_id` null (LOPDP). |
| `reservas` | `codigo`, `habitacion_id`, `huesped_id`, `entrada`, `salida` (`[)`), `personas`, `mascota`, `estado`, `fuente`, `canal`, `total_centavos`, `vence_en`, check-in/out (`_en`, `_por`), `ical_uid`. | **Realtime.** EXCLUDE `sin_cruces`. Canal y total se congelan al crear. |
| `pagos` | `reserva_id`, `monto_centavos`, `medio` (`efectivo`/`transferencia`), `comprobante_path`. | |
| `categorias` | `nombre`, `icono`, `orden`. | No se borra con productos (FK → `23503`). |
| `productos` | Insumos y venta: `unidad`, `stock` (null = sin contar), `minimo`, `se_vende`, `precio_compra_centavos`, `precio_venta_centavos`, `consumo_diario`, `activo`. | **Realtime.** `stock` no se edita: trigger lo rechaza. Borrar = `activo = false`. |
| `kit_por_tipo` | `tipo_id` × `producto_id` → `cantidad`, `por` (`limpieza`/`persona`). | |
| `movimientos_insumo` | Historial de stock: `tipo` (compra, limpieza, venta, merma, conteo, anulacion, consumo_diario), `cantidad` con signo, `stock_resultante`. | Solo inserción. Su trigger cambia `productos.stock` y las alertas. |
| `compras` / `compras_lineas` | Facturas: proveedor, número, fecha, foto, total; líneas con cantidad y costo. `anulada_en`. | No se repite proveedor + número activo. |
| `consumos` | Ventas: `cantidad`, precio y costo congelados, `total_centavos` (generado), `reserva_id` (al cuarto) o `medio` + `pagado_en`. | Pendiente = `reserva_id` y `medio` null. Anulada = `anulado_en` no null (filtrar siempre `anulado_en is null`). |
| `reportes_mantenimiento` | Daños: nota, foto, quién; `resuelto_en`. | |
| `alertas` | `tipo` (stock_bajo, por_limpiar, mantenimiento, cuarto_no_listo, conflicto_ical), `mensaje` listo para mostrar/enviar, `resuelta_en`, `notificada_en`. | **Realtime.** Una sola `stock_bajo` abierta por producto. |
| `mensajes_whatsapp` | Entrantes/salientes. `wa_message_id` único (webhook idempotente). | Escribe service_role. |
| `nfc_destinos` / `nfc_toques` | `/r/<lugar>` → `url` (https). Un toque por fila. | Escribe el toque service_role. |
| `calendarios_ical` | Por cuarto y canal: `url_importar`, `token_exportar`, última sincronización. | |
| `auditoria` | Quién (`usuario_id`) cambió qué (`antes`/`despues`) en reservas, estados de cuarto, pagos y compras. | Solo inserción por triggers. |

Storage: bucket privado `hotel`, ruta `<hotel_id>/<comprobantes|danos|facturas|productos>/<archivo>`. Sube cualquier rol del hotel; leen dueña y recepción.

## RPC públicas (`anon` y `authenticated`)

| Firma | Devuelve |
|---|---|
| `catalogo_publico(p_hotel text = 'hotel-andy')` | `jsonb` `{hotel: {nombre, ciudad, provincia, telefono, dominio, check_in, check_out, booking:{calificacion, resenas}, reglas}, tipos: [{id, clave, nombre, max_personas, descripcion, cuartos, desde_centavos}]}`. `desde` = temporada base, canal directo. |
| `consultar_disponibilidad(p_entrada date, p_salida date, p_personas int, p_hotel text = 'hotel-andy')` | Filas `{tipo_id, clave, nombre, max_personas, cuartos_libres, noches, total_centavos}` ordenadas por total. Solo tipos con cuartos libres (no en arreglo) y tarifa. Libera vencidas antes. Valida: entrada ≥ hoy, 1–30 noches, 1–20 personas. |
| `crear_prereserva(p_tipo_id uuid, p_entrada date, p_salida date, p_personas int, p_nombre text, p_telefono text, p_consentimiento boolean, p_mascota boolean = false, p_hotel text = 'hotel-andy')` | `jsonb` `{codigo, vence_en, total_centavos, entrada, salida, noches}`. Exige consentimiento. Vence a las `reglas.prereserva_horas` (2 h). Tope: 2 pre-reservas activas por teléfono y 10 de la web por hotel. Asigna el primer cuarto libre del tipo. |

## RPC del panel (`authenticated`; cada una valida rol y hotel)

| Firma | Roles | Hace / devuelve |
|---|---|---|
| `check_in(p_reserva uuid)` | duena, recepcion | prereserva/confirmada → `en_curso`; cuarto → Ocupado (debe estar Libre). |
| `check_out(p_reserva uuid, p_medio_consumos medio_pago = null)` | duena, recepcion | → `finalizada`; cuarto → Por limpiar; alerta `por_limpiar`. Con medio, cobra los consumos pendientes. Devuelve la cuenta (ver `cuenta_reserva`) **antes** de cobrar. |
| `cuenta_reserva(p_reserva uuid)` | duena, recepcion | `{total_centavos, pagado_centavos, consumos_pendientes:[{id, producto, cantidad, total_centavos, creado_en}], consumos_pendientes_centavos, saldo_centavos}` |
| `registrar_pago(p_reserva uuid, p_monto_centavos int, p_medio medio_pago, p_comprobante_path text = null)` | duena, recepcion | Inserta el pago; una prereserva pasa a `confirmada`. Devuelve `uuid` del pago. |
| `cancelar_reserva(p_reserva uuid, p_motivo text = null)` | duena, recepcion | prereserva/confirmada → `cancelada`. |
| `empezar_limpieza(p_habitacion uuid)` | todos | Por limpiar → Limpiando. |
| `deshacer_limpieza(p_habitacion uuid)` | todos | Limpiando → Por limpiar (deshace "Empezar"; desde otro estado falla: "Ese cuarto no se está limpiando"). No toca stock. |
| `marcar_listo(p_habitacion uuid)` | todos | Limpiando → Libre y descuenta el kit del tipo (toallas × personas de la última estadía) en la misma transacción. Cierra la alerta `por_limpiar`. |
| `reportar_dano(p_habitacion uuid, p_nota text, p_foto_path text = null)` | todos | Reporte + cuarto → En arreglo + alerta. Devuelve `uuid` del reporte. |
| `liberar_mantenimiento(p_habitacion uuid)` | duena | En arreglo → Libre; cierra reportes y alerta. |
| `cuartos_por_limpiar(p_hotel uuid)` | todos | Filas `{habitacion_id, numero, piso, tipo, estado, proxima_llegada, llega_hoy}` de cuartos Por limpiar/Limpiando, urgentes primero. Sin huésped ni dinero. |
| `ajustar_stock(p_producto uuid, p_tipo tipo_movimiento, p_cantidad numeric, p_nota text = null)` | duena, recepcion | `conteo` (cantidad = lo que hay), `merma` (lo perdido) o `compra` suelta. Devuelve el stock nuevo. Así se crea el stock de un producto nuevo. |
| `cargar_factura(p_hotel uuid, p_proveedor text, p_numero text, p_fecha date, p_lineas jsonb, p_foto_path text = null)` | duena, recepcion | `p_lineas = [{producto_id, cantidad, costo_unit_centavos}]`. Suma stock, guarda costo en el producto. Devuelve `uuid` de la compra. |
| `anular_factura(p_compra uuid, p_motivo text = null)` | duena | Revierte el stock de cada línea. |
| `anular_consumo(p_consumo uuid, p_motivo text = null)` | duena, recepcion | Anula una venta: devuelve el stock con un movimiento `anulacion` y marca `consumos.anulado_en` (la fila queda como historial). Ya no cuenta en `cuadre_dia`, `cuenta_reserva`, `check_out` ni `dinero_mes_centavos`. Falla si ya estaba anulada. |
| `registrar_consumo(p_producto uuid, p_cantidad numeric, p_reserva uuid = null, p_medio medio_pago = null)` | duena, recepcion | Exactamente uno: al cuarto (reserva confirmada/en curso) o pagado ya. Exige precio de venta. Descuenta stock. Devuelve `uuid`. |
| `cuadre_dia(p_hotel uuid, p_fecha date = hoy)` | duena, recepcion | `{fecha, total_centavos, costo_centavos, margen_centavos, sin_costo, por_producto:[{producto, categoria, cantidad, total_centavos, margen_centavos}], por_categoria:[{categoria, total_centavos}], por_medio:[{medio: efectivo|transferencia|al_cuarto, total_centavos}]}` |
| `resumen_inicio(p_hotel uuid)` | duena, recepcion | `{cuartos, ocupados, ocupacion_pct, por_limpiar, limpiando, en_arreglo, llegadas_hoy:[{reserva_id, codigo, habitacion, huesped, personas, estado}], salidas_hoy:[{reserva_id, codigo, habitacion, huesped, personas, estado}], insumos_bajos:[{producto_id, nombre, stock, minimo, unidad}], dinero_mes_centavos}` (pagos + consumos cobrados del mes). |
| `ocupacion_ingresos(p_hotel uuid, p_dias int = 30)` | duena, recepcion | Filas `{dia, canal, cuartos_ocupados, cuartos_totales, ingresos_centavos}`: una por día × canal (directo, booking, airbnb), ingreso = total de la reserva repartido por noche. |

CRUD directo con supabase-js (RLS): `reservas` (crear/mover/editar desde el calendario; el total se calcula solo si no se manda), `huespedes`, `categorias`, `productos` (sin `stock`), `alertas` (marcar `resuelta_en`), y la configuración de la dueña (`tarifas`, `temporadas.fechas`, `kit_por_tipo`, `hoteles`, `config`, `usuarios_hotel`, `nfc_destinos`, `calendarios_ical`).

## Reglas que viven en la base
- **Estados** (`habitaciones.estado`): libre → ocupado → por_limpiar → limpiando → libre; limpiando → por_limpiar (deshacer); cualquiera → mantenimiento; mantenimiento → libre/por_limpiar solo la dueña.
- **Reservas**: sin cruces (prereserva, confirmada y en curso bloquean; salida y entrada el mismo día no chocan). Personas ≤ capacidad. Canal sale de la fuente (booking/airbnb → su canal; resto → directo). Total = tarifa de cada noche según su temporada; sin tarifa directa la reserva falla; Booking/Airbnb sin tarifa quedan con total null hasta cargarlo.
- **Stock**: solo por `movimientos_insumo`. Null = sin contar: las salidas no lo tocan; una compra o un conteo lo empiezan. Puede quedar negativo, pero siempre con alerta.
- **Alerta de stock**: al quedar en o bajo el mínimo (o negativo) se abre una sola; el mensaje escribe decimales con coma ("1,5 kg"); se actualiza mientras siga baja y se cierra al reponer.

## Tareas programadas (`pg_cron`, migración `…600_cron.sql`)
- `liberar-prereservas` cada 5 min → `privado.liberar_prereservas_vencidas()`.
- `consumo-diario` 00:05 Guayaquil → `privado.descontar_consumo_diario()` (cloro 0,5 kg, una vez por día).
Si `pg_cron` no está, la migración solo avisa: agendar a mano.

## Al añadir una función
Postgres da `EXECUTE` a todos en cada función nueva: repite al final de la migración los `revoke`/`grant` de `…400_rpc_panel.sql`.
