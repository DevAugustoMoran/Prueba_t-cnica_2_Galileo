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
        // question_manually_graded se dispara SÍNCRONAMENTE desde comment.php justo al
        // guardar la nota de una pregunta de ensayo, después de que Moodle ya recalculó
        // sumgrades y empujó la nota al gradebook. A diferencia de
        // attempt_manual_grading_completed (que depende de una tarea de cron y de que
        // el envío de email de notificación funcione), este SIEMPRE se dispara.
        'eventname'   => '\mod_quiz\event\question_manually_graded',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
    [
        // Se mantiene como respaldo por si en producción el cron sí está corriendo:
        // attempt_manual_grading_completed solo se dispara desde la tarea programada
        // quiz_notify_attempt_manual_grading_completed, y únicamente como efecto
        // secundario de haber enviado con éxito el email de notificación al alumno.
        // No depender solo de este evento.
        'eventname'   => '\mod_quiz\event\attempt_manual_grading_completed',
        'callback'    => '\local_mejoras_examen\observador::aplicar_penalizacion_gracia',
    ],
];