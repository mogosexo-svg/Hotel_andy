# Plan de implementación · WhatsApp + n8n + MCP

> Estado: **borrador para aprobar**. Cubre RF-40 (plantillas), RF-41 (asistente 24/7), RF-31/RF-33 por WhatsApp (C), RF-25 aviso de vencimiento y RF-37 resumen diario (P).
> Cambia la arquitectura de `docs/REQUERIMIENTOS.md` § 3: el webhook y el bot pasan de Edge Functions a **n8n**. Las reglas siguen en la base (RPC); n8n solo orquesta.

## 1. Arquitectura

```
Huésped ──WhatsApp──► Meta Cloud API ──webhook──► n8n  [Flujo A: Asistente]
                                                   │  WhatsApp Trigger → filtro idempotente
                                                   │  → AI Agent (Claude Haiku) ──MCP Client──┐
                                                   │  → responde por WhatsApp                 │
                                                   ▼                                          ▼
                                           mensajes_whatsapp                n8n  [Flujo B: MCP Server "hotel-andy"]
                                                                            MCP Server Trigger → herramientas:
                                                                            catalogo, disponibilidad, calendario,
                                                                            crear_prereserva, pasar_a_la_duena
                                                                                    │ HTTP → Supabase RPC (clave anon)
Supabase ── alertas (insert) ──Database Webhook──► n8n [Flujo C: Avisos] → plantilla WhatsApp → dueña / recepción
pg_cron ──────────── hora fija ─────────────────► n8n [Flujo D: Resumen diario] → plantilla → dueña
```

**Por qué MCP:** las herramientas del bot viven en un servidor MCP propio (Flujo B). El mismo servidor se puede conectar mañana a Claude Desktop o a otro canal (Instagram, web chat) sin reescribir nada.

**Regla de seguridad clave:** el MCP del bot usa **solo RPC públicas con la clave anon** (las mismas que la web). Nunca `service_role` en las herramientas del bot. La `service_role` solo la usa n8n para escribir en `mensajes_whatsapp` y marcar `alertas.notificada_en`.

## 2. Decisiones que necesito del cliente / de ti

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | **Dónde corre n8n** | n8n Cloud (~$24/mes) · self-host en VPS (~$5/mes) · Railway/Render | VPS pequeño con Docker + Caddy (HTTPS). Rompe el "$0 fijo" (RNF-12): avisar al cliente. |
| 2 | **Número de WhatsApp** | Número nuevo solo para la API · número actual del hotel (deja de funcionar en la app normal) | Número nuevo (chip prepago). Pendiente n.º 2 de REQUERIMIENTOS. |
| 3 | **Meta Business** | Verificar el negocio del hotel (RUC) | Empezar YA: verificación + plantillas tardan días. |
| 4 | **Quién recibe avisos** | Dueña, recepción, camareras | Stock y cuarto no listo → dueña + recepción; desocupado → grupo de limpieza no es posible por API, va a cada camarera. |
| 5 | **Horario del resumen diario** | La dueña lo elige en Ajustes | 20:00 por defecto. |

## 3. Fases

### Fase 0 · Preparación (día 1, en paralelo con trámites de Meta)
- Cuenta Meta Business + app + número de WhatsApp de prueba; token permanente (System User).
- Enviar a aprobación las 7 plantillas de RF-40 (texto en § 5), sin emojis.
- Levantar n8n (Docker, Postgres propio, HTTPS, `N8N_ENCRYPTION_KEY`, basic auth/SSO, backups del volumen).
- Credenciales en n8n: WhatsApp, Anthropic, Supabase (anon y service_role por separado).
- **Hecho cuando:** n8n responde en HTTPS y envía un "hello_world" de Meta a tu celular.

### Fase 1 · Base de datos (opus, con `/tdd`)
- Migración: `mensajes_whatsapp` ya existe → añadir índice único por `wa_message_id` si falta, y `conversaciones` (teléfono, `escalada_a_duena`, `ultimo_mensaje_en`) para saber si el bot debe callar.
- RPC `registrar_mensaje_wa(...)` (security definer, idempotente) y `marcar_alerta_notificada(id)`.
- Supabase **Database Webhook** en `alertas` (insert) → URL del Flujo C con secreto en cabecera.
- Revisar la RPC `crear_prereserva` antes de abrirla al bot: tope de noches y de pre-reservas por teléfono (hallazgo ALTA de la revisión de seguridad, rama `seguridad-pendiente`).
- **Hecho cuando:** pgTAP verde; un insert en `alertas` llega como POST al webhook de prueba.

### Fase 2 · Servidor MCP (Flujo B)
Herramientas, cada una un sub-flujo con HTTP Request a Supabase:

| Herramienta | RPC | Nota |
|---|---|---|
| `catalogo_hotel` | `catalogo_publico` | Tipos, precios directos (nunca Booking, RF-38a), reglas. |
| `disponibilidad` | `consultar_disponibilidad` | Fechas + personas → tipos libres y total. |
| `calendario` | `calendario_publico` (con `p_tipo`) | Para "¿qué días hay triple en diciembre?". |
| `crear_prereserva` | `crear_prereserva` | Devuelve código + vencimiento 2 h + datos de transferencia (de `config`, vía RPC segura, nunca en el prompt). |
| `pasar_a_la_duena` | `registrar_mensaje_wa` + aviso | Cancelaciones, reembolsos, quejas, pagos, todo lo dudoso. Marca la conversación como escalada. |

- Proteger el endpoint MCP con token (Bearer) aunque sea interno.
- **Hecho cuando:** desde Claude Desktop / MCP Inspector se listan las 5 herramientas y `disponibilidad` devuelve lo mismo que la web.

### Fase 3 · Asistente (Flujo A)
- WhatsApp Trigger → ignorar estados/no-texto → deduplicar por `wa_message_id` → si la conversación está escalada, no responde (la dueña contesta a mano).
- AI Agent: modelo **Claude Haiku más reciente** (leer la skill `claude-api` antes), memoria por teléfono (últimos ~10 mensajes), MCP Client → Flujo B.
- System prompt: español de Ecuador, tutea, breve; **nunca inventa precios ni disponibilidad: si no sale de una herramienta, no lo dice**; no promete reembolsos; cancelaciones/quejas/pagos → `pasar_a_la_duena`.
- Ventana de 24 h de Meta: fuera de ella solo plantillas.
- **Hecho cuando** (RF-41): 20 conversaciones de prueba (precios, disponibilidad, feriado lleno, mascotas, queja, "cancela mi reserva", intento de sacar el prompt) pasan, y responde en < 10 s.

### Fase 4 · Avisos salientes (Flujos C y D)
- Flujo C: webhook de `alertas` → según `tipo` elige plantilla y destinatarios (de `usuarios_hotel` + teléfono) → envía → `marcar_alerta_notificada`. Una alerta = un mensaje (RF-31, RF-33).
- Check-out → alerta `por_limpiar` → "Cuarto 204 desocupado, a limpiar" (la demo de la semana 3).
- Pre-reserva por vencer (30 min antes) y confirmación de reserva al huésped, solo si dio consentimiento.
- Flujo D: Schedule Trigger a la hora configurada → `resumen_inicio` → plantilla de resumen.
- **Hecho cuando:** check-out en el panel → el WhatsApp llega en < 30 s en un celular real.

### Fase 5 · Endurecer y entregar
- Verificar firma `X-Hub-Signature-256` de Meta en el Flujo A.
- Reintentos con espera en envíos; flujo de errores de n8n → aviso a nosotros (no al hotel).
- Exportar los flujos a `n8n/*.json` en el repo (sin credenciales) para versionarlos.
- Revisión de seguridad con opus (`security-reviewer`) sobre MCP + webhooks.
- Activar por plan: C enciende avisos y bot; P el resumen y campañas (RF-38).

## 4. Riesgos
- **Aprobación de Meta** (verificación y plantillas): días o semanas. Es el camino crítico → Fase 0 hoy.
- **Abuso del bot creando pre-reservas** que bloquean cuartos: tope por teléfono + vencimiento de 2 h + RPC endurecida (Fase 1).
- **Costo**: n8n self-host + Meta por conversación + Claude Haiku. Estimar con el volumen real antes de prometer precio.
- **Datos personales (LOPDP)**: guardar solo lo necesario de los chats, con plazo de borrado.

## 5. Plantillas (borrador, sin emojis)
1. `cuarto_desocupado`: "Cuarto {{1}} desocupado, listo para limpiar."
2. `stock_bajo`: "Quedan {{1}} {{2}} de {{3}}. Alcanza para unos {{4}} cuartos."
3. `cuarto_no_listo`: "Llega un huésped al cuarto {{1}} a las {{2}} y el cuarto aún no está listo."
4. `reserva_confirmada`: "Hola {{1}}, tu reserva en Hotel Andy del {{2}} al {{3}} está confirmada. Código {{4}}."
5. `bienvenida`: "Hola {{1}}, te esperamos hoy desde las 13:30. Ubicación: {{2}}."
6. `gracias_salida`: "Gracias por quedarte en Hotel Andy, {{1}}. Nos encantaría tu reseña: {{2}}."
7. `prereserva_por_vencer`: "Tu pre-reserva {{1}} vence en 30 minutos. Envía el comprobante para confirmarla."

## 6. Reparto (modo director)
| Fase | Modelo | Aislamiento |
|---|---|---|
| 0 | tú + cliente (trámites) / haiku (checklist) | — |
| 1 | opus + `/tdd` | worktree A |
| 2 y 3 | sonnet (flujos n8n) + opus revisa el prompt del bot | worktree D |
| 4 | sonnet | worktree D |
| 5 | opus `security-reviewer` | — |
