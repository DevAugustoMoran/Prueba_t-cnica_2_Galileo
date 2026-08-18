# Levanta el entorno completo de cero: Moodle + MariaDB + plugins instalados
# + la suite de QA lista para correr. Version PowerShell de setup.sh (para
# quienes no tengan Git Bash o WSL a mano). Mismos pasos, mismo orden.
#
# Uso:
#   .\setup.ps1
#   .\setup.ps1 -AdminPassword "OtraClave123!"

param(
    [string]$AdminPassword = "ClaveAdmin123!"
)

$ErrorActionPreference = "Stop"

Write-Host "=== 1/7 - Levantando Moodle + MariaDB ===" -ForegroundColor Cyan
docker compose up -d --build

Write-Host "=== 2/7 - Instalando el esquema de Moodle (puede tardar un rato) ===" -ForegroundColor Cyan
# --lang=es: un Moodle recien instalado solo trae el paquete de idioma
# ingles -- sin esto, la UI se muestra en ingles y buena parte de la suite
# de QA esta escrita contra el espanol real de la instancia.
#
# Tolerante a que la base ya este instalada (de una corrida anterior de
# este mismo script, o de un reintento tras un fallo parcial) -- en vez de
# abortar todo, se detecta ese caso puntual y se sigue de largo.
$salidaInstall = docker compose exec -T -u www-data moodle php admin/cli/install_database.php `
  --agree-license `
  --lang=es `
  --adminuser=admin `
  --adminpass="$AdminPassword" `
  --adminemail=admin@example.com `
  --fullname="QA Automatizado" `
  --shortname="QA" 2>&1
$codigoInstall = $LASTEXITCODE
Write-Host $salidaInstall

$seInstaloAhora = $true
if ($codigoInstall -ne 0) {
    if ($salidaInstall -match "ya existentes|already exist") {
        Write-Host "(La base de datos ya estaba instalada de una corrida anterior -- se omite este paso y se sigue.)"
        $seInstaloAhora = $false
    } else {
        Write-Host "Fallo la instalacion de Moodle por un motivo distinto a 'ya estaba instalada'. Abortando." -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== 3/7 - Instalando los plugins locales (local_mejoras_examen, local_qa_seed) ===" -ForegroundColor Cyan
docker compose exec -T -u www-data moodle php admin/cli/upgrade.php --non-interactive

Write-Host "=== 4/7 - Forzando espanol como idioma por defecto del sitio ===" -ForegroundColor Cyan
docker compose exec -T -u www-data moodle php admin/cli/cfg.php --name=lang --set=es

Write-Host "=== 5/7 - Configurando la URL del webhook (Cambio 3) ===" -ForegroundColor Cyan
docker compose exec -T -u www-data moodle php admin/cli/cfg.php `
  --component=local_mejoras_examen `
  --name=webhook_url `
  --set=http://localhost/local/mejoras_examen/receptor.php

Write-Host "=== 6/7 - Esperando a que Moodle responda por HTTP ===" -ForegroundColor Cyan
$listo = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $respuesta = Invoke-WebRequest -Uri "http://localhost:8080/login/index.php" -UseBasicParsing -TimeoutSec 3
        if ($respuesta.StatusCode -eq 200) {
            Write-Host "Moodle esta sirviendo."
            $listo = $true
            break
        }
    } catch {
        Write-Host "Esperando a Moodle... ($i/30)"
    }
    Start-Sleep -Seconds 2
}
if (-not $listo) {
    Write-Host "Moodle no respondio a tiempo." -ForegroundColor Red
    exit 1
}

Write-Host "=== 7/7 - Preparando la suite de QA ===" -ForegroundColor Cyan
Push-Location qa-automation
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    if ($seInstaloAhora) {
        (Get-Content .env) -replace '^ADMIN_PASSWORD=.*', "ADMIN_PASSWORD=$AdminPassword" | Set-Content .env
    } else {
        Write-Host "OJO: la base de datos ya estaba instalada de antes, asi que no sabemos"
        Write-Host "la contrasena real de admin -- .env quedo con el valor de ejemplo sin"
        Write-Host "completar en ADMIN_PASSWORD. Editalo a mano con la contrasena real."
    }
} elseif ($seInstaloAhora) {
    # .env ya existia, pero como SI se instalo de cero ahora, la contrasena
    # real es la de esta corrida -- se sincroniza.
    (Get-Content .env) -replace '^ADMIN_PASSWORD=.*', "ADMIN_PASSWORD=$AdminPassword" | Set-Content .env
} else {
    Write-Host "(.env ya existia y la base de datos no se reinstalo -- no se toca ADMIN_PASSWORD, se asume que ya estaba bien configurado de antes.)"
}
npm install
# Sin --with-deps: ese flag instala dependencias de sistema vía apt-get,
# pensado para runners Linux (como la CI) -- en Windows no aplica.
npx playwright install chromium
Pop-Location

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " Listo. Para correr la suite completa:"
Write-Host "   cd qa-automation; npm test"
Write-Host ""
if ($seInstaloAhora) {
    Write-Host " Admin de Moodle -> usuario: admin / contrasena: $AdminPassword"
} else {
    Write-Host " OJO: la base de datos ya estaba instalada de una corrida anterior --"
    Write-Host " la contrasena real de admin es la que se uso en ESA instalacion"
    Write-Host " original, no necesariamente '$AdminPassword' (el valor de esta"
    Write-Host " corrida). Si no la recordas y necesitas una conocida, resetea la"
    Write-Host " base de datos de cero con:"
    Write-Host "   docker compose down -v; .\setup.ps1"
}
Write-Host " Moodle corriendo en: http://localhost:8080"
Write-Host "======================================================" -ForegroundColor Green