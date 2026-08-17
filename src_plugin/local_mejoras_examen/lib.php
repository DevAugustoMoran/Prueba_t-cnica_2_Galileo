<?php
defined('MOODLE_INTERNAL') || die();

function local_mejoras_examen_extend_navigation(global_navigation $nav) {
    global $PAGE;

    if ($PAGE->pagetype === 'mod-quiz-attempt') {
        $ruta_script_estudiante = new moodle_url('/local/mejoras_examen/foco.js');
        $PAGE->requires->js($ruta_script_estudiante);
    }

    if (strpos($PAGE->pagetype, 'mod-quiz-report') === 0) {
        $ruta_script_profesor = new moodle_url('/local/mejoras_examen/alerta_profesor.js');
        $PAGE->requires->js($ruta_script_profesor);
    }

    if (strpos($PAGE->pagetype, 'mod-quiz-comment') !== false || 
        strpos($PAGE->pagetype, 'mod-quiz-report') !== false || 
        strpos($PAGE->pagetype, 'mod-quiz-review') !== false) {
        
        // Candado de seguridad: Solo inyecta el script si el usuario tiene permisos para calificar
        if (has_capability('mod/quiz:grade', $PAGE->context)) {
            $ruta_script_ia = new moodle_url('/local/mejoras_examen/asistente_ia.js');
            $PAGE->requires->js($ruta_script_ia);
        }
    }
}