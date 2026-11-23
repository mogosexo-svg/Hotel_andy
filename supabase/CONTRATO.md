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
| `comprobantes` | Foto del anticipo que manda el huésped: `reserva_id` (null = sin asociar), `telefono` (E.164), `foto_path` (`<hotel_id>/comprobantes/...`, CHECK), `monto_declarado_centavos`, `origen` (`whatsapp`/`recepcion`/`web`), `estado` (`pendiente`/`aceptado`/`rechazado`), `motivo_rechazo`, `pago_id`, `revisado_por`, `revisado_en`, `vence_antes` (interno), `wa_message_id` (único). | **Realtime.** Leen dueña y recepción; se escribe solo por RPC. CHECK: aceptado ⇒ pago + reserva + `revisado_en`; rechazado ⇒ motivo + `revisado_en`. **n8n avisa al huésped** escuchando `estado = 'rechazado'` (con `motivo_rechazo` y `telefono`) por Realtime (service_role) o un webhook de BD sobre `UPDATE`. |
| `cierres_caja` | Cierre de caja (2 al día): `turno` (`tarde`/`noche`), `fecha` (día de Guayaquil del turno), `desde`/`hasta` (el siguiente empieza en el `hasta` del anterior), `efectivo_esperado_centavos`, `transferencia_centavos`, `total_centavos` (generado), `efectivo_contado_centavos`, `diferencia_centavos` (generado: contado − esperado, con signo; negativo = faltan), `nota`, `mensaje` (resumen para WhatsApp), `cerrado_por`, `cerrado_en`. | **Realtime.** Leen dueña y recepción; se escribe solo por `cerrar_caja`. Único por hotel + fecha + turno. **n8n manda `mensaje` al WhatsApp de la dueña** escuchando los `INSERT` de esta tabla (Realtime con service_role o webhook de BD); aún no está construido. |
| `categorias` | `nombre`, `icono`, `orden`. `icono` es una clave, no un emoji: `bano`, `lenceria`, `limpieza`, `piscina`, `bebidas`, `snacks` (las categorías nuevas pueden usar otra clave). | No se borra con productos (FK → `23503`). |
| `productos` | Insumos y venta: `unidad`, `stock` (null = sin contar), `minimo`, `se_vende`, `precio_compra_centavos`, `precio_venta_centavos`, `consumo_diario`, `activo`. | **Realtime.** `stock` no se edita: trigger lo rechaza. Borrar = `activo = false`. |
| `kit_por_tipo` | `tipo_id` × `producto_id` → `cantidad`, `por` (`limpieza`/`persona`). | |
| `movimientos_insumo` | Historial de stock: `tipo` (compra, limpieza, venta, merma, conteo, anulacion, consumo_diario), `cantidad` con signo, `stock_resultante`. | Solo inserción. Su trigger cambia `productos.stock` y las alertas. |
| `compras` / `compras_lineas` | Facturas: proveedor, número, fecha, foto, total; líneas con cantidad y costo. `anulada_en`. | No se repite proveedor + número activo. |
| `consumos` | Ventas: `cantidad`, precio y costo congelados, `total_centavos` (generado), `reserva_id` (al cuarto) o `medio` + `pagado_en`. | Pendiente = `reserva_id` y `medio` null. Anulada = `anulado_en` no null (filtrar siempre `anulado_en is null`). |
| `reportes_mantenimiento` | Daños: nota, foto, quién; `resuelto_en`. | |
| `alertas` | `tipo` (stock_bajo, por_limpiar, mantenimiento, cuarto_no_listo, conflicto_ical, comprobante, cierre_caja), `comprobante_id`, `caja_fecha` + `caja_turno` (de `cierre_caja`), `mensaje` listo para mostrar/enviar, `resuelta_en`, `notificada_en`. | **Realtime.** Una sola `stock_bajo` abierta por producto; una sola `cierre_caja` abierta por hotel + fecha + turno. |
| `mensajes_whatsapp` | Entrantes/salientes. `wa_message_id` único (webhook idempotente). | Escribe service_role. |
| `nfc_destinos` / `nfc_toques` | `/r/<lugar>` → `url` (https). Un toque por fila. | Escribe el toque service_role. |
| `calendarios_ical` | Por cuarto y canal: `url_importar`, `token_exportar`, última sincronización. | |
| `auditoria` | Quién (`usuario_id`) cambió qué (`antes`/`despues`) en reservas, estados de cuarto, pagos y compras. | Solo inserción por triggers. |

Storage: bucket privado `hotel`, ruta `<hotel_id>/<comprobantes|danos|facturas|productos>/<archivo>`. Sube cualquier rol del hotel; leen dueña y recepción. Los comprobantes que llegan por WhatsApp los sube n8n (service_role) a `<hotel_id>/comprobantes/`.

## RPC públicas (`anon` y `authenticated`)

| Firma | Devuelve |
|---|---|
| `catalogo_publico(p_hotel text = 'hotel-andy')` | `jsonb` `{hotel: {nombre, ciudad, provincia, telefono, dominio, check_in, check_out, booking:{calificacion, resenas}, reglas}, tipos: [{id, clave, nombre, max_personas, descripcion, cuartos, desde_centavos}]}`. `desde` = temporada base, canal directo. |
| `consultar_disponibilidad(p_entrada date, p_salida date, p_personas int, p_hotel text = 'hotel-andy')` | Filas `{tipo_id, clave, nombre, max_personas, cuartos_libres, noches, total_centavos}` ordenadas por total. Solo tipos con cuartos libres (no en arreglo) y tarifa. Libera vencidas antes. Valida: entrada ≥ hoy, 1–30 noches, 1–20 personas. |
| `calendario_publico(p_desde date, p_hasta date, p_personas int, p_hotel text = 'hotel-andy', p_tipo text = null)` | Filas `{dia, cuartos_libres, desde_centavos, temporada_alta}`, una por día de `[p_desde, p_hasta)`. Libres = activos, no en arreglo, capacidad ≥ personas, sin reserva activa esa noche (pre-reservas vencidas se ignoran). `desde_centavos` = tarifa directa más barata entre tipos con libres (null si no hay). Con `p_tipo` (clave o id del tipo, como en `catalogo_publico`) solo cuenta ese tipo: libres y `desde_centavos` son de ese tipo; un tipo desconocido da 0 libres. Sin `p_tipo`, todo el hotel. Valida: `p_desde` ≥ hoy − 1, 1–92 días, 1–20 personas. |
| `crear_prereserva(p_tipo_id uuid, p_entrada date, p_salida date, p_personas int, p_nombre text, p_telefono text, p_consentimiento boolean, p_mascota boolean = false, p_hotel text = 'hotel-andy')` | `jsonb` `{codigo, vence_en, total_centavos, entrada, salida, noches}`. Exige consentimiento. Vence a las `reglas.prereserva_horas` (2 h). Tope: 2 pre-reservas activas por teléfono y 10 de la web por hotel. Asigna el primer cuarto libre del tipo. |

## RPC del panel (`authenticated`; cada una valida rol y hotel)

| Firma | Roles | Hace / devuelve |
|---|---|---|
| `check_in(p_reserva uuid)` | duena, recepcion | prereserva/confirmada → `en_curso`; cuarto → Ocupado (debe estar Libre). |
| `check_out(p_reserva uuid, p_medio_consumos medio_pago = null)` | duena, recepcion | → `finalizada`; cuarto → Por limpiar; alerta `por_limpiar`. Con medio, cobra los consumos pendientes. Devuelve la cuenta (ver `cuenta_reserva`) **antes** de cobrar. |
| `cuenta_reserva(p_reserva uuid)` | duena, recepcion | `{total_centavos, pagado_centavos, consumos_pendientes:[{id, producto, cantidad, total_centavos, creado_en}], consumos_pendientes_centavos, saldo_centavos}` |
| `registrar_pago(p_reserva uuid, p_monto_centavos int, p_medio medio_pago, p_comprobante_path text = null)` | duena, recepcion | Inserta el pago; una prereserva pasa a `confirmada`. Devuelve `uuid` del pago. |
| `cancelar_reserva(p_reserva uuid, p_motivo text = null)` | duena, recepcion | prereserva/confirmada → `cancelada`. |
| `comprobantes_pendientes(p_hotel uuid)` | duena, recepcion | Filas `{comprobante_id, creado_en, origen, telefono, foto_path, monto_declarado_centavos, huesped, reserva_id, codigo, reserva_estado, habitacion, tipo, entrada, salida, total_centavos, anticipo_centavos, pagado_centavos, vence_en}`, más viejos primero. Campos de reserva null si no está asociado. `anticipo` = `reglas.anticipo.porcentaje` (50 %) del total. |
| `aceptar_comprobante(p_comprobante uuid, p_monto_centavos int)` | duena, recepcion | Solo pendiente y con reserva. Registra el pago (misma regla que `registrar_pago`, medio `transferencia`, `comprobante_path` = la foto), pre-reserva → `confirmada`, comprobante → aceptado, resuelve la alerta. Devuelve `uuid` del pago. Falla: "Este comprobante ya fue revisado", "Asocia el comprobante a una reserva antes de aceptarlo", "La reserva X está cancelada…" / "La pre-reserva X venció y el cuarto se liberó…". |
| `rechazar_comprobante(p_comprobante uuid, p_motivo text)` | duena, recepcion | Motivo obligatorio. Devuelve la pre-reserva a su vencimiento normal (ahora + `prereserva_horas`, sin pasar del que tenía si aún no llegó; no lo toca si hay otro comprobante pendiente). Resuelve la alerta. |
| `asociar_comprobante(p_comprobante uuid, p_reserva uuid)` | duena, recepcion | Asigna (o corrige) la reserva de un comprobante pendiente; retiene la pre-reserva nueva y suelta la anterior. |
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
| `resumen_caja(p_hotel uuid)` | duena, recepcion | Lo que entró a caja desde el último cierre (sin cierres: desde las 00:00 de hoy) hasta ahora: `{fecha, turno: tarde\|noche, hora: 'HH:MM', cerrado, horas:{tarde, noche}, desde, hasta, efectivo_centavos, transferencia_centavos, total_centavos, movimientos_cuenta, movimientos:[{hora, concepto, medio, monto_centavos}]}` (los 50 más recientes). Cuenta pagos de reservas (`creado_en`) y ventas cobradas no anuladas (por `pagado_en`); lo cargado al cuarto entra cuando se cobra en `check_out`, así nada se cuenta dos veces. `turno` = el que toca: tarde si hoy no hay cierres, noche si ya se cerró la tarde; `cerrado = true` si ya se cerró la noche de hoy. Antes de la hora de la tarde, si ayer se cerró la tarde y no la noche, toca la noche de ayer (cierre pasada la medianoche). |
| `cerrar_caja(p_hotel uuid, p_turno text, p_efectivo_contado_centavos int, p_nota text = null)` | duena, recepcion | Recalcula en el servidor (solo confía en el contado), guarda el cierre con `desde` = `hasta` del anterior y resuelve las alertas `cierre_caja` de ese turno y anteriores (cerrar la noche incluye la tarde). Devuelve la fila completa (`jsonb`, con `mensaje`). Falla: "Elige el cierre: tarde o noche", "Escribe cuánto efectivo hay contado en la caja", "El cierre de la tarde/noche ya se hizo hoy", "El cierre de la noche ya se hizo: lo de la tarde quedó incluido ahí". `mensaje` (sin emojis, `*negrita*` de WhatsApp): título con turno, hotel, día y hora · Entró (efectivo · transferencias) · Caja: contado y "cuadra" / "faltan $X" / "sobran $X" · Ventas por producto con cantidad y total (consumos no anulados creados en el período, incluso los cargados al cuarto; la línea no sale si no hubo) · Habitaciones ocupadas de N y llegadas/salidas pendientes de hoy · Cerró: nombre · Nota. Dinero como `$1.234,50`. |
| `resumen_inicio(p_hotel uuid)` | duena, recepcion | `{cuartos, ocupados, ocupacion_pct, por_limpiar, limpiando, en_arreglo, llegadas_hoy:[{reserva_id, codigo, habitacion, huesped, personas, estado}], salidas_hoy:[{reserva_id, codigo, habitacion, huesped, personas, estado}], insumos_bajos:[{producto_id, nombre, stock, minimo, unidad}], dinero_mes_centavos}` (pagos + consumos cobrados del mes). |
| `ocupacion_ingresos(p_hotel uuid, p_dias int = 30)` | duena, recepcion | Filas `{dia, canal, cuartos_ocupados, cuartos_totales, ingresos_centavos}`: una por día × canal (directo, booking, airbnb), ingreso = total de la reserva repartido por noche. |

CRUD directo con supabase-js (RLS): `reservas` (crear/mover/editar desde el calendario; el total se calcula solo si no se manda), `huespedes`, `categorias`, `productos` (sin `stock`), `alertas` (marcar `resuelta_en`), y la configuración de la dueña (`tarifas`, `temporadas.fechas`, `kit_por_tipo`, `hoteles`, `config`, `usuarios_hotel`, `nfc_destinos`, `calendarios_ical`).

## RPC del backend (solo `service_role`: n8n / Edge Functions)

| Firma | Hace / devuelve |
|---|---|
| `recibir_comprobante(p_hotel uuid, p_telefono text, p_foto_path text, p_wa_message_id text = null, p_codigo text = null, p_monto_centavos int = null)` | `jsonb {comprobante_id, reserva_id, codigo, asociado}`. Idempotente por `wa_message_id` (repetir devuelve el mismo, sin efectos). Asocia por `p_codigo` (cualquier estado) o, sin código, la pre-reserva más reciente del huésped con ese teléfono (normalizado como el resto). La foto debe estar en `<p_hotel>/comprobantes/`. Retiene la pre-reserva: `vence_en` = máx(actual, ahora + 24 h). Abre alerta `comprobante` ("Comprobante de <nombre> para la reserva <código>" o "Comprobante sin reserva asociada (<teléfono>)"). anon y authenticated no pueden llamarla. |

## Reglas que viven en la base
- **Estados** (`habitaciones.estado`): libre → ocupado → por_limpiar → limpiando → libre; limpiando → por_limpiar (deshacer); cualquiera → mantenimiento; mantenimiento → libre/por_limpiar solo la dueña.
- **Reservas**: sin cruces (prereserva, confirmada y en curso bloquean; salida y entrada el mismo día no chocan). Personas ≤ capacidad. Canal sale de la fuente (booking/airbnb → su canal; resto → directo). Total = tarifa de cada noche según su temporada; sin tarifa directa la reserva falla; Booking/Airbnb sin tarifa quedan con total null hasta cargarlo.
- **Stock**: solo por `movimientos_insumo`. Null = sin contar: las salidas no lo tocan; una compra o un conteo lo empiezan. Puede quedar negativo, pero siempre con alerta.
- **Comprobantes**: recibir uno retiene la pre-reserva hasta 24 h (el cron no la libera mientras); aceptarlo la confirma; rechazarlo devuelve el vencimiento normal.
- **Cierres de caja**: horas en `hoteles.reglas.cierres_caja` `{tarde: '15:00', noche: '22:00'}` (America/Guayaquil; valores por confirmar con la dueña, `_verificar` en `data/hotel.json`). Pasada la hora y sin cierre de ese turno hoy, se abre la alerta `cierre_caja` "Toca el cierre de la tarde" / "Toca el cierre de la noche" (llega a la campana por Realtime de `alertas`).
- **Alerta de stock**: al quedar en o bajo el mínimo (o negativo) se abre una sola; el mensaje escribe decimales con coma ("1,5 kg"); se actualiza mientras siga baja y se cierra al reponer.

## Tareas programadas (`pg_cron`, migración `…600_cron.sql`)
- `liberar-prereservas` cada 5 min → `privado.liberar_prereservas_vencidas()`.
- `consumo-diario` 00:05 Guayaquil → `privado.descontar_consumo_diario()` (cloro 0,5 kg, una vez por día).
- `avisar-cierres-caja` cada 5 min → `privado.avisar_cierres_caja()` (migración `…20261123000100_cierres_caja.sql`).
Si `pg_cron` no está, la migración solo avisa: agendar a mano.

## Al añadir una función
Postgres da `EXECUTE` a todos en cada función nueva: repite al final de la migración los `revoke`/`grant` de `…400_rpc_panel.sql`.
