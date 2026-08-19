# Automatización del disparo (cierra el requisito "corre sin intervención humana")

## Qué hace el workflow

`.github/workflows/qa-automation.yml` instala Moodle + los plugins **desde
cero** en cada corrida (no depende de ningún volumen ni estado previo) y
corre la suite completa de 20 tests. Se dispara:

- **El día 1 de cada mes** (`cron: '0 6 1 * *'`) -- la corrida mensual en sí.
- **En cada push a `main`** -- para que un cambio nuevo en el plugin se
  valide solo, sin esperar al próximo mes.
- **A demanda**, desde la pestaña "Actions" de GitHub (`workflow_dispatch`).

Validado de punta a punta contra una corrida real: instala el esquema de
Moodle en español, los plugins, configura el webhook del Cambio 3, y corre
los 20 tests con evidencia (reporte HTML, traces, logs de diagnóstico
adicionales) subida como artifact de cada corrida.

## Un solo paso manual, único (no por corrida)

Hay que cargar **un secret** en tu repo de GitHub, una sola vez:

`Settings → Secrets and variables → Actions → New repository secret`

| Nombre | Valor |
|---|---|
| `QA_ADMIN_PASSWORD` | La contraseña que querés que tenga el admin de Moodle en esta instancia de prueba (la genera el propio workflow al instalar; no es una contraseña que ya exista en ningún lado) |

Esto no rompe el requisito de "sin intervención humana": es configuración de
una sola vez para el repositorio, no algo que alguien tenga que hacer en
cada corrida -- igual que cualquier credencial de CI.

## Cómo llegó a este estado

El workflow pasó por varias vueltas de ajuste real antes de quedar estable
(idioma del sitio, permisos de archivos en el checkout de git, un bug de
`set -e` matando un proceso de fondo, timing real de tareas programadas de
Moodle) -- el detalle completo de cada hallazgo está en
`qa-automation/docs/decisiones-y-direccion-ia.md`. Quedó resuelto en el
código, no evitado en el test.