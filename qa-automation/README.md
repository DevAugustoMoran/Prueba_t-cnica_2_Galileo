# QA Automatizado — Sistema de exámenes de Moodle

Suite de QA funcional para el módulo Quiz de Moodle, construida con
[Playwright](https://playwright.dev/) + TypeScript, dirigida con IA (Claude).
Cubre el scope completo pedido en el enunciado y los 4 cambios del mes.

## Arquitectura

- **`src_plugin/local_qa_seed/`** (plugin de Moodle, vive junto a `local_mejoras_examen`
  en el repo principal): siembra de forma idempotente el curso base y las cuentas
  de profesor/alumno. No crea el examen ni las preguntas — eso es scope, lo cubren
  los tests.
- **`qa-automation/`** (este directorio): la suite de Playwright.
  - `src/pages/` — Page Objects (una clase por pantalla/formulario de Moodle).
  - `src/fixtures/roles.ts` — fixtures `adminPage` / `teacherPage` / `studentPage`,
    cada una en su propio contexto de navegador con sesión ya autenticada (permite
    tener profesor y alumno interactuando en paralelo dentro de un mismo test).
  - `tests/setup/auth.setup.ts` — loguea los 3 roles una sola vez por corrida y
    guarda su sesión; corre automáticamente antes que el resto (ver
    `playwright.config.ts`, proyecto `setup` del que depende `chromium`).
  - `tests/*.spec.ts` — un archivo por bloque de scope (ver `docs/coverage-map.md`).

## Requisitos

- El stack de Docker del repo principal levantado (`docker compose up -d` desde la
  raíz del repo) y accesible en `http://localhost:8080`.
- Node.js 20+.
- El plugin `local_qa_seed` copiado a `local/qa_seed` dentro del contenedor de
  Moodle (igual que `local_mejoras_examen`: agregar el bind mount correspondiente
  en `docker-compose.yml` o copiarlo a mano).

## Setup

```bash
cd qa-automation
npm install
npx playwright install --with-deps chromium
cp .env.example .env
```

Editá `.env`: como mínimo, `ADMIN_PASSWORD` con la contraseña real de tu admin.

## Sembrar los datos base

```bash
npm run seed          # crea el curso/usuarios si no existen, reutiliza si ya están
npm run seed:reset     # borra el curso de QA y lo vuelve a crear desde cero
```

`npm test` corre `seed:reset` automáticamente antes (ver el hook `pretest` en
`package.json`) para que cada corrida completa empiece desde un estado limpio y
reproducible.

## Correr la suite

```bash
npm test              # LA corrida oficial: resetea (pretest → seed:reset) y corre todo, headless
npm run test:headed   # igual, pero mostrando el navegador (para debug)
npm run test:ui       # modo interactivo de Playwright (recomendado para ir agregando tests)
npm run report        # abre el último reporte HTML generado
```

**`npm test` es la referencia**: siempre arranca de un curso limpio (el hook
`pretest` corre `seed:reset` antes de cada corrida), así que es repetible sin
importar qué haya quedado de corridas anteriores. Correr un archivo suelto con
`npx playwright test tests/02-...` (sin pasar por `npm test`) es útil para
iterar rápido mientras se desarrolla un test nuevo, pero esas corridas
parciales pueden dejar datos duplicados de intentos previos -- no representan
el comportamiento real de la suite. Para validar de verdad, siempre `npm test`.

## Evidencia de cada corrida

- **Reporte HTML** (`playwright-report/index.html`, abrí con `npm run report`):
  resultado test por test, con pasos, tiempos y captura del error si falló.
- **`test-results/results.json`**: el mismo resultado en JSON, para cruzarlo
  programáticamente si hace falta (por ejemplo, para el reporte de cobertura).
- **Trace y video** solo en los tests que fallan (`trace: 'retain-on-failure'`):
  se pueden abrir con `npx playwright show-trace <archivo>.zip` y reproducir la
  corrida clic a clic.

## Estado actual

Ver `docs/coverage-map.md` para el detalle de qué está cubierto y qué falta.
Este README y el mapa de cobertura se actualizan a medida que se agrega cada
bloque de tests.