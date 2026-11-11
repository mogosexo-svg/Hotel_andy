# Hotel Andy: propuesta de página web, reservas y control del hotel

> **Cómo usar este documento:** las secciones 1 a 8 son la presentación y están en lenguaje sencillo, sin palabras técnicas. La sección 9 son las preguntas para la reunión y la sección 10 es solo para nosotros (costos, márgenes y el truco de precios).

---

### 1. Lo que hoy le complica al hotel

| Problema | Lo que pasa en el día a día |
| :--- | :--- |
| 🔴 **La página se cae a cada rato** | El cliente entra, no carga y se va a otro hotel |
| 🔴 **Hay que confirmar con otra persona** | Para saber si hay un cuarto libre o limpio hay que llamar o escribir a alguien |
| 🔴 **Se acaban las cosas sin aviso** | Un día no hay papel, jabón o toallas limpias, y se nota cuando el huésped ya está en el cuarto |
| 🔴 **Cuartos sin limpiar a tiempo** | El huésped sale y nadie avisa; el siguiente llega y el cuarto no está listo |
| 🔴 **Riesgo de reservas cruzadas** | Si las reservas llegan por varios lados, dos personas pueden quedarse con el mismo cuarto |
| 🔴 **No aparece primero en Google** | Quien busca "hotel en Atacames" ve primero a otros hoteles, aunque el Hotel Andy tiene mejor calificación (8,7) |
| 🟡 **Huéspedes contentos que no lo cuentan** | La calificación es excelente, pero muchos se van felices sin dejar reseña |

---

### 2. ⭐ El panel de control del hotel: cuartos e insumos en un solo lugar

Esta es la pieza central. Una sola pantalla, en el celular o la computadora, donde la dueña ve todo lo que pasa en el hotel sin tener que preguntar a nadie.

#### 🛏️ Control de cuartos

| Color | Significa |
| :--- | :--- |
| 🟢 **Verde** | Libre y limpio, listo para vender |
| 🔴 **Rojo** | Ocupado |
| 🟠 **Naranja** | El huésped ya salió: hay que limpiar |
| 🟡 **Amarillo** | Limpiando ahora |
| ⚫ **Gris** | En mantenimiento (A/C dañado, ducha, etc.) |

**Lo que pasa solo, sin que nadie tenga que acordarse:**
1. **El huésped sale (check-out)** → el cuarto pasa a 🟠 y llega un aviso por WhatsApp a la persona de limpieza: *"Cuarto 204 desocupado, por favor limpiar."*
2. **La camarera termina y toca "Listo" en su celular** → el cuarto pasa a 🟢 y se puede vender.
3. **Si alguien llega en 2 horas y su cuarto no está limpio** → aviso a recepción y a la dueña: *"Atención: la familia Pérez llega a las 14:00 y el cuarto 105 sigue sin limpiar."*
4. **Si algo se daña**, se reporta con una foto y el cuarto queda bloqueado hasta que se arregle. Así nadie lo vende por error.

#### 🧴 Control de insumos

Todo lo que el hotel usa y se acaba: papel higiénico, jabones, shampoo, toallas, sábanas, productos de limpieza, cloro de la piscina, agua, bebidas, etc.

* **Se ve cuánto queda de cada cosa** en una lista sencilla.
* **Se descuenta solo:** cada vez que se limpia un cuarto, el sistema resta lo que se usa (por ejemplo, 2 rollos de papel, 2 jabones y 1 juego de toallas).
* **Aviso antes de que se acabe:** cuando algo baja del mínimo, llega un WhatsApp: *"⚠️ Quedan 10 rollos de papel higiénico (alcanza para unos 5 cuartos). Hay que comprar."*
* **Antes de un feriado**, el sistema avisa si con lo que hay no alcanza para la ocupación esperada: *"Para el feriado tienen 18 cuartos reservados. Faltan 30 jabones y 12 juegos de sábanas."*
* **Lista de compras automática** con lo que falta, lista para mandar al proveedor.

#### 👉 Por qué importa
* Nunca más un huésped en un cuarto sin papel o sin toallas. Eso es lo que baja las reseñas.
* Ningún cuarto se queda sin limpiar porque "nadie avisó".
* La dueña controla el hotel desde su celular, esté donde esté.
* Se gasta mejor: se ve cuánto se consume por mes y se evitan compras de emergencia, que salen más caras.

---

### 3. Reservas a prueba de errores

Una reserva nunca se pierde y un cuarto nunca se vende dos veces.

* **Un solo calendario para todo.** Las reservas de WhatsApp, teléfono, Booking, Airbnb y las de quienes llegan sin reservar quedan en el mismo lugar.
* **El cuarto se aparta al instante** en cuanto se anota la reserva.
* **El sistema no deja cruzar reservas.** Si alguien intenta dar un cuarto ya ocupado esas fechas, no lo permite.
* **Todo queda anotado:** quién reservó, quién cambió algo y cuándo.
* **Copia de seguridad todos los días.**
* **Confirmación automática al huésped** por WhatsApp, con fechas, cuarto y precio.

#### 🛡️ Una página que no se cae: cómo lo logramos

**Por qué se cae hoy:** casi siempre es porque la página está en un solo servidor barato y compartido con cientos de páginas más. Si ese servidor se satura o se apaga, la página desaparece.

**Lo que haremos nosotros:**

| Qué usamos | Qué hace, en palabras simples |
| :--- | :--- |
| ☁️ **Cloudflare (la página)** | Guarda copias de la página en cientos de centros de datos en todo el mundo. Si uno falla, responde otro al instante, y el cliente ni se entera. Además protege contra ataques y hace que la página cargue rápido, incluso con mala señal en la playa. |
| 🗄️ **Supabase (reservas, cuartos e insumos)** | Es la "libreta digital" del hotel: una base de datos profesional en la nube, con copias de seguridad todos los días. |
| 👀 **Vigilancia automática 24/7 (UptimeRobot)** | Un robot revisa la página cada 5 minutos. Si algo falla, nos avisa a nosotros por WhatsApp y correo, no al hotel, y lo arreglamos. |
| 🔒 **Candado de seguridad (HTTPS)** | Conexión segura y gratuita: el navegador muestra la página como "segura" y Google la posiciona mejor. |

**Además:**
* La parte pública de la página (fotos, cuartos, ubicación, botón de WhatsApp) sigue visible aunque el sistema interno esté en mantenimiento. El cliente nunca ve una página en blanco.
* El dominio queda a nombre del hotel (por ejemplo `hotelandyatacames.com`). La página es suya, no de un portal.
* El mantenimiento mensual incluye la vigilancia, las copias de seguridad, las actualizaciones y el soporte. El hotel no tiene que preocuparse de nada técnico.

---

### 4. Que el huésped viva una experiencia

* **Atención por WhatsApp las 24 horas.** Un asistente automático contesta al instante: *"¿tienen cuarto para 4 este sábado?"*, *"¿cuánto cuesta?"*, *"¿la piscina está abierta?"*, aunque sean las 2 de la mañana.
* **Mensajes de bienvenida.** Antes de llegar, el huésped recibe la ubicación y la hora de entrada, y al salir, un "gracias por visitarnos".
* **Reseñas con un toque (NFC).** Ver la sección 6.

---

### 5. Crecer también en Airbnb: una gran oportunidad

**Lo que ya tiene:** su perfil en Booking está súper bien, con 8,7 de calificación y más de 230 reseñas. Eso demuestra que el hotel atiende muy bien. Lo mantenemos tal cual.

**La oportunidad:** llevar esa misma calidad a Airbnb, una de las plataformas de viaje más usadas del mundo. Allí hay otro público que hoy no está viendo al hotel: familias y grupos que buscan experiencias, como piscina, playa y descanso. Es exactamente lo que ofrece el Hotel Andy.

#### 💵 La comisión de Airbnb, con total claridad

Según la información oficial de Airbnb Ecuador (2026):
* Airbnb cobra una **tarifa única del 15,5 %**, que paga el anfitrión.
* Se aplica al precio por noche y a tarifas extra (limpieza, mascotas).
* Se descuenta del pago: el hotel recibe el precio menos el 15,5 %.
* **No hay mensualidad ni inscripción.** Si no llegan reservas, no se paga nada.
* La comisión incluye el cobro al huésped, la publicidad del anuncio y atención al cliente 24/7.

**En números, con un cuarto de $46 la noche:**

| Concepto | Monto |
| :--- | :--- |
| Precio que paga el huésped | $46,00 |
| Comisión de Airbnb (15,5 %) | − $7,13 |
| **Lo que recibe el hotel** | **$38,87 por noche** |

#### Por qué vale la pena aunque haya comisión
* **Son clientes nuevos:** personas que hoy no encuentran al hotel porque buscan en Airbnb y no en Booking.
* **Un cuarto vacío gana $0.** Ese mismo cuarto vendido en Airbnb deja casi $39.
* Airbnb hace la publicidad por el hotel ante millones de viajeros.
* Con la buena calificación que ya tiene, es muy probable que lleguen muchos más huéspedes, sobre todo entre semana y en temporada baja, cuando hay más cuartos vacíos.

| Si Airbnb trae al mes… | Ingreso extra para el hotel (ya descontada la comisión) |
| :--- | :--- |
| 3 huéspedes (2 noches cada uno) | **~$233** |
| 5 huéspedes | **~$389** |
| 10 huéspedes (temporada alta) | **~$777** |

👉 **Con solo 3 huéspedes de 2 noches, el plan Completo ($200) queda pagado en el primer mes.**

**Lo que hacemos nosotros:** creamos y decoramos el perfil en Airbnb y lo conectamos al panel, para que sus reservas aparezcan solas y aparten el cuarto, igual que las de Booking.

---

### 6. Reseñas con un toque: el empujón que falta

**Lo que sabemos:** los huéspedes del Hotel Andy dejan muy buenas reseñas. Eso significa que están contentos con el servicio. El problema no es la calidad, sino que dejar una reseña da pereza.

**La solución:** el empujón y la facilidad. El huésped acerca su celular a una placa bonita y se abre directo la página para calificar. Funciona como pagar acercando la tarjeta, sin descargar nada.

| Lugar | Mensaje |
| :--- | :--- |
| 🏊 **Junto a la piscina** (placa con diseño de olas) | *"¿Disfrutando la piscina? Toca aquí y cuéntale al mundo 🌴"* |
| 📸 **Rincón de fotos** ("Hotel Andy · Atacames") | *"Comparte tu foto y tu experiencia"* |
| 🛏️ **En cada habitación** (tarjeta tipo postal) | *"Gracias por elegirnos. ¿Cómo estuvo tu descanso?"* |
| 🔑 **Al salir** (llavero de recuerdo con chip, de regalo) | *"Llévate un pedacito de Atacames"* |

**Más reseñas = más visibilidad en Google, Booking, Airbnb y la Inteligencia Artificial.**
*(⚠️ No se regala nada a cambio de la reseña, porque Google y Airbnb lo prohíben. El llavero se regala a todos).*

---

### 7. Salir primero en Google y en la Inteligencia Artificial

1. **Página propia** (por ejemplo `hotelandyatacames.com`) con las palabras que busca la gente: hotel en Atacames, con piscina, cerca de la playa, para familias.
2. **Ficha de Google Maps completa y cuidada:** fotos, horarios, WhatsApp y respuestas a las reseñas.
3. **Mismos datos en todos lados** (Google, Booking, Airbnb, TripAdvisor, Facebook). Google y la IA confían más cuando todo coincide.
4. **Preparada para ChatGPT, Gemini y Google**, para que entiendan qué es el hotel y lo recomienden.
5. **Preguntas frecuentes en la página**, que la IA usa para responder.

*Honestidad: nadie puede garantizar el puesto #1, pero con estos pasos y su calificación de 8,7 el hotel queda muy bien posicionado en Atacames.*

---

### 8. Los planes

| Funcionalidad / Característica | Esencial | Completo ⭐ Recomendado | Premium |
| :--- | :---: | :---: | :---: |
| Página web propia que no se cae | ✅ | ✅ | ✅ |
| Panel de cuartos (libre, ocupado, por limpiar) | ✅ | ✅ | ✅ |
| Reservas a prueba de errores | ✅ | ✅ | ✅ |
| Control de insumos automático (se descuenta solo con cada limpieza) | ✅ | ✅ | ✅ |
| Aviso por WhatsApp: "cuarto desocupado, a limpiar" | — | ✅ | ✅ |
| Aviso por WhatsApp: "se está acabando un insumo" | — | ✅ | ✅ |
| Aviso si un huésped llega y su cuarto no está listo | — | ✅ | ✅ |
| Asistente de WhatsApp 24 horas para huéspedes | — | ✅ | ✅ |
| Perfil en Airbnb (creado y conectado) | — | ✅ | ✅ |
| Placas NFC para reseñas | — | ✅ 2 placas | ✅ 5 placas |
| Aparecer en Google y en la IA | Básico | ✅ Completo | ✅ Completo |
| Lista de compras automática + previsión para feriados | — | — | ✅ |
| Reporte mensual de gastos en insumos | — | — | ✅ |
| Resumen diario a la dueña (ocupación, dinero, pendientes) | — | — | ✅ |
| Lista de espera en feriados | — | — | ✅ |
| Mensajes a clientes anteriores ("¡Vuelve en Carnaval!") | — | — | ✅ |
| Sesión de fotos profesional | — | 📸 Opcional | ✅ Incluida |
| **Pago único** | **$150** | **$200** | **$500** |
| **Mantenimiento mensual** (hosting, vigilancia, copias, soporte) | **$15** | **$20** | **$20** |
| **Tiempo de entrega** | **2 semanas** | **3 semanas** | **4 semanas** |

*📸 **Opcional para el plan Completo:** sesión de fotos profesional (piscina, cuartos, playa). Precio según cotización.*

#### 💬 Cómo presentarlo (guion)
> *"Por solo $50 más que el Esencial, el Completo le avisa solo por WhatsApp cuando hay que limpiar un cuarto o cuando se está acabando algo, atiende a los clientes de noche, lo pone en Airbnb y le instala las placas para reseñas. Con 3 huéspedes que lleguen por Airbnb, ya lo pagó."*

**Tiempo de desarrollo:** Esencial en 2 semanas, Completo en 3 y Premium en 4, contadas desde que tengamos las fotos, los datos de los cuartos y la lista de insumos.

---

### 9. ❓ Preguntas para la reunión

Llévalas impresas y anota las respuestas. Con ellas armamos el sistema a la medida.

#### 🏨 El hotel
1. ¿Cuántas habitaciones tienen? ¿De qué tipos (doble, triple, familiar, suite)? ¿Cuántas de cada una?
2. ¿Cuánto cobran por noche en temporada alta y en temporada baja? ¿Cobran distinto los fines de semana o feriados?
3. ¿Cobran aparte por niños, persona extra, mascotas o parqueo?
4. ¿A qué hora es la entrada y la salida? ¿Permiten salir más tarde o entrar más temprano? ¿Cobran por eso?
5. ¿Ofrecen desayuno, comida o bar? ¿Está incluido o se cobra aparte?

#### 📅 Reservas
1. ¿Cómo llegan hoy las reservas? (Booking, teléfono, WhatsApp, gente que llega sin reservar.) ¿Cuál es la que más llega?
2. ¿Quién confirma hoy si hay un cuarto libre? ¿Por qué hay que preguntarle a esa persona?
3. ¿Les ha pasado vender un cuarto dos veces? ¿Cuándo?
4. ¿Piden anticipo para reservar? ¿Cuánto? ¿Cómo lo reciben (transferencia, efectivo, Deuna)?
5. ¿Qué pasa si alguien cancela? ¿Devuelven el dinero?
6. ¿Qué datos le piden al huésped al llegar (cédula, teléfono, procedencia)?

#### 🧹 Limpieza y cuartos
1. ¿Cuántas personas hacen limpieza? ¿En qué horarios?
2. Hoy, ¿cómo se enteran de que un cuarto se desocupó y hay que limpiarlo?
3. ¿Quién revisa que el cuarto quedó bien antes de dar la llave?
4. ¿Cada cuánto cambian sábanas y toallas a un huésped que se queda varios días?
5. ¿Las camareras tienen celular con WhatsApp?
6. ¿Quién arregla las cosas cuando se dañan (A/C, ducha, TV)?

#### 🧴 Insumos
1. ¿Qué cosas compran regularmente para los cuartos? (Papel, jabón, shampoo, agua, productos de limpieza, cloro de piscina…)
2. ¿Qué se pone en cada cuarto al limpiarlo? (Por ejemplo, 2 jabones, 2 rollos de papel, 2 toallas.)
3. ¿Quién compra y cada cuánto? ¿A qué proveedor? ¿Le piden por WhatsApp?
4. ¿Se les ha acabado algo con huéspedes en el hotel? ¿Qué fue?
5. ¿Tienen bodega? ¿Quién la controla?
6. ¿Lavan las sábanas y toallas en el hotel o las mandan a lavar? ¿Cuántos juegos tienen por cuarto?
7. ¿Tienen minibar o venden bebidas o snacks? ¿Quieren controlar eso también?

#### 👥 Quién usará el sistema
1. ¿Quién va a usar el panel? (Usted, recepción, limpieza.) ¿Qué debe poder ver cada uno?
2. ¿Usted usa más el celular o la computadora?
3. ¿Quiere recibir un resumen diario por WhatsApp? ¿A qué hora?

#### 🌐 Internet y presencia
1. ¿Quién les hizo la página actual y quién la paga? (Para saber por qué se cae.)
2. ¿Tienen un WhatsApp del hotel o usan el número personal?
3. ¿La ficha de Google Maps está a su nombre? ¿Saben la contraseña?
4. ¿Han intentado Airbnb alguna vez?
5. ¿Tienen Facebook o Instagram del hotel? ¿Quién lo maneja?

#### 💡 Lo que ella quiere
1. Si pudiera arreglar una sola cosa del hotel mañana, ¿cuál sería?
2. ¿Qué es lo que más le quita tiempo o le da dolores de cabeza en un feriado lleno?
3. ¿Hay algo que le gustaría que el sistema hiciera y que no le mencioné? (Por ejemplo, tours, transporte, control del restaurante o de los empleados.)
4. ¿Para cuándo lo necesita? ¿Antes de algún feriado?
5. ¿Quién más tiene que aprobar la decisión?

---

### 10. 🔒 Solo para nosotros (NO mostrar)

#### El truco de precios (efecto señuelo)
* **Esencial ($150) es el señuelo.** Tiene el panel y los insumos automáticos, pero sin los avisos por WhatsApp, ni Airbnb, ni NFC. Por solo $50 más y $5 más al mes, el Completo lo tiene todo, así que la decisión es obvia.
* **Premium ($500) es el ancla.** Cuesta 2,5 veces más, con la misma mensualidad que el Completo. Hace que $200 parezca razonable.
* Hay que señalar siempre la columna del medio.
* En la demo, mostrar en vivo el aviso de WhatsApp *"Cuarto 204 desocupado, a limpiar"* o *"Quedan 10 rollos de papel"*. Eso vende solo.

#### Airbnb
* Fuente oficial: Airbnb Ecuador – tarifas por servicio: 15,5 % único al anfitrión (16 % en Brasil y México).
* No vender Airbnb como "más barato que Booking", porque cobran parecido. El argumento es: clientes nuevos, sin costo fijo, y Airbnb hace la publicidad.
* Los $46 por noche son un estimado de Momondo. Hay que preguntar la tarifa real y recalcular: `hotel recibe = tarifa × 0,845`.
* Revisar el IVA: Airbnb tiene un artículo aparte sobre IVA en Ecuador (artículo 436). Hay que verificar si los precios se publican con IVA incluido.

#### Fotógrafo (opcional)
* Cotizar con 2 o 3 fotógrafos de Atacames ($80–120 por 2–3 h), revender con margen ($150) y pedir portafolio.

#### Costos aproximados del plan Completo

| Concepto | Costo nuestro |
| :--- | :--- |
| **2 placas NFC** | ~$6–12 |
| **Dominio .com (anual)** | ~$15 |
| **Hosting (Cloudflare Pages)** | $0, el plan gratis permite uso comercial |
| **Base de datos (Supabase)** | $0 al inicio en el plan gratis; $25/mes en el plan Pro cuando tengamos 2–3 hoteles (repartido entre todos) |
| **Monitoreo (UptimeRobot)** | $0 en el plan gratis (revisa cada 5 min) |
| **WhatsApp (API oficial de Meta)** | Los avisos internos (limpieza e insumos) son mensajes de plantilla y cuestan centavos cada uno; las respuestas a huéspedes que escriben primero son gratis |
| **Margen** | **~$170 + $20/mes recurrente** (Esencial: ~$135 + $15/mes) |

*El negocio está en la mensualidad. Primer cliente = caso de éxito. Hay que pedir un testimonio en video.*

#### Cómo construirlo (técnico)
* **Reservas robustas:**
  * Postgres (Supabase) con `EXCLUDE USING gist` sobre cuarto + rango de fechas, para que la base de datos rechace reservas solapadas.
  * Pre-reservas con vencimiento.
  * Registro de auditoría y respaldos diarios.
* **Estados del cuarto como máquina de estados:** `libre` → `ocupado` → `por_limpiar` → `limpiando` → `libre` y `mantenimiento`. El check-out dispara el aviso de WhatsApp a limpieza.
* **Insumos:**
  * Tabla de productos con `stock`, `stock_minimo` y `unidad`.
  * Tabla "kit por tipo de cuarto" (lo que se consume en cada limpieza), descontado al marcar "Listo".
  * Disparador (trigger) en la base de datos o Edge Function que, al bajar del mínimo, envía la plantilla de WhatsApp.
  * Previsión: `reservas futuras × kit por cuarto − stock actual = faltante`.
* **Aviso de cuarto no listo:** tarea programada (cron) cada 15 min que cruza llegadas próximas con cuartos en estado distinto de `libre`.
* **Sincronización con Booking y Airbnb por iCal:**
  * Ellos leen nuestro calendario con retraso (puede tardar horas). En feriados, cerrar con anticipación algunos cuartos para la venta directa.
  * Si crece, un channel manager (p. ej., Channex).
* **Hosting: por qué Cloudflare y no Vercel.** El plan gratis de Vercel (Hobby) prohíbe el uso comercial, y el Pro cuesta $20/mes por usuario, lo que se come toda la mensualidad. Cloudflare Pages es gratis, permite uso comercial y tiene ancho de banda ilimitado, red global (CDN) y protección DDoS incluida. El frontend va en Next.js o Astro.
* La landing es estática (HTML pre-generado en la CDN), así que aunque Supabase tenga un problema, la página pública sigue arriba. Solo el panel y la disponibilidad dependen de la base de datos.
* **Supabase gratis, con cuidado:**
  * Pausa los proyectos tras 7 días sin actividad. Con uso diario no pasa, pero conviene un ping diario como seguro.
  * No incluye respaldos automáticos. Hay que hacer un `pg_dump` diario con GitHub Actions hacia Cloudflare R2 (gratis hasta 10 GB).
  * Diseñar el sistema multi-hotel desde el inicio (columna `hotel_id` + RLS), para meter varios clientes en un mismo proyecto y pasar a Pro ($25/mes) cuando haya 2–3 hoteles.
* **DNS en Cloudflare (gratis)** y dominio a nombre del cliente. Nosotros lo administramos.
* **Monitoreo:** UptimeRobot cada 5 min sobre la landing y un endpoint `/health` del panel, con alertas a nuestro WhatsApp, Telegram y correo.
* **SEO y GEO (búsqueda con IA):** `schema.org/Hotel` + `FAQPage`, Google Business, Bing Places y un archivo `llms.txt`.
* **NFC:** stickers NTAG213 con el link corto de reseña de Google.