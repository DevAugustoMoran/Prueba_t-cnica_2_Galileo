<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_mejoras_examen', 'Mejoras de Examen');
    $ADMIN->add('localplugins', $settings);

    $settings->add(new admin_setting_configtext(
        'local_mejoras_examen/webhook_url',
        'URL del Sistema Externo',
        'Endpoint donde se enviarán los resultados (estudiante, nota, timestamp) al enviar un intento.',
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configtext(
        'local_mejoras_examen/penalizacion_gracia',
        'Penalización por Período de Gracia (%)',
        'Porcentaje que se deducirá de la nota de un intento si este se envía durante el período de gracia (ejemplo: 10 para 10%).',
        '10',
        PARAM_INT
    ));
}