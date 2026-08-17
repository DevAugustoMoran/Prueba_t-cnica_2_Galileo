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
    [
        // Desde Moodle 4.5, el envío se parte en dos pasos: attempt_submitted (guarda
        // respuestas, sumgrades todavía en 0) y attempt_graded (recién acá se calcula
        // sumgrades para preguntas auto-calificadas). Este es el punto correcto para
        // exámenes sin preguntas de ensayo.
        'eventname'   => '\mod_quiz\event\attempt_graded',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
    [
        // Cuando el examen tiene preguntas de ensayo, sumgrades sigue en 0 al momento del
        // attempt_submitted (todavía falta calificar). Este evento se dispara cuando el
        // profesor termina de calificar manualmente todo el intento y sumgrades ya es la
        // nota final real, así que es el momento correcto para aplicar la penalización.
        'eventname'   => '\mod_quiz\event\attempt_manual_grading_completed',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
];