FROM php:8.1-apache

# Instalar librerías del sistema necesarias, extensiones PHP y cliente Git
RUN apt-get update && apt-get install -y \
    libzip-dev zip libpng-dev libicu-dev libxml2-dev git \
    && docker-php-ext-install mysqli pdo_mysql zip gd intl soap opcache

# Configurar parámetros de PHP exigidos por Moodle
RUN echo "max_input_vars = 5000" > /usr/local/etc/php/conf.d/moodle.ini

# Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# Clonar directamente la versión oficial estable de Moodle 4.3
RUN git clone -b MOODLE_403_STABLE --depth 1 https://github.com/moodle/moodle.git /var/www/html

# Crear directorio de datos y asignar permisos al usuario de Apache (www-data)
RUN mkdir /var/www/moodledata \
    && chown -R www-data:www-data /var/www/html /var/www/moodledata \
    && chmod -R 777 /var/www/moodledata \
    && touch /var/log/moodle_cron.log && chown www-data:www-data /var/log/moodle_cron.log

RUN touch /var/log/moodle_cron.log && chown www-data:www-data /var/log/moodle_cron.log

   COPY entrypoint.sh /usr/local/bin/entrypoint.sh
   RUN chmod +x /usr/local/bin/entrypoint.sh
   ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]