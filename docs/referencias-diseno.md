# Referencias de diseño · Hotel Andy

> **Método y límites (2026-11-11).** El contenedor no tiene salida web; se leyó con TinyFish `fetch_content`/`search` (21 lecturas). Solo se obtuvo **texto/markdown**: estructura, orden de secciones, CTA, textos de precio y prueba social. **No verificado (no se ve con texto):** tipografía, paleta, animaciones, parallax, peso de video, widget real en móvil. Nada de esto se copió; son notas propias.
> Marcas: **[O]** = observado en el contenido leído · **[D]** = derivado de `PRODUCT.md` / `REQUERIMIENTOS.md` § B.
> No se pudo leer: Stripe Dashboard y Airbnb Host (piden login), Mews PMS y Cloudbeds housekeeping (404), el hero de Rosewood Mayakoba (redirige a la home global), la web de Cielo Azul (solo devolvió el aviso de cookies; se usó su descripción meta).

## A. Webs de hoteles
| Sitio | URL | Qué se observó y vale |
|---|---|---|
| Six Senses Laamu | sixsenses.com/en/hotels-resorts/asia-the-pacific/maldives/laamu/ | [O] "Check availability" saca al usuario a otro dominio (aviso "You are leaving sixsenses.com"); botón "Play full video"; **comparador de hasta 3 habitaciones**; sin precios en la página; bloque de sostenibilidad y "Journal"; contacto con correo y teléfono al pie |
| Hotel Esencia (Tulum) | hotelesencia.com | [O] Prueba social por premios (Michelin Keys, Forbes, 50 Best) + ~30 citas de prensa en una sola columna; sin precios ni widget en el texto. Qué evitar: pared de citas |
| Nômade Tulum | nomadetulum.com | [O] "BOOK NOW" en cabecera, promo y pie (3+ veces); "VIEW ROOMS" como enlace secundario; promo con código y "hasta 35 % de ahorro" en temporada festiva; 4 canales de contacto (correo, 3 teléfonos); "virtual tour"; titulares duplicados en el contenido (posible efecto de texto, no verificado) |
| Azulik | azulik.com | [O] Home de manifiesto: titular con palabras en negrita/cursiva mezcladas, dos destinos como bloques con "Location" y "Discover more"; muy poca información práctica |
| Soneva Jani | soneva.com/resorts/soneva-jani/ | [O] Solo se leyó un párrafo evocador ("The Energyscape"); poca evidencia, no se usa para patrones |
| Rosewood (home global) | rosewoodhotels.com | [O] Home editorial (historias, destinos, "Reserve"), oferta puntual por hotel ("noche de cortesía"); no es de un solo hotel. Sin valor para una web de un hotel pequeño |
| La Brisa del Mar, Estepona (3★, no es LatAm) | labrisadelmarhotel.com | [O] **El análogo más cercano**: trío de confianza "Reserva sin comisiones / Mejor precio online / Reserva segura al instante"; lista corta de lo que incluye toda habitación; 4 tipos de cuarto con "Descubre más"; bloque práctico: check-in/out, mascotas, **ascensor**; "Reserva ahora" repetido; sin precios en la home |
| Royal Decameron Mompiche (Esmeraldas) | decameron.com/es/hoteles/mompiche/royal-decameron-mompiche/ | [O] Costa de Ecuador, 282 cuartos (no boutique). Tipos de cuarto con "hasta 4 personas" y equipamiento; **FAQ largo** (horarios, cédula/pasaporte, menores, mascotas); reservas de restaurante por QR sin app ni datos; teléfono + WhatsApp. Sin precios en el texto |
| Hotel Cielo Azul (Atacames) | hotelcieloazul.com | [O] Solo la descripción meta: "hotel familiar frente al mar, piscina, restaurante de mariscos, pet-friendly, Reserva tu estancia tropical hoy". Competidor directo de zona; revisar con captura cuando haya acceso |

Boutiques de LatAm con presupuesto modesto: **no se logró leer ninguna** (la búsqueda devolvió redes y agregadores). Pendiente.

## B. Referencias de panel
| Producto | URL | Qué se observó y vale |
|---|---|---|
| Linear | linear.app | [O] La home enseña **la interfaz real como ilustración** (feed de actividad, incidencias agrupadas por estado con contador: "Backlog 8 · Todo 71"); figuras numeradas "Fig 0.1"; cifra de prueba social ("50,000 equipos"); copy centrado en velocidad |
| Cloudbeds | cloudbeds.com/hotel-management-software/ | [O] Funciones que enumera: **calendario de reservas con arrastrar y soltar**, **housekeeping con estado de cuarto en tiempo real vía app móvil**, panel de control personalizable, canal manager "sin dobles reservas"; testimonios con nombre y cargo; cifras ("88 % menos de capacitación") |
| Little Hotelier | littlehotelier.com | [O] Pensado para propiedades pequeñas; "empieza el día viendo el calendario central y las operaciones diarias"; ver, modificar y cancelar **desde el mismo calendario**; app móvil; testimonios cortos de dueños con país; desde 39 USD/mes + 1 % |
| Mews | mews.com/en | [O] Solo texto genérico (PMS que conecta recepción, housekeeping, pagos); sin patrones de UI |

## C. 10 patrones para la web del Hotel Andy
1. **[O→D] Una confianza en 3 líneas junto al botón** (como La Brisa del Mar): "Sin comisiones · Mejor precio directo · Confirmas por WhatsApp". Aplica al plan de anticipo 50 %.
2. **[O→D] Bloque práctico visible: entrada 13:30, salida 11:30, mascotas, parqueadero y "sin ascensor"** (La Brisa y Decameron lo ponen en la home). Ya lo exige PRODUCT.md.
3. **[O→D] FAQ corto con lo que el huésped de Ecuador pregunta:** cédula o pasaporte, niños, mascotas con cargo, anticipo, pre-reserva de 2 h (Decameron lo hace largo; aquí 6 preguntas).
4. **[O→D] CTA repetido en 3 sitios** (cabecera, tras habitaciones, pie), como Nômade, pero siempre el mismo texto: "Reservar por WhatsApp".
5. **[O→D] Tarjetas por tipo de cuarto:** foto, "hasta N personas", camas, equipamiento, "desde $X por cuarto", piso. Si el precio sale de `data/hotel.json`, se muestra; el precio de Booking nunca.
6. **[O→D] Contacto en varios canales** (WhatsApp, teléfono, correo, mapa) porque la señal es irregular y Nômade/Six Senses lo hacen en el pie; WhatsApp primero.
7. **[O→D] Prueba social con una sola cifra real:** 8,7 en Booking con 238 reseñas y enlace. Nada de pared de citas (Esencia) ni testimonios inventados.
8. **[D] Hero ligero:** una foto real de piscina con el botón; sin video de fondo (Six Senses pone el video detrás de un botón "Play": opción válida si se agrega después). Imagen AVIF/WebP, `srcset`.
9. **[D] JS < 50 KB y animación solo `transform`/`opacity`:** aparición suave al entrar, brillo de agua sutil; todo apagado con `prefers-reduced-motion`. Galería con `scroll-snap` nativo.
10. **[D] Tono cálido de hotel familiar, no manifiesto:** Azulik y Soneva hablan en abstracto; el Hotel Andy dice qué hay (piscina hasta la 01:00, a pasos de la playa). Tipografía y paleta: decidirlas con las fotos reales delante (no verificable con texto).

## D. 10 patrones para el panel
1. **[O→D] Mostrar la interfaz como contenido de venta** (Linear): en la demo y en la propuesta, capturas del mapa de cuartos con datos reales.
2. **[O→D] Agrupar por estado con contador** (Linear: "Todo 71"): el mapa y las listas muestran "Por limpiar · 4", "Se está acabando · 3".
3. **[O→D] Calendario único donde se ve, mueve, edita y cancela sin cambiar de pantalla** (Little Hotelier, Cloudbeds arrastrar y soltar): RF-23.
4. **[O→D] Estado de cuarto en tiempo real en el celular de limpieza** (Cloudbeds): RF-21/27, con color + ícono + palabra.
5. **[O→D] "Empieza el día" en una pantalla:** llegadas, salidas, por limpiar (Little Hotelier): RF-36, números grandes, se entiende en 5 s.
6. **[D] Optimista + Deshacer** en vez de "¿está seguro?"; confirmar solo lo irreversible (anular factura, cancelar).
7. **[D] Skeletons y 4 estados por pantalla** (cargando, vacío con acción, error humano, datos).
8. **[D] Pulso de 300 ms al cambiar un cuarto por Realtime**, solo `transform`/`opacity`.
9. **[D] Ctrl+K y atajos solo en escritorio;** celular con botones ≥ 48 px, texto ≥ 18 px.
10. **[D] Barras de stock por color con frase:** "Quedan 10 rollos, alcanza para ~5 cuartos"; una alerta por cruce del mínimo.

## E. Qué evitar
- Motor de reserva en otro dominio que saca al huésped del sitio (Six Senses): aquí el cierre es WhatsApp, sin salto.
- Pared de premios o citas (Esencia); titulares abstractos sin datos prácticos (Azulik).
- Home sin precio ni "desde": ningún sitio leído mostraba precios en el texto; el Hotel Andy sí puede, es su ventaja frente a Booking.
- Video pesado y parallax de JS; tono de lujo frío o plantilla de cadena.
- Panel tipo plantilla de admin, tablas densas en móvil, spinners, color como único indicador.
