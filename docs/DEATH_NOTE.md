# 📓 DEATH NOTE: Skills

> **Regla I:** La skill cuyo nombre se escriba en este cuaderno será dominada por completo.
> **Regla II:** Solo se anotan las funcionalidades que de verdad sirven.
> **Regla III:** Cada nombre lleva su forma de invocarla. Sin comando, no hay poder.

---

## 1. impeccable · v4.8.2
**Tipo:** skill global (`~/.claude/skills/impeccable`) · **Fuente:** github.com/pbakaus/impeccable
**Poder:** convierte al agente en director de diseño. Hace frontend con criterio propio, no plantillas genéricas.

| Comando | Para qué sirve |
|---|---|
| `/impeccable init` | Te entrevista sobre el producto y crea `PRODUCT.md`. **Siempre va primero.** |
| `/impeccable shape` | Diseña una pantalla o sección nueva desde cero. |
| `/impeccable critique` / `audit` | Critica y audita un diseño que ya existe. |
| `/impeccable polish` | Pulido final: espaciado, detalles, coherencia. |
| `/impeccable animate` / `delight` | Animaciones y microdetalles que sorprenden. |
| `/impeccable bolder` / `quieter` | Sube o baja la intensidad visual. |
| `/impeccable typeset` / `colorize` / `layout` | Ajusta tipografía, color o estructura. |
| `/impeccable adapt` | Adapta a móvil o tablet (responsive). |
| `/impeccable optimize` / `harden` | Mejora rendimiento y robustez. |
| `impeccable detect --json <archivos>` | Detector automático de errores de diseño. |

**🔥 Lo mejor:** `PRODUCT.md` + `DESIGN.md` le dan memoria del proyecto. El detector encuentra fallos que el ojo no ve.
**⚠️ Ojo:** sin `PRODUCT.md` no diseña nada nuevo. Hay que correr `init` antes.

---

## 2. ponytail · v5.3.3
**Tipo:** plugin con hooks (`ponytail@ponytail`) · **Fuente:** github.com/DietrichGebert/ponytail
**Poder:** el "senior flojo". Escribe el código más corto que resuelve todo. Se activa solo en cada sesión.

| Comando | Para qué sirve |
|---|---|
| `/ponytail lite\|full\|ultra\|off` | Cambia qué tan agresivo es recortando código. |
| `/ponytail-review` | Revisa un cambio: lógica, seguridad, tests, líneas que sobran. |
| `/ponytail-audit` | Audita el repo entero: bugs, código muerto, cuellos de botella. |
| `/ponytail-debt` | Lista los `shortcut:` pendientes, o sea la deuda técnica. |
| `/ponytail-gain` | Muestra cuánto ahorra (código, costo, tiempo). |

**🔥 Lo mejor:** YAGNI automático, prioriza la librería estándar y deja un test mínimo en la lógica riesgosa. Según su propio benchmark: −53 % de código y −45 % de tokens.
**⚠️ Ojo:** nunca recorta validación, seguridad ni accesibilidad. Los atajos quedan marcados como `shortcut:` para pagarlos después.

---

## 3. hallmark · v2
**Tipo:** skill global (`~/.claude/skills/hallmark`) · **Fuente:** github.com/Nutlope/hallmark (Together AI)
**Poder:** diseña páginas que **no parecen hechas por IA**. Tiene 50 temas, fotos reales y un linter anti-"slop" que revisa la página en un navegador de verdad.

| Comando | Para qué sirve |
|---|---|
| `/hallmark <prompt>` | Construye una página nueva: te ofrece 3 temas y arma la página según su trabajo (un hotel → reservar). |
| `/hallmark custom ...` | Sin temas: diseña desde tu idea única, con las mismas reglas. |
| `/hallmark redesign <ruta>` | Rediseña y conserva el contenido, los links y los formularios. |
| `/hallmark audit <ruta>` | Solo reporta problemas, no toca nada. |
| `node .../scripts/sloplint.mjs <archivo> --render` | Linter: revisa en 8 anchos de pantalla los "tics" típicos de IA. |
| `node .../scripts/theme.mjs deal "<prompt>"` | Reparte 3 temas que encajan con el proyecto. |

**🔥 Lo mejor:**
- **Reglas en 3 niveles:**
  - **Floor:** nunca se rompe (contraste, foco, móvil, datos inventados).
  - **Reflex:** malos hábitos de IA; se pueden saltar si hay una razón.
  - **Finish:** detalles finos de acabado.
- Fotos reales con licencia libre (Wikimedia), con créditos.
- El hero se construye y se revisa solo antes de hacer el resto de la página.
- Al final la revisa un subagente que nunca la vio antes.
- Nunca inventa datos: te los pide.

**⚠️ Ojo:**
- No toca un diseño que ya existe salvo que lo nombres (`redesign`).
- Para las pruebas en navegador necesita `puppeteer-core` y Chrome. En este contenedor ya están: `npm i -g puppeteer-core` + `/usr/bin/chromium` → Chromium de Playwright.

---

## 4. everything-claude-code · commit 432485b
**Tipo:** plugin completo con hooks (`everything-claude-code@everything-claude-code`) · **Fuente:** github.com/worldflowai/everything-claude-code (fork de `affaan-m/everything-claude-code`)
**Poder:** el kit de un ganador de hackathon de Anthropic: 9 agentes, 15 comandos, 11 skills y hooks automáticos.

| Comando | Para qué sirve |
|---|---|
| `/plan` | Repite lo que entendió, evalúa riesgos y arma un plan paso a paso. **Espera tu OK antes de tocar código.** |
| `/tdd` | Primero escribe los tests y después el código mínimo que los pasa (meta: más de 80 % de cobertura). |
| `/verify` | Verificación completa del estado del código. |
| `/code-review` · `/refactor-clean` | Revisión y limpieza de código. |
| `/build-fix` | Analiza errores de compilación y los arregla. |
| `/e2e` · `/test-coverage` | Tests de punta a punta y cobertura. |
| `/checkpoint` | Guarda un punto de control del progreso. |
| `/learn` | Extrae patrones de la sesión y los convierte en skills reutilizables. |
| `/orchestrate` | Coordina varios agentes para una tarea grande. |

**Agentes:** architect, planner, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, refactor-cleaner, e2e-runner, doc-updater.
**Skills:** frontend-patterns, backend-patterns, coding-standards, tdd-workflow, verification-loop, security-review, continuous-learning, eval-harness, strategic-compact…

**🔥 Lo mejor:**
- El flujo `/plan → /tdd → /verify → /code-review → /checkpoint`.
- **Memoria entre sesiones:** guarda el contexto al cerrar y lo carga al abrir.
- Prettier y chequeo de TypeScript automáticos al editar.
- Te avisa si dejaste `console.log`.

**⚠️ Ojo (hooks activos):**
- 🚫 **Bloquea `npm run dev` fuera de tmux.** Úsalo así: `tmux new -s dev "npm run dev"` (tmux ya está instalado).
- 🚫 **Bloquea crear `.md` nuevos con la herramienta Write**, salvo README, CLAUDE, AGENTS y CONTRIBUTING. Afecta a `PRODUCT.md` y `DESIGN.md` de impeccable. Editar los que ya existen sí funciona.
- Eligió **pnpm** como gestor por defecto. Se cambia con `/setup-pm`.
- Su `/code-review` y su `security-review` repiten los que ya trae Claude Code.

---

## ⚔️ Combos
- **impeccable + ponytail:** impeccable decide *qué se ve* y ponytail decide *cómo se escribe*. El diseño es ambicioso y el código queda mínimo.
- **hallmark + impeccable:** son rivales (hallmark se inspiró en impeccable). Usa **uno** para construir la página, por ejemplo hallmark con sus temas y fotos, y el otro como **segunda opinión** (`/impeccable critique`). Si los dos construyen a la vez, chocan.
- **everything-claude-code + ponytail:** `/tdd` exige tests y ponytail exige el mínimo código: juntos dan código corto *y* probado. Pero choca el estilo: ponytail pide "un test pequeño" y `/tdd` pide 80 % de cobertura. Gana el que invoques.
- **/plan + hallmark:** primero `/plan` para la arquitectura del hotel (páginas, reservas), después hallmark para el diseño.
- **hallmark + ponytail:** hallmark entrega HTML y CSS autocontenido; ponytail lo mantiene sin código de más cuando le agregues lógica (reservas, formularios).

---

<!-- Próximas víctimas: anotar aquí cada skill nueva con el mismo formato -->
