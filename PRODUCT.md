# Product

Hotel Andy: página web propia, reservas y panel de control de un hotel de playa de 3 estrellas en Atacames (Esmeraldas, Ecuador). Construido por Soluciones Informáticas Mogolicous; es su primer cliente y su futuro caso de éxito.

> Fuentes: propuesta aceptada (`docs/propuesta-hotel-andy.md`) y respuestas de la dueña del 10 nov 2026 (`docs/respuestas-cliente-2026-11-10.md`). Lo marcado *(inferido)* sale del brief y no fue confirmado por la dueña.

## Platform
web

## Stack
Astro en Cloudflare Pages (web estática + `/panel` con islas React), Supabase (Postgres + RLS + Realtime + Storage + Edge Functions), WhatsApp Cloud API, Claude API para el bot. Detalle: `docs/REQUERIMIENTOS.md` § 3.

## Users
- **Huésped potencial** (web): familias y grupos de Ecuador y Colombia que buscan playa + piscina a buen precio; llegan desde el celular por Google, Booking, Airbnb o recomendación de una IA *(inferido)*. Quiere saber rápido si hay cuarto, cuánto cuesta y cómo reservar.
- **La dueña** (panel): persona mayor, no técnica. Quiere ver el hotel entero sin tener que preguntarle a nadie. Usa sobre todo el celular *(inferido; confirmar)*.
- **Recepción** (panel): reservas, check-in y check-out.
- **Camareras** (panel, celular): ven qué cuarto limpiar y tocan "Listo".

## Product Purpose
Que el hotel tenga una web que no se cae, que nunca venda un cuarto dos veces, que nadie tenga que preguntar si un cuarto está libre o limpio, y que no se acaben el papel, el jabón o el cloro sin aviso.

## Positioning
El hotel con mejor nota de la zona (8,7 en Booking, 238 reseñas), a pasos de la playa y con piscina abierta hasta tarde. Booking es una fortaleza, no el enemigo; Airbnb es crecimiento. Nada de "el más barato".

## Operating Context
23 habitaciones en 5 pisos (65 plazas), **sin ascensor**. Entrada 13:30, salida 11:30. Anticipo del 50 % por transferencia y pre-reserva de 2 h. Precio fijo por cuarto (no por persona). Mascotas con cargo, parqueadero, sin desayuno. Piscina de 08:00 a 01:00. Señal móvil irregular en la playa. Feriados (Carnaval, Semana Santa, fin de año) llenan el hotel. Precios: directo por temporada; Booking con precio fijo. El recepcionista carga los pedidos desde la factura y hoy nadie avisa cuando algo se acaba. El hotel también vende bebidas (cerveza, agua, Powerade): módulo de venta en fase 2.

## Capabilities and Constraints
- Sin pagos en línea ni facturación del SRI (decidido).
- Infraestructura de $0 fijo.
- Reglas críticas en la base de datos, no solo en la pantalla.
- Datos bancarios de la dueña solo en la configuración privada.
- Todo dato mostrado es real: precios, notas y reglas salen de la base de datos.

## Brand Commitments
- Calidez de hotel familiar de la costa, no lujo frío ni plantilla de cadena.
- Agua, luz y sol: la piscina y la playa son el producto.
- Voz: español de Ecuador, cercano y claro. Tutea al huésped en la web *(inferido)*. Al hablarle a la dueña en el panel usa palabras simples ("Listo", "Por limpiar", "Se está acabando").
- No hay logo ni paleta oficial todavía *(preguntar)*.

## Evidence on Hand
- Nota de Booking: 8,7 con 238 reseñas.
- Fotos reales del hotel: las entrega el cliente en `fotos/` (pendiente).
- Sin testimonios propios todavía.

## Product Principles
1. **La dueña no pregunta, mira.** Todo estado importante se ve en una pantalla y en color.
2. **Nada pasa porque alguien se acordó.** Avisos automáticos.
3. **La web nunca está en blanco.** Si algo falla, el camino es WhatsApp.
4. **Cero datos inventados.**
5. **Lo mínimo que funciona**, salvo en reservas, seguridad y accesibilidad.

## Accessibility & Inclusion
WCAG 2.2 AA. En el panel: texto ≥ 18 px, toques ≥ 48 px, estado con color + ícono + palabra (daltonismo), confirmación antes de acciones irreversibles. Pensado para la vista y las manos de una persona mayor y para usar con una mano. Web: `prefers-reduced-motion` respetado. El aviso "sin ascensor" va visible para quien lo necesite.
