#!/bin/bash
set -e

# Corre el cron de Moodle en segundo plano cada 60 segundos. Sin esto, las
# tareas programadas del plugin (envío resiliente al webhook del Cambio 3,
# entre otras) nunca se ejecutan.
#
# El "|| true" es necesario: sin él, la primerísima corrida de cron.php --que
# pasa apenas arranca Apache, antes de que la base de datos exista en un
# contenedor nuevo-- falla, y como set -e se hereda dentro del subshell, esa
# falla mata el loop entero para el resto de la vida del contenedor. Con
# "|| true", una corrida fallida no interrumpe las siguientes.
(
    while true; do
        php /var/www/html/admin/cli/cron.php >> /var/log/moodle_cron.log 2>&1 || true
        sleep 60
    done
) &

# Arranca Apache en primer plano (comportamiento normal de la imagen base php:8.1-apache)
exec apache2-foreground