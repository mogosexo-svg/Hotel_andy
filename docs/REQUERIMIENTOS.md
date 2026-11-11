# Hotel Andy · Requerimientos

> Primer cliente de **Soluciones Informáticas Mogolicous**. Fuente de verdad del alcance.
> Datos: `data/hotel.json`. Mensajes del recepcionista: `docs/mensajes-recepcionista-2026-11-10.md`. Propuesta vendida: `docs/propuesta-hotel-andy.md`. Respuestas de la dueña: `docs/respuestas-cliente-2026-11-10.md`.
> Cada requerimiento lleva su **plan**: E = Esencial, C = Completo, P = Premium. Se construye **todo** y se activa por plan (RF-38).

---

## 0. Qué vamos a construir

Tres piezas que comparten una sola base de datos:

1. **Web pública** (`hotelandyatacames.org`). Estática, rápida, no se cae. Vende el hotel y lleva a reservar por WhatsApp.
2. **Panel del hotel** (`/panel`). La pieza central: cuartos por colores, reservas, limpieza e insumos en tiempo real. Lo usa la dueña (persona mayor), recepción y las camareras desde el celular.
3. **Automatizaciones**. Avisos de WhatsApp, bot 24/7, sincronización con Booking y Airbnb por iCal, tareas programadas y respaldos.

**Fuera de alcance (decidido, no reabrir):** pagos en línea, facturación electrónica del SRI y hablar mal de Booking.

---

## 1. Requerimientos funcionales

### A. Web pública

| ID | Requerimiento | Plan | Criterio de aceptación |
|---|---|---|---|
| RF-01 | **Portada (hero)** con foto real de la piscina o la playa, el nombre, "a pasos de la playa en Atacames", la nota de Booking (8,7 · 238 reseñas) y el botón **Reservar**. | E | El hero llena la primera pantalla en móvil y escritorio. El botón se ve sin hacer scroll. |
| RF-02 | **Habitaciones**: los 7 tipos con foto, capacidad, "desde $X la noche" (temporada baja) y qué incluye. | E | Precios leídos de la base de datos, nunca escritos a mano. |
| RF-03 | **Consultar disponibilidad**: fechas + número de personas → tipos con cuartos libres y precio total según temporada → **pre-reserva** (RF-25) y se abre WhatsApp con el mensaje y el código ya escritos. | E | No ofrece un tipo sin cuartos libres. El total coincide con el panel. Con base de datos caída, muestra "Escríbenos por WhatsApp" en lugar de un error. |
| RF-04 | **El hotel**: piscina (08:00–01:00), parqueadero, mascotas con cargo, sin desayuno, sin ascensor, entrada 13:30, salida 11:30. | E | Todo sale de `reglas`. |
| RF-05 | **Ubicación**: mapa, cómo llegar y distancia a la playa. | E | El mapa se carga solo al tocarlo (no bloquea la carga de la página). |
| RF-06 | **Galería** con las fotos del cliente (`fotos/`). | E | Imágenes responsive en AVIF/WebP, con texto alternativo. |
| RF-07 | **Preguntas frecuentes** (mascotas, niños, anticipo, cancelación, parqueadero, piscina). | E | Marcadas con `FAQPage`. |
| RF-08 | **WhatsApp flotante** en todas las páginas. | E | Mensaje inicial prellenado. |
| RF-09 | **Redirección NFC** `/r/<lugar>` (piscina, fotos, cuarto, llavero) → página de reseña de Google, contando cada toque. | C | Se puede cambiar el destino sin reescribir la placa. El conteo se ve en el panel. |
| RF-10 | **SEO + IA**: `schema.org/Hotel` (+ `HotelRoom`, `FAQPage`), `llms.txt`, `sitemap.xml`, Open Graph y redirección desde la URL vieja si se puede. | E básico / C completo | Pasa la Prueba de resultados enriquecidos de Google. `llms.txt` describe el hotel con datos reales. |
| RF-11 | **Aviso de privacidad** (LOPDP Ecuador) y consentimiento en el formulario. | E | Casilla obligatoria en la pre-reserva. |

### B. Panel del hotel

#### 💎 Listón de calidad del panel (no negociable)
El panel es lo que vende el plan y lo que la dueña usará todos los días. Tiene que sentirse como un producto de primer nivel (pensar en Linear, Stripe o Airbnb Host), no como una plantilla de admin.
- **El mapa de cuartos es la estrella:** los 5 pisos como un edificio vivo. Los cambios llegan en tiempo real con una transición de color suave y un pulso breve en el cuarto que cambió.
- **Respuesta instantánea:** actualizaciones optimistas, skeletons en lugar de spinners y toasts con **Deshacer** en vez de "¿está seguro?" (salvo en lo irreversible).
- **Cada pantalla tiene sus 4 estados diseñados:** cargando, vacío (con una acción clara), error (en palabras humanas) y con datos.
- **Números que se leen solos:** contadores animados, barras de stock por color y gráficos limpios (skill `dataviz`).
- **Tipografía y espacio generosos**, una paleta tranquila y el color reservado para los estados.
- **Celular primero para la dueña y las camareras.** En escritorio, recepción tiene atajos de teclado y búsqueda rápida (Ctrl+K).
- **Cero jerga, cero pantallas muertas:** toda pantalla lleva a una acción.
- Revisado con `/impeccable critique` + `polish` y `impeccable detect`, y validado en 390 px y 1440 px antes de cada demo.

Roles: **dueña** (ve y cambia todo), **recepción** (reservas, check-in/out, cuartos), **limpieza** (solo sus cuartos por limpiar y reportar daños).

| ID | Requerimiento | Plan | Criterio de aceptación |
|---|---|---|---|
| RF-20 | **Acceso simple**: dueña y recepción con correo + contraseña; camareras con enlace mágico y sesión larga en su celular. | E | Una camarera entra una vez y no vuelve a escribir nada durante 30 días. |
| RF-21 | **Mapa de cuartos** por piso (1–5) con los 5 colores: 🟢 libre y limpio · 🔴 ocupado · 🟠 por limpiar · 🟡 limpiando · ⚫ mantenimiento. Cada cuarto muestra número, tipo, huésped y hora de salida. | E | Color + ícono + texto (sirve con daltonismo). Se actualiza solo en < 2 s en todos los dispositivos (Realtime). |
| RF-22 | **Máquina de estados**: `libre → ocupado → por_limpiar → limpiando → libre`, y desde cualquier estado a `mantenimiento`. Transiciones validadas en la base de datos. | E | Una transición no permitida (ej. `por_limpiar → ocupado`) la rechaza la base de datos, no solo la pantalla. |
| RF-23 | **Calendario de reservas**: línea de tiempo cuartos × días. Crear, mover, editar y cancelar. Fuente: WhatsApp, teléfono, web, Booking, Airbnb o sin reserva (walk-in). | E | Se puede reservar desde el celular en ≤ 3 toques después de elegir las fechas. |
| RF-24 | **Cero reservas cruzadas**: `EXCLUDE USING gist (habitacion_id WITH =, daterange(entrada, salida, '[)') WITH &&)` sobre reservas activas. | E | Un test intenta dos reservas solapadas y la segunda falla. Salida y entrada el mismo día sí se permiten. |
| RF-25 | **Pre-reserva** con vencimiento de 2 h: aparta el cuarto. Se registra el anticipo del 50 % (monto + foto del comprobante) → `confirmada`. Si nadie paga, se libera sola. | E | Tarea programada que libera vencidas. Aviso al huésped 30 min antes de vencer (C). |
| RF-26 | **Check-in / check-out** con un toque. El check-out pasa el cuarto a 🟠 y avisa a limpieza (RF-40, C). | E | Queda registrado quién y cuándo. |
| RF-27 | **Vista de camarera**: lista de cuartos 🟠 ordenada por urgencia (los que tienen llegada pronto, primero). "Empezar" → 🟡, "Listo" → 🟢 y se descuenta el kit de insumos. | E | Botones grandes. Funciona con una mano. Es lo único que ve el rol limpieza. |
| RF-28 | **Reportar daño** con foto y nota → cuarto ⚫ bloqueado. La dueña lo libera al arreglarse. | E | Un cuarto en mantenimiento no aparece disponible ni en la web ni en iCal. |
| RF-29 | **Inventario**: lista de insumos con stock, mínimo y unidad. Barras de nivel. Ajustes manuales (compra, merma, conteo) con historial. | E | El stock nunca queda negativo sin aviso. |
| RF-29a | **Cargar compra desde la factura** (lo pidió el recepcionista): proveedor, n.º de factura, fecha, foto de la factura y varias líneas (producto, cantidad, costo unitario) en una sola pantalla. Suma al stock y guarda el costo. | E | Una factura de 10 productos se carga en < 2 min desde el celular. Anular una factura revierte su stock. Recepción puede cargar; solo la dueña anula. |
| RF-30 | **Descuento automático**: por limpieza (papel 2, jabón 2, sábanas 1), por persona (toallas × huéspedes de la reserva) y por día (cloro 0,5 kg, tarea diaria). Kit configurable por tipo de cuarto. | E | Marcar "Listo" descuenta exactamente el kit, en la misma transacción. |
| RF-31 | **Alerta de stock bajo** en el panel (E) y por WhatsApp (C): "⚠️ Quedan 10 rollos de papel (alcanza para unos 5 cuartos)". Es **el dolor n.º 1 del recepcionista**: hoy cargan productos y nada les avisa, y terminan "corre corre" preguntando cuánto queda. | E/C | Una sola alerta al cruzar el mínimo, no una por limpieza. Papel y jabón con stock exacto y visible para la dueña y recepción sin preguntar a nadie. |
| RF-32 | **Lista de compras** automática + **previsión de feriado**: `reservas futuras × kit − stock = faltante`. | P | Se comparte por WhatsApp con un toque. |
| RF-33 | **Cuarto no listo**: cada 15 min se cruzan las llegadas de las próximas 2 h con cuartos que no están 🟢 → aviso a recepción y a la dueña. | C | Un aviso por reserva, no uno cada 15 min. |
| RF-34 | **Huéspedes**: nombre, cédula o pasaporte, teléfono, procedencia, número de personas y mascota (sí/no). Historial de estancias. | E | Se busca por nombre o teléfono. |
| RF-35 | **Auditoría**: quién creó, cambió o canceló cada reserva y cada estado. | E | Tabla de solo inserción, escrita por triggers. |
| RF-36 | **Inicio de la dueña**: ocupación de hoy, llegadas y salidas, cuartos por limpiar, insumos bajos y dinero del mes. | E | Se entiende en 5 segundos. Números grandes. |
| RF-37 | **Reportes**: consumo de insumos por mes y **resumen diario por WhatsApp** a la hora que elija la dueña. | P | El resumen cabe en una pantalla de celular. |
| RF-38 | **Configuración**: precios por tipo y temporada, calendario de temporada alta y feriados, reglas, kit por tipo, usuarios y **plan del hotel** (activa o apaga las funciones de C y P). | E | Cambiar un precio se refleja en la web, el panel y el bot. |
| RF-38a | **Precio por canal**: **directo** (web, WhatsApp, bot, recepción) con temporada baja/alta, que es la tabla del cliente; **Booking** con precio fijo por tipo, sin temporada; **Airbnb** por decidir. Cada reserva guarda el canal y el precio con que se vendió. | E | La web y el bot nunca muestran el precio de Booking. Los reportes separan ingresos por canal. |
| RF-39 | **Multi-hotel**: todo lleva `hotel_id` y se aísla con RLS. | E | Un usuario del hotel A no ve nada del hotel B (con test). |

### C. WhatsApp (API oficial de Meta)

| ID | Requerimiento | Plan | Criterio de aceptación |
|---|---|---|---|
| RF-40 | **Plantillas**: cuarto desocupado, stock bajo, cuarto no listo, confirmación de reserva, bienvenida (ubicación + hora), gracias al salir, pre-reserva por vencer. | C | Plantillas aprobadas por Meta **antes** de la semana 3 (la aprobación tarda). |
| RF-41 | **Asistente 24/7** (Claude Haiku vía API, usar la skill `claude-api`): responde precios, disponibilidad (herramienta que consulta la base de datos), reglas, ubicación y piscina. Crea pre-reservas y envía los datos de transferencia. | C | **Nunca inventa** precios ni disponibilidad. Cancelaciones, reembolsos, quejas y pagos → pasa a la dueña. Responde en < 10 s. |
| RF-42 | **Lista de espera en feriados** y **campañas a ex clientes** ("¡Vuelve en Carnaval!"), solo a quien aceptó recibirlas. | P | Opción para darse de baja en cada mensaje. |

### D. Canales y extras

| ID | Requerimiento | Plan | Criterio de aceptación |
|---|---|---|---|
| RF-50 | **iCal**: exportar un calendario por cuarto e importar el de Booking y el de Airbnb cada 15 min. Conflicto → alerta a la dueña. | C (Booking: E) | Una reserva de Airbnb aparece en el panel y aparta el cuarto. |
| RF-51 | **Perfil de Airbnb**: crearlo y decorarlo (tarea manual, con checklist en `docs/`). | C | Publicado y conectado por iCal. |
| RF-52 | **Placas NFC** NTAG213 apuntando a `/r/<lugar>`: 2 en C, 5 en P. | C/P | Probadas con Android y iPhone. |

### E. Productos, categorías y ventas · ✅ aprobado (11 nov 2026)

Pedido del recepcionista: venden **cerveza, agua, Powerade** "y esas cositas". Decisión: **el hotel gestiona su propio catálogo** (CRUD completo) y todo (insumos y productos de venta) vive en **un solo inventario por categorías**.

| ID | Requerimiento | Plan | Criterio de aceptación |
|---|---|---|---|
| RF-60 | **CRUD de categorías**: crear, renombrar, ordenar, poner ícono y borrar. Iniciales: Baño y amenidades, Lencería, Limpieza, Piscina, Bebidas, Snacks. | E | No se puede borrar una categoría con productos: pide moverlos primero. |
| RF-61 | **CRUD de productos**: nombre, categoría, unidad, foto opcional, stock, mínimo, ¿se vende? (sí/no), precio de compra y de venta, activo/inactivo. Búsqueda y filtro por categoría con chips. | E | Crear un producto en < 30 s desde el celular. Borrar = desactivar (el historial se conserva). Solo dueña y recepción editan. |
| RF-62 | **Registrar consumo / venta** en 2 toques: producto + cantidad → **cargar al cuarto** o **pagado ya** (efectivo/transferencia). Descuenta stock y dispara RF-31 si baja del mínimo. | E | En el check-out aparecen los consumos pendientes del cuarto con su total. |
| RF-63 | **Cuadre del día**: ventas por producto, categoría y forma de pago, y margen (venta − costo). | E | Coincide con la suma de los consumos registrados. |
| RF-64 | **Inventario por categoría**: la pantalla de inventario (RF-29) agrupa y filtra por categoría, con el estado de cada una (cuántos productos bajos). | E | Se ve de un vistazo qué categoría necesita compra. |

**Fuera de alcance:** contabilidad formal, facturación del SRI y cuentas por pagar.

---

## 2. Requerimientos no funcionales

| ID | Tema | Requerimiento medible |
|---|---|---|
| RNF-01 | **Disponibilidad** | La web pública es estática en la CDN de Cloudflare, con 99,9 %. Si cae Supabase, la web sigue arriba y solo la disponibilidad muestra "escríbenos por WhatsApp". Nunca una página en blanco. |
| RNF-02 | **Rendimiento** | Web: LCP < 2,5 s en móvil 4G lento, CLS < 0,1, Lighthouse ≥ 95 en las 4 categorías, JS inicial < 50 KB. Panel: interactivo en < 3 s en un Android de gama baja. |
| RNF-03 | **Tiempo real** | Un cambio de estado de cuarto se ve en todos los dispositivos en < 2 s. |
| RNF-04 | **Integridad** | Reglas críticas en la base de datos (EXCLUDE, CHECK, transiciones, descuento de insumos en la misma transacción). Webhooks idempotentes. |
| RNF-05 | **Seguridad** | RLS en todas las tablas. La clave `service_role` solo en Edge Functions. Firma de webhooks de Meta verificada. Cloudflare Turnstile en formularios públicos. Secretos fuera del repo. Revisión con `security-reviewer` antes de producción. |
| RNF-06 | **Datos personales** | LOPDP Ecuador: aviso de privacidad, consentimiento, borrar huéspedes a pedido. La cuenta bancaria de la dueña nunca va a la web pública, `llms.txt` ni schema.org. |
| RNF-07 | **Respaldos** | `pg_dump` diario con GitHub Actions → Cloudflare R2, retención de 30 días, **prueba de restauración mensual**. Ping diario para que Supabase gratis no se pause. |
| RNF-08 | **Monitoreo** | UptimeRobot cada 5 min sobre la web y `/health`. Alertas a nosotros, no al hotel. |
| RNF-09 | **Accesibilidad** | WCAG 2.2 AA. Panel pensado para una persona mayor: texto ≥ 18 px, toques ≥ 48 px, contraste ≥ 4,5:1, cero jerga ("Listo", no "Commit"), confirmación antes de acciones que no se deshacen. |
| RNF-10 | **Usabilidad** | Mobile-first. Cualquier tarea frecuente en ≤ 3 toques. Se puede usar con una mano (camareras). |
| RNF-11 | **Animaciones** | Con propósito: 150–400 ms, solo `transform`/`opacity`, sin bloquear la interacción. Respetan `prefers-reduced-motion`. Web: entrada del hero, aparición al hacer scroll y agua de la piscina (luz animada). Panel: transición de color de estado, pulso al llegar un cambio en vivo, contadores que suben. |
| RNF-12 | **Costo** | $0 fijo de infraestructura (Cloudflare Pages, Supabase, UptimeRobot y R2 gratis). Solo el dominio (~$15/año) y WhatsApp por mensaje. |
| RNF-13 | **Localización** | `es-EC`, USD, zona `America/Guayaquil`, fechas "sáb 14 feb". Precios con IVA según se decida (pendiente). |
| RNF-14 | **Compatibilidad** | Chrome Android, Safari iOS y Chrome/Edge escritorio (últimas 2 versiones). |
| RNF-15 | **Mantenibilidad** | TypeScript estricto. Migraciones SQL versionadas en `supabase/migrations`. Tests de la lógica crítica (reservas, estados, insumos, RLS). Sin dependencias para cosas de pocas líneas. |
| RNF-16 | **Sin conexión** (deseable) | El panel como PWA instalable. El "Listo" de la camarera se guarda en cola si no hay señal. |

---

## 3. Arquitectura

```
Cloudflare Pages ── Astro (web estática + /panel con islas React)
        │                      │ supabase-js (Auth, Realtime, RPC)
        ▼                      ▼
   Cloudflare DNS        Supabase (Postgres + RLS + Realtime + Storage)
                               │ pg_cron: liberar pre-reservas, cuarto no listo,
                               │          cloro diario, importar iCal, resumen diario
                               ▼
                   Supabase Edge Functions ── WhatsApp Cloud API (Meta)
                   (webhook WhatsApp, bot,    Claude API (bot)
                    iCal export, /r/ NFC)     iCal Booking / Airbnb
GitHub Actions ── pg_dump diario → Cloudflare R2        UptimeRobot → /health
```

**Tablas mínimas:** `hoteles`, `usuarios_hotel` (rol), `tipos_habitacion`, `habitaciones` (estado), `temporadas`, `tarifas` (tipo × canal × temporada), `compras` + `compras_lineas` (facturas), `huespedes`, `reservas` (estado: prereserva/confirmada/en_curso/finalizada/cancelada, fuente, EXCLUDE), `pagos`, `categorias`, `productos` (insumos y de venta, `se_vende`), `consumos`, `kit_por_tipo`, `movimientos_insumo`, `reportes_mantenimiento`, `mensajes_whatsapp`, `nfc_toques`, `auditoria`, `config` (privada).

---

## 4. Plan de entrega (3 semanas, plan Completo)

| Semana | Entregable | Demo al final |
|---|---|---|
| 1 | Base de datos completa con tests, seed desde `data/hotel.json`, web pública con fotos reales, desplegada en el dominio. | Web en vivo + intento de reserva cruzada que falla. |
| 2 | Panel: mapa de cuartos, calendario, pre-reservas, vista de camarera, insumos con descuento automático, **cargar factura**, **CRUD de productos y categorías + consumos**, inicio de la dueña. | Check-out → 🟠 → camarera "Listo" → 🟢 y baja el stock, en dos celulares a la vez. |
| 3 | WhatsApp (plantillas + bot), iCal Booking/Airbnb, NFC, SEO/IA, respaldos, monitoreo, perfil de Airbnb. | 🎯 El aviso en vivo "Cuarto 204 desocupado, a limpiar" llegando al WhatsApp. |

---

## 5. ⚠️ Pendientes del cliente (preguntar antes o durante la semana 1)

1. **Cuarto 101**: dejó "Ejemplo: cuadruple". ¿Es cuádruple a $70/$90?
2. **Teléfono** `+593 6276 0674`: formato raro. ¿Cuál es el número exacto y tiene WhatsApp? ¿Hay un número del hotel para la API de WhatsApp Business?
3. **Toallas y sábanas**: ¿cuántos juegos hay? ¿Se lavan en el hotel?
4. **Shampoo**: ¿de qué tamaño es la recarga del dispensador y cada cuánto se rellena?
5. **Cloro**: ya está en el mínimo (4 kg = unos 8 días). El sistema avisará el primer día. Buen momento para la demo.
6. **Mascotas**: ¿cuánto se cobra?
7. **Piscina hasta la 01:00**: ¿es correcto?
8. **Fechas de temporada alta y feriados** 2026–2027.
9. **Cancelaciones**: sin regla fija. El bot no promete nada y le pasa el caso a ella. ¿Le parece bien?
10. **¿Qué plan eligió?** (E, C o P).
11. **IVA**: ¿los precios ya lo incluyen? (Importa para Airbnb.)
12. **Google Maps**: ¿la ficha está a su nombre?
13. **Fotos** (ver `fotos/README.md`).
14. **Precio fijo de Booking** por tipo de cuarto (no cambia por temporada).
15. **Airbnb**: ¿precio directo por temporada o fijo como Booking?
16. **¿Dónde cargan hoy los productos?** (Excel, cuaderno, otro programa.) Si es digital, importamos sus datos.
17. **Productos de venta**: ellos los cargan con el CRUD. Solo confirmar si los consumos se cargan al cuarto o se cobran en el momento (el sistema permite ambas).

### 🚨 Corregir en la presentación: el cálculo de Airbnb
La propuesta usó **$46** (estimado de Momondo). Los precios reales son otros: el hotel recibe `precio × 0,845`.

| Cuarto | Temporada baja | El hotel recibe | Noches para pagar el plan Completo ($200) |
|---|---|---|---|
| Doble sencilla | $35 | $29,58 | 7 |
| Doble deluxe / Triple | $50 | $42,25 | 5 |
| Familiar | $85 | $71,83 | 3 |
| Suite | $130 | $109,85 | 2 |

"3 huéspedes de 2 noches" solo funciona con cuartos de $40 o más. Con dobles sencillas hacen falta 7 noches.
