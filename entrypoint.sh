#!/bin/bash
set -e

# Corre el cron de Moodle en segundo plano cada 60 segundos. Sin esto, las
# tareas programadas del plugin (envío resiliente al webhook del Cambio 3,
# entre otras) nunca se ejecutan.
(
    while true; do
        php /var/www/html/admin/cli/cron.php >> /var/log/moodle_cron.log 2>&1
        sleep 60
    done
) &

# Arranca Apache en primer plano (comportamiento normal de la imagen base php:8.1-apache)
exec apache2-foreground