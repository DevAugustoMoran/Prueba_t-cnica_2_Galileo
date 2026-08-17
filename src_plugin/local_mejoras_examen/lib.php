<?php
defined('MOODLE_INTERNAL') || die();

function local_mejoras_examen_extend_navigation(global_navigation $nav) {
    global $PAGE;

    // Inyectar foco.js EXCLUSIVAMENTE en la ventana de resolución del estudiante
    if ($PAGE->pagetype === 'mod-quiz-attempt') {
        $ruta_script_estudiante = new moodle_url('/local/mejoras_examen/foco.js');
        $PAGE->requires->js($ruta_script_estudiante);
    }

    // Inyectar alerta_profesor.js EXCLUSIVAMENTE en las vistas de reportes
    if (strpos($PAGE->pagetype, 'mod-quiz-report') === 0) {
        $ruta_script_profesor = new moodle_url('/local/mejoras_examen/alerta_profesor.js');
        $PAGE->requires->js($ruta_script_profesor);
    }
}