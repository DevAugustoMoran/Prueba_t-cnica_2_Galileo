<?php
namespace local_mejoras_examen;

defined('MOODLE_INTERNAL') || die();

class observador {

    // Método exclusivo para el Cambio 3: Registrar el intento en la cola del Webhook
    public static function registrar_webhook_intento(\mod_quiz\event\attempt_submitted $evento) {
        global $DB;

        $id_intento = $evento->objectid;
        $registro_intento = $DB->get_record('quiz_attempts', ['id' => $id_intento]);
        if (!$registro_intento) return;

        // Extraer la nota final consolidada en el libro de calificaciones
        $registro_nota_final = $DB->get_record('quiz_grades', [
            'quiz' => $registro_intento->quiz, 
            'userid' => $registro_intento->userid
        ]);
        
        $nota_final = $registro_nota_final ? $registro_nota_final->grade : $registro_intento->sumgrades;

        $carga_util = json_encode([
            'estudiante_id' => $registro_intento->userid,
            'examen_id'     => $registro_intento->quiz,
            'nota_intento'  => (float) $registro_intento->sumgrades,
            'nota_final'    => (float) $nota_final,
            'timestamp'     => time()
        ]);

        $registro_webhook = new \stdClass();
        $registro_webhook->intento_id = $id_intento;
        $registro_webhook->carga_util = $carga_util;
        $registro_webhook->estado = 'pendiente';
        $registro_webhook->reintentos = 0;
        $registro_webhook->tiempo_creacion = time();
        $registro_webhook->tiempo_modificacion = time();

        $DB->insert_record('local_mejoras_webhook', $registro_webhook);
    }

    // Método para el Cambio 4: Iniciar la penalización por gracia
    public static function aplicar_penalizacion_gracia(\core\event\base $evento) {
        global $DB;
        $intento_id = $evento->objectid;
        
        // Delegación al final del ciclo de vida para evitar sobreescrituras de Moodle
        \core_shutdown_manager::register_function('\local_mejoras_examen\observador::procesar_penalizacion_diferida', [$intento_id]);
    }

    // Ejecución diferida de la penalización matemática
    public static function procesar_penalizacion_diferida($intento_id) {
        global $DB, $CFG;

        $registro_intento = $DB->get_record('quiz_attempts', ['id' => $intento_id]);
        if (!$registro_intento) return;

        $examen = $DB->get_record('quiz', ['id' => $registro_intento->quiz]);
        if (empty($examen->timelimit)) return;

        $porcentaje_penalizacion = get_config('local_mejoras_examen', 'penalizacion_gracia');
        if (empty($porcentaje_penalizacion) || $porcentaje_penalizacion <= 0) return;

        $tiempo_limite_estricto = $registro_intento->timestart + $examen->timelimit;
        $tiempo_excedido = $registro_intento->timefinish - $tiempo_limite_estricto;

        if ($tiempo_excedido > 15) {
            
            $nota_bruta_original = (float) $registro_intento->sumgrades;
            if ($nota_bruta_original <= 0) return;

            $factor_multiplicador = 1 - ($porcentaje_penalizacion / 100);
            $nota_bruta_penalizada = $nota_bruta_original * $factor_multiplicador;

            // Modificación del registro bruto
            $registro_intento->sumgrades = $nota_bruta_penalizada;
            $DB->update_record('quiz_attempts', $registro_intento);

            // Recálculo forzado
            require_once($CFG->dirroot . '/mod/quiz/locallib.php');
            quiz_save_best_grade($examen, $registro_intento->userid);

            // Obtención de la escala final
            $calificacion_actualizada = $DB->get_record('quiz_grades', ['quiz' => $examen->id, 'userid' => $registro_intento->userid]);
            $nueva_nota_escalada = (float) $calificacion_actualizada->grade;

            $nota_escalada_original = ($examen->sumgrades > 0) ? ($nota_bruta_original / $examen->sumgrades) * $examen->grade : 0;
            
            $nota_orig_fmt = number_format($nota_escalada_original, 2);
            $nueva_nota_fmt = number_format($nueva_nota_escalada, 2);
            $mensaje = "Nota original calculada: {$nota_orig_fmt}. Se aplicó una deducción del {$porcentaje_penalizacion}% por entrega tardía (período de gracia). Nota ajustada: {$nueva_nota_fmt}.";

            // Inyección en Gradebook y liberación del candado de anulación
            require_once($CFG->libdir . '/gradelib.php');
            $grade_item = \grade_item::fetch([
                'itemtype' => 'mod',
                'itemmodule' => 'quiz',
                'iteminstance' => $examen->id,
                'courseid' => $examen->course
            ]);

            if ($grade_item) {
                $grade_grade = \grade_grade::fetch([
                    'itemid' => $grade_item->id,
                    'userid' => $registro_intento->userid
                ]);
                
                if ($grade_grade) {
                    $grade_grade->feedback = $mensaje;
                    $grade_grade->feedbackformat = FORMAT_MOODLE;
                    $grade_grade->overridden = 0; 
                    $grade_grade->update();
                }
            }
        }
    }
}