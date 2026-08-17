<?php

defined('MOODLE_INTERNAL') || die();

$observers = [
    [
        'eventname'   => '\mod_quiz\event\attempt_submitted',
        'callback'    => '\local_mejoras_examen\observador::evaluar_intento_ia',
    ],
];