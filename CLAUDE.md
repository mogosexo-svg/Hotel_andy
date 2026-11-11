# Hotel Andy · Instrucciones para el agente

Web, reservas y panel de control del **Hotel Andy** (Atacames, Ecuador). Primer cliente de **Soluciones Informáticas Mogolicous**: tiene que verse y funcionar como un producto profesional.

## Lee esto antes de hacer nada
| Archivo | Qué es |
|---|---|
| `docs/REQUERIMIENTOS.md` | **Fuente de verdad del alcance.** RF/RNF con IDs, arquitectura, plan de 3 semanas, pendientes del cliente. |
| `PRODUCT.md` | Contexto de producto para impeccable y hallmark (usuarios, marca, principios). |
| `data/hotel.json` | 23 cuartos, 7 tipos, precios, insumos, reglas. **Seed único**: nada de esto se escribe a mano en el código. |
| `data/hotel.private.json` | Cuenta bancaria de la dueña. Gitignored. Solo va a la tabla `config` (RLS). Nunca a la web, `llms.txt`, schema.org ni logs. |
| `docs/propuesta-hotel-andy.md` | Lo que se le vendió (planes E/C/P, guion, costos). § 10 es interno. |
| `docs/mensajes-recepcionista-2026-11-10.md` | Lógica de negocio del recepcionista: facturas, alertas de stock, venta de bebidas, precio de Booking. |
| `docs/DEATH_NOTE.md` | Qué hace cada skill instalada. |

**El panel tiene que ser increíble**: lee el "Listón de calidad del panel" en `docs/REQUERIMIENTOS.md` § B antes de diseñar una sola pantalla. Es la pieza que vende.
**Sección E aprobada**: CRUD de productos y categorías, consumos y cuadre del día (RF-60 a RF-64). Un solo inventario por categorías.

Campos `_verificar` en `data/hotel.json` = dudas abiertas con el cliente. Construye con el valor que hay y deja el campo configurable; **no los inventes ni los bloquees**.

---

## 🎬 Modo director (sesión principal en Fable 5.2)

La sesión principal **dirige, no programa**. Fable es caro: úsalo para decidir, repartir, revisar e integrar. Todo lo demás va a subagentes con la herramienta `Agent` y el parámetro `model`.

### A quién se le da cada trabajo
| Modelo | Cuándo | Ejemplos |
|---|---|---|
| **fable** (tú, director) | Solo lo estrictamente necesario: decisiones con trade-offs, elegir el tema visual con las fotos, resolver conflictos entre subagentes, revisión final antes de una demo. | Elegir el tema de hallmark; aprobar el esquema de base de datos; dar el visto bueno a cada semana. |
| **opus** | Lógica difícil donde un error cuesta caro. | Migraciones con EXCLUDE, máquina de estados y triggers de insumos; RLS multi-hotel; revisión de seguridad (`security-reviewer`); el bot con herramientas. |
| **sonnet** (por defecto) | Implementación normal. | Componentes del panel, páginas de la web, Edge Functions, plantillas de WhatsApp, iCal, tests. |
| **haiku** | Mecánico y acotado. | Seed desde `data/hotel.json`, textos alternativos, FAQ, `llms.txt`, schema.org, configs, renombrar y optimizar fotos, checklists. |
| **Explore** (subagente) | Buscar en el código sin llenar tu contexto. | "¿Dónde se calcula el precio por temporada?" |

### Reglas de orquestación
1. **Primero el contrato.** La semana 1 empieza con el esquema SQL + tipos generados (`supabase gen types`). Web, panel y automatizaciones dependen de él. Nada corre en paralelo antes de que esté aprobado.
2. **Después, en paralelo** con `isolation: "worktree"` y un frente por agente: **A** base de datos/RPC · **B** web pública · **C** panel · **D** automatizaciones (WhatsApp, cron, iCal, NFC). Lanza los independientes en el mismo mensaje.
3. **Cada encargo a un subagente** lleva:
   - los archivos a leer: `CLAUDE.md`, `docs/REQUERIMIENTOS.md` y el que toque;
   - los **IDs de RF/RNF** que cubre;
   - el criterio de terminado (abajo);
   - el formato de respuesta: *qué cambió (archivos), qué se probó y su salida, qué quedó pendiente*, en menos de 15 líneas.
4. **No repitas el trabajo de un subagente.** Revisa su diff y su reporte. Si falla, devuélvelo con el error concreto (`SendMessage` al mismo agente), no lo rehagas tú.
5. Antes de cada demo semanal: `/verify`, `/ponytail-review` y la revisión visual (ver skills). Revisión de seguridad con opus antes de producción.

### Criterio de terminado (todo encargo)
- Cumple los criterios de aceptación de sus RF.
- La lógica crítica tiene test: reservas, estados, insumos, RLS, precios.
- La UI se miró en 390 px y 1440 px (Playwright, screenshot).
- Sin `console.log`, sin secretos y sin datos inventados.

---

## 🧰 Skills: cuál, cuándo y quién
| Fase | Skill / comando | Nota |
|---|---|---|
| Arranque de cada frente | `/plan` (everything-claude-code) | Espera aprobación del director antes de tocar código. |
| Base de datos y lógica crítica | `/tdd` | Primero los tests: solapamiento, transiciones, descuento de insumos, RLS entre hoteles. |
| **Web pública** | **hallmark** (`/hallmark ...`) | Construye la web *desde su trabajo*: un hotel → reservar. Candidato fuerte: **tema `refract`** (piscina, hotel, agua con luz animada). La elección final la hace el director **con las fotos reales delante**. Sin fotos, se construye todo menos el hero. |
| **Panel** | **impeccable** (`/impeccable shape`, modo *Operate*) | Precisión y calma, no fuegos artificiales. Después `/impeccable polish` y `animate`. `PRODUCT.md` ya existe: no repetir `init`. |
| Segunda opinión cruzada | `/impeccable critique` sobre la web · `/hallmark audit` sobre el panel | **Nunca** dos skills de diseño construyendo la misma pantalla. |
| Linters visuales | `node ~/.claude/skills/hallmark/scripts/sloplint.mjs <archivo> --render` (web) · `~/.claude/skills/impeccable/scripts/impeccable detect --json <archivos>` (panel) | Una vez al terminar, no durante. |
| Todo el código | **ponytail** (siempre activo) | Nivel `full`. En reservas/RLS/seguridad manda `/tdd`: ponytail nunca recorta validación, seguridad ni accesibilidad. |
| Bot de WhatsApp | skill `claude-api` | Leerla antes de escribir el bot. Modelo: Haiku más reciente. |
| Cierre de cada día | `/checkpoint` · `/ponytail-debt` | Lista los `shortcut:` pendientes. |
| Antes de producción | `/ponytail-audit` · agente `security-reviewer` (opus) | |

## ⚠️ Hooks activos (everything-claude-code)
- **`pnpm dev` / `npm run dev` se bloquea fuera de tmux.** Usa `tmux new -d -s dev "pnpm dev"` y `tmux capture-pane -pt dev` para leer los logs.
- **Write no puede crear `.md` nuevos** (salvo README/CLAUDE/AGENTS/CONTRIBUTING). Créalos con Bash (`cat > archivo.md <<'EOF'`). Editar los existentes sí funciona.
- Prettier y `tsc` corren solos al editar `.ts/.tsx/.js`.
- Gestor de paquetes: **pnpm**.

## Stack y convenciones
- **Astro** (última estable) en **Cloudflare Pages**. La web es estática; `/panel` usa islas React con `supabase-js` (Auth, Realtime, RPC).
- **Supabase**: Postgres, RLS, Realtime, Storage (fotos de comprobantes y daños), Edge Functions (webhook de WhatsApp, bot, iCal, `/r/` NFC) y `pg_cron`.
- Migraciones en `supabase/migrations/`, numeradas. Las reglas de negocio viven en SQL (EXCLUDE, CHECK, triggers, RPC), no solo en la pantalla.
- Todas las tablas llevan `hotel_id` + RLS desde el día 1.
- TypeScript estricto. Fechas en `America/Guayaquil`. Dinero en centavos (`integer`).
- Textos de UI en español de Ecuador. En el panel, palabras de la dueña: "Libre", "Ocupado", "Por limpiar", "Limpiando", "En arreglo", "Listo", "Se está acabando".
- Colores de estado (siempre con ícono + palabra): 🟢 libre · 🔴 ocupado · 🟠 por limpiar · 🟡 limpiando · ⚫ mantenimiento.
- Animaciones: solo `transform`/`opacity`, 150–400 ms, siempre con `prefers-reduced-motion`.
- Secretos en `.env` (gitignored) y en los secretos de Supabase. `.env.example` sí va al repo.

## Si el contenedor es nuevo
Las skills y plugins viven en `~/.claude`, fuera del repo. Si `/hallmark` o `/impeccable` no existen, reinstalar según `docs/DEATH_NOTE.md`. Para que sloplint pueda abrir el navegador: `npm i -g puppeteer-core` y `ln -sf /opt/pw-browsers/chromium /usr/bin/chromium`.
