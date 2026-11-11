# Información para arrancar · Hotel Andy

Nov 10, 2026

## Datos del hotel
Corrija solo lo que no esté bien.

| Dato | Lo que tenemos | ¿Es correcto? |
| :--- | :--- | :--- |
| Hora de entrada (check-in) | 12:30 | 13:30 |
| Hora de salida (check-out) | 12:00 | 11:30 |
| Teléfono para huéspedes | +593 6276 0674 | si |
| Dominio de la página | hotelandyatacames.org | si |

---

## Habitaciones
Una fila por habitación. Es la única tabla que hay que llenar desde cero; con ella armamos el panel, el calendario y las respuestas del asistente de WhatsApp.

| Número | Tipo | Máx. personas | Precio por noche, temporada baja (USD) | Precio por noche, feriados y temporada alta (USD) |
| :--- | :--- | :--- | :--- | :--- |
| 101 | Ejemplo: cuadruple | 4 | 70 | 90 |
| 102 | Doble deluxe | 2 | 50 | 55 |
| 103 | Doble sencilla | 2 | 35 | 45 |
| 104 | Doble sencilla | 2 | 35 | 45 |
| 105 | Triple | 3 | 50 | 65 |
| 106 | Doble sencilla | 2 | 35 | 45 |
| 201 | Doble deluxe | 2 | 50 | 55 |
| 202 | Doble deluxe | 2 | 50 | 55 |
| 203 | Doble sencilla | 2 | 35 | 45 |
| 204 | Doble sencilla | 2 | 35 | 45 |
| 205 | Triple | 3 | 50 | 65 |
| 206 | Triple | 3 | 50 | 65 |
| 301 | Doble deluxe | 2 | 50 | 55 |
| 302 | Doble deluxe | 2 | 50 | 55 |
| 303 | Doble sencilla | 2 | 35 | 45 |
| 304 | Familiar | 5 | 85 | 110 |
| 305 | Triple | 3 | 50 | 65 |
| 401 | Triple deluxe | 3 | 60 | 70 |
| 402 | Doble deluxe | 2 | 50 | 55 |
| 403 | Doble sencilla | 2 | 35 | 45 |
| 404 | Familiar | 5 | 85 | 110 |
| 405 | Triple | 3 | 50 | 65 |
| 500 | suite | 7 | 130 | 160 |
| | | | | |
| | | | | |
| | | | | |

Tipos usados en Booking: doble, triple, cuádruple, familiar y suite. Si hay más habitaciones, agregue filas.

---

## Insumos
Ya pusimos las cantidades de un hotel típico. Corrija lo que se use distinto y anote cuánto hay hoy en bodega; con eso el sistema descuenta solo y avisa antes de que algo se acabe.

| Insumo | Se usa por cada limpieza | Avisar cuando queden | Hay hoy en bodega |
| :--- | :--- | :--- | :--- |
| Papel higiénico (rollos) | 2 | 12 | 350 |
| Jabón (unidades) | 2 | 10 | 120 |
| Shampoo (unidades) | 1 por persona | 10 | SE TRABAJA CON UN DISPENSADOR POR HABITACION |
| Toallas (juegos) | 1 por persona | 8 | |
| Sábanas (juegos) | 1 | 6 | |
| Agua de cortesía (botellas) | 2 | 12 | NO SE GENTIONAN AGUAS DE CORTESIA |
| Cloro de piscina (kg) | — (0,5 kg por día) | 4 | 4 |

¿Falta algo que se compre seguido? Agréguelo en una fila nueva.

---

## Reglas del hotel
El asistente de WhatsApp responde con estas reglas. Dejamos un valor recomendado; cambie solo lo que sea distinto.

| Regla | Valor recomendado | Su valor (si es distinto) |
| :--- | :--- | :--- |
| Anticipo para reservar | 50 % por transferencia | SI 50% DE ANTICIPO |
| Tiempo para pagar la prereserva | 2 horas; si no paga, el cuarto se libera | SI |
| Cancelación | Se devuelve el anticipo hasta 3 días antes | FLEXIMIBIDAD EN TEMAS DE CANCELACION NO TENEMOS UN TIEMPO ESTIMADO |
| Niños | Menores de 5 años no pagan | DEPENDE DEL TIPO DE HABITACION YA QUE LOS VALORES SON FIJOS |
| Mascotas | No se aceptan | SI SE APLICA CARGO ADICIONAL |
| Desayuno | No incluido | NO INCLUYE |
| Parqueadero | No disponible | SI DISPONEMOS DE PARQUEADERO (ASENSOR NO DISPONEMOS) |
| Horario de piscina | 08:00 a 20:00 | 08:00 A 01:00 |
| Cuenta para transferencias | — [EN data/hotel.private.json] | [Banco, tipo y número de cuenta] |