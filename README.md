# Prueba técnica — Sistema de exámenes Moodle

Automatización de QA para el módulo de exámenes (`local_mejoras_examen`) de una
instancia Moodle 4.3.12, más los 4 cambios del mes implementados sobre ese
plugin. Cubre los 12 ítems del scope pedido y los 4 cambios, corriendo sin
intervención humana vía GitHub Actions (`.github/workflows/qa-automation.yml`).

## Qué hay en este repo

| Carpeta / archivo | Qué es |
|---|---|
| `src_plugin/local_mejoras_examen/` | El plugin con los 4 cambios del mes |
| `src_plugin/local_qa_seed/` | Plugin auxiliar: resetea y siembra datos de prueba para la suite |
| `qa-automation/` | La suite de QA (Playwright + TypeScript), 20 tests |
| `qa-automation/docs/coverage-map.md` | Qué cubre cada test contra el scope pedido |
| `qa-automation/docs/40h-a-2h.md` | Cómo se sostiene la reducción de 40h a 2h, demostrado con los 4 cambios |
| `qa-automation/docs/decisiones-y-direccion-ia.md` | Decisiones técnicas y dirección de IA |
| `.github/workflows/qa-automation.yml` | CI: instala todo de cero y corre la suite (mensual, en cada push, y a demanda) |
| `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `config.php` | El entorno de Moodle en sí |
| `setup.sh` / `setup.ps1` | Un solo comando para dejar todo levantado y listo (bash o PowerShell) |
| `LEEME-CI.md` | Qué hace falta configurar una sola vez para que la CI corra (un secret de GitHub) |

## Cómo levantar el entorno

### Requisitos

- Docker y Docker Compose
- Node.js 20+
- En Windows: `setup.sh` necesita Git Bash o WSL; si preferís quedarte en
  PowerShell nativo, usá `setup.ps1` (mismos pasos, sintaxis de PowerShell)

### Camino rápido

```bash
./setup.sh
```

o, en PowerShell:

```powershell
.\setup.ps1
```

Deja Moodle instalado (con los plugins, en español, con el webhook del
Cambio 3 configurado) y la suite de QA lista (`npm install` +
navegador de Playwright instalados). Al final imprime la contraseña de
admin que quedó configurada.

Si preferís elegir vos la contraseña de admin en vez de la que trae por
defecto:

```bash
QA_ADMIN_PASSWORD="TuClave123!" ./setup.sh
```
```powershell
.\setup.ps1 -AdminPassword "TuClave123!"
```

Los dos scripts son tolerantes a correrse más de una vez: si la base de
datos ya estaba instalada de una corrida anterior, lo detectan, no
reinstalan encima, y avisan que la contraseña real de admin es la de esa
instalación original (no necesariamente la de la corrida actual). Para
resetear todo de cero con una contraseña conocida: `docker compose down -v`
y correr el script de nuevo.

### Camino manual (paso a paso)

Si preferís entender o depurar cada paso, esto es exactamente lo que hace
`setup.sh` por dentro (y lo que corre la CI):

```bash
# 1. Permisos de las carpetas de plugins (se montan desde tu checkout de git)
chmod -R 777 src_plugin/

# 2. Levantar los contenedores
docker compose up -d --build

# 3. Instalar el esquema de Moodle (--lang=es es importante: sin esto, la UI
#    queda en inglés y la suite de QA está escrita contra el español real)
docker compose exec -T -u www-data moodle php admin/cli/install_database.php \
  --agree-license --lang=es \
  --adminuser=admin --adminpass="TuClaveDeAdmin" \
  --adminemail=admin@example.com \
  --fullname="QA Automatizado" --shortname="QA"

# 4. Instalar los plugins locales
docker compose exec -T -u www-data moodle php admin/cli/upgrade.php --non-interactive

# 5. Forzar español como idioma por defecto del sitio (refuerzo del --lang=es,
#    para que también aplique a las cuentas de profesor/alumno que crea el seed)
docker compose exec -T -u www-data moodle php admin/cli/cfg.php --name=lang --set=es

# 6. Configurar la URL del webhook (Cambio 3) -- receptor.php hace de
#    "sistema externo" para poder probarlo end-to-end sin depender de un tercero
docker compose exec -T -u www-data moodle php admin/cli/cfg.php \
  --component=local_mejoras_examen --name=webhook_url \
  --set=http://localhost/local/mejoras_examen/receptor.php

# 7. Esperar a que Moodle responda en http://localhost:8080

# 8. Preparar la suite de QA
cd qa-automation
cp .env.example .env
# Editá .env: poné en ADMIN_PASSWORD la misma contraseña que usaste en el paso 3
npm install
npx playwright install --with-deps chromium
```

## Cómo correr la suite

```bash
cd qa-automation
npm test
```

Esto resetea el curso de prueba a un estado limpio y corre los 20 tests de
punta a punta contra la instancia real. Al terminar, abrí el reporte:

```bash
npx playwright show-report
```

O directamente `qa-automation/playwright-report/index.html` en el navegador.

## Explorar el resultado a mano

`setup.sh`/`setup.ps1` deja Moodle instalado, pero **vacío** (solo existe la
cuenta `admin`). El curso de prueba, las cuentas de profesor/alumno, y sobre
todo los exámenes con notas reales registradas, los crea **la suite al
correr** (`npm test`), no el setup por sí solo.

Después de correr `npm test` una vez, podés entrar a
`http://localhost:8080` a mano y ver todo lo que quedó armado: el curso
`QA-AUTOMATION`, varios exámenes con intentos rendidos y calificados
(incluida al menos una penalización aplicada), y las dos cuentas:

| Rol | Usuario | Contraseña |
|---|---|---|
| Profesor | `qa_profesor` | `ClaveSegura123!` |
| Alumno | `qa_estudiante` | `ClaveSegura123!` |

(Estos valores están en `qa-automation/.env.example` — si los cambiaste ahí,
usá los tuyos.)

**Ojo**: si volvés a correr `npm test`, el curso se resetea y se recrea de
cero al principio (por diseño, para que cada corrida sea repetible) — si
querés preservar un estado específico para mirarlo con calma, simplemente
no vuelvas a correr la suite después de la corrida que querés inspeccionar.

## Evidencia de que corre sin intervención humana

Además de poder correrla vos mismo con lo de arriba, la suite corre **sola**
en GitHub Actions: mensualmente, en cada push a `main`, y a demanda desde la
pestaña **Actions** del repo (`workflow_dispatch`). Cada corrida instala
Moodle de cero (no depende de ningún estado previo) y deja como evidencia
descargable: el reporte HTML de Playwright, los traces de cada test, y logs
de diagnóstico adicionales (cron de Moodle, cola de webhooks).

Para que la CI corra, hace falta cargar un secret una sola vez en el repo de
GitHub (`QA_ADMIN_PASSWORD`) — ver `LEEME-CI.md` para el paso a paso.

Ver `.github/workflows/qa-automation.yml` para el detalle del workflow, y la
pestaña Actions del repo para corridas reales ya ejecutadas.

## Más documentación

- **Cobertura contra el scope pedido**: `qa-automation/docs/coverage-map.md`
- **Cómo se sostiene el 40h → 2h, demostrado con los 4 cambios**: `qa-automation/docs/40h-a-2h.md`
- **Decisiones técnicas y dirección de IA**: `qa-automation/docs/decisiones-y-direccion-ia.md`
- **Configuración de la CI (el secret que hace falta)**: `LEEME-CI.md`