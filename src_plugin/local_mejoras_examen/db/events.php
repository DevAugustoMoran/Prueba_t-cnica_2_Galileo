<?php
defined('MOODLE_INTERNAL') || die();

$observers = [
    [
        'eventname'   => '\mod_quiz\event\attempt_submitted',
        'callback'    => '\local_mejoras_examen\observador::registrar_webhook_intento',
    ],
    [
        'eventname'   => '\mod_quiz\event\attempt_submitted',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
    [
        'eventname'   => '\mod_quiz\event\attempt_recalculated',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
];