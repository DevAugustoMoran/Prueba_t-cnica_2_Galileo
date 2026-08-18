# Automatización del disparo (cierra el requisito "corre sin intervención humana")

Estos dos archivos van en la **raíz de tu repo** (no dentro de `qa-automation/`):

- `docker-compose.yml` (reemplaza al tuyo -- el único cambio real es agregar
  el mount de `local_qa_seed`, que faltaba)
- `.github/workflows/qa-automation.yml` (nuevo)

## Qué hace el workflow

Instala Moodle + los plugins **desde cero** (no depende de tu volumen local
de MariaDB, que en un runner de CI arranca vacío) y corre la suite completa.
Se dispara:

- **El día 1 de cada mes** (`cron: '0 6 1 * *'`) -- la corrida mensual en sí.
- **En cada push a `main`** -- para que un cambio nuevo en el plugin se
  valide solo, sin esperar al próximo mes.
- **A demanda**, desde la pestaña "Actions" de GitHub (`workflow_dispatch`).

## Un solo paso manual, único (no por corrida)

Hay que cargar **un secret** en tu repo de GitHub, una sola vez:

`Settings → Secrets and variables → Actions → New repository secret`

| Nombre | Valor |
|---|---|
| `QA_ADMIN_PASSWORD` | La contraseña que querés que tenga el admin de Moodle en esta instancia de prueba (la genera el propio workflow al instalar; no es una contraseña que ya exista en ningún lado) |

Esto no rompe el requisito de "sin intervención humana": es configuración de
una sola vez para el repositorio, no algo que alguien tenga que hacer en
cada corrida -- igual que cualquier credencial de CI.

## Lo que no pude validar

A diferencia de absolutamente todo lo demás construido en esta sesión (cada
fix de la suite se probó contra tu instancia real antes de dártelo), este
workflow no lo pude ejecutar yo mismo -- no tengo forma de correr GitHub
Actions desde acá. Lo armé confirmando cada comando contra el código fuente
real de Moodle (`admin/cli/install_database.php`, `admin/cli/cfg.php`,
`admin/cli/upgrade.php`), pero el punto de mayor incertidumbre es el
healthcheck de MariaDB (`mariadb-admin ping` -- nombre moderno del binario,
no confirmado contra la imagen real corriendo).

Te recomiendo dispararlo una vez a mano (`workflow_dispatch`, desde la
pestaña "Actions") antes de confiar en que la corrida mensual programada
vaya a andar sola. Si falla, pasame el log del job (igual que hiciste con
cada reporte de Playwright durante toda la sesión) y lo ajustamos con la
misma mecánica que usamos para todo lo demás.
