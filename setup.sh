#!/bin/bash
# Levanta el entorno completo de cero: Moodle + MariaDB + plugins instalados
# + la suite de QA lista para correr. Espeja exactamente los pasos ya
# verificados en .github/workflows/qa-automation.yml -- si algo falla acá,
# lo más probable es que también fallaría en la CI (y viceversa).
#
# Uso:
#   ./setup.sh                      # usa una contraseña de admin por defecto
#   QA_ADMIN_PASSWORD=otra ./setup.sh   # elegís vos la contraseña de admin
#
# Requiere: Docker, Docker Compose, Node.js 20+, curl.
# En Windows: correr desde WSL o Git Bash (no PowerShell/cmd directo).

set -e

ADMIN_PASSWORD="${QA_ADMIN_PASSWORD:-ClaveAdmin123!}"

echo "=== 1/8 · Permisos de las carpetas de plugins ==="
# src_plugin/ se monta dentro del contenedor tal cual queda en tu checkout
# de git -- sin esto, www-data (el usuario con el que corre Apache/PHP
# dentro del contenedor) puede no tener permiso de escritura ahí.
chmod -R 777 src_plugin/

echo "=== 2/8 · Levantando Moodle + MariaDB ==="
docker compose up -d --build

echo "=== 3/8 · Instalando el esquema de Moodle (puede tardar un rato) ==="
# --lang=es: un Moodle recién instalado solo trae el paquete de idioma
# inglés -- sin esto, la UI se muestra en inglés y buena parte de la suite
# de QA está escrita contra el español real de la instancia.
#
# Tolerante a que la base ya esté instalada (de una corrida anterior de este
# mismo script, o de un reintento tras un fallo parcial) -- en vez de
# abortar todo, se detecta ese caso puntual y se sigue de largo.
set +e
SALIDA_INSTALL=$(docker compose exec -T -u www-data moodle php admin/cli/install_database.php \
  --agree-license \
  --lang=es \
  --adminuser=admin \
  --adminpass="$ADMIN_PASSWORD" \
  --adminemail=admin@example.com \
  --fullname="QA Automatizado" \
  --shortname="QA" 2>&1)
CODIGO_INSTALL=$?
set -e
echo "$SALIDA_INSTALL"

if [ $CODIGO_INSTALL -ne 0 ]; then
  if echo "$SALIDA_INSTALL" | grep -qi "ya existentes\|already exist"; then
    echo "(La base de datos ya estaba instalada de una corrida anterior -- se omite este paso y se sigue.)"
  else
    echo "Falló la instalación de Moodle por un motivo distinto a 'ya estaba instalada'. Abortando."
    exit 1
  fi
fi

echo "=== 4/8 · Instalando los plugins locales (local_mejoras_examen, local_qa_seed) ==="
docker compose exec -T -u www-data moodle php admin/cli/upgrade.php --non-interactive

echo "=== 5/8 · Forzando español como idioma por defecto del sitio ==="
# Refuerzo del --lang=es de la instalación: ese parámetro asegura el paquete
# de idioma instalado y la preferencia del admin, pero no necesariamente
# $CFG->lang para TODOS los usuarios -- el profesor y el alumno son cuentas
# que crea el script de seed después, sin preferencia propia.
docker compose exec -T -u www-data moodle php admin/cli/cfg.php --name=lang --set=es

echo "=== 6/8 · Configurando la URL del webhook (Cambio 3) ==="
# receptor.php vive en el mismo contenedor: hace de "sistema externo" para
# poder probar el Cambio 3 end-to-end sin depender de un tercero real.
docker compose exec -T -u www-data moodle php admin/cli/cfg.php \
  --component=local_mejoras_examen \
  --name=webhook_url \
  --set=http://localhost/local/mejoras_examen/receptor.php

echo "=== 7/8 · Esperando a que Moodle responda por HTTP ==="
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/login/index.php > /dev/null; then
    echo "Moodle está sirviendo."
    break
  fi
  echo "Esperando a Moodle... ($i/30)"
  sleep 2
done

echo "=== 8/8 · Preparando la suite de QA ==="
cd qa-automation
if [ ! -f .env ]; then
  cp .env.example .env
fi
# Reemplaza ADMIN_PASSWORD en .env con la contraseña real recién configurada
# (portable entre GNU sed y BSD/macOS sed vía el sufijo .bak).
sed -i.bak "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env && rm -f .env.bak
npm install
npx playwright install --with-deps chromium

echo ""
echo "======================================================"
echo " Listo. Para correr la suite completa:"
echo "   cd qa-automation && npm test"
echo ""
echo " Admin de Moodle -> usuario: admin / contraseña: $ADMIN_PASSWORD"
echo " Moodle corriendo en: http://localhost:8080"
echo "======================================================"