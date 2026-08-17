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

        self::log_debug("EVENTO recibido: " . get_class($evento) . " objectid={$intento_id}");

        // Delegación al final del ciclo de vida para evitar sobreescrituras de Moodle
        \core_shutdown_manager::register_function('\local_mejoras_examen\observador::procesar_penalizacion_diferida', [$intento_id]);
    }

    // Log temporal de diagnóstico: escribe cada paso de la evaluación a un archivo
    // dentro del propio plugin, para poder ver exactamente qué rama se está tomando.
    private static function log_debug($mensaje) {
        $linea = date('Y-m-d H:i:s') . ' - ' . $mensaje . "\n";
        file_put_contents(__DIR__ . '/../debug_gracia.txt', $linea, FILE_APPEND);
    }

    // Ejecución diferida de la penalización matemática
    public static function procesar_penalizacion_diferida($intento_id) {
        global $DB, $CFG;

        self::log_debug("=== Inicio procesar_penalizacion_diferida, intento_id={$intento_id} ===");

        $registro_intento = $DB->get_record('quiz_attempts', ['id' => $intento_id]);
        if (!$registro_intento) {
            self::log_debug("CORTE: no se encontró quiz_attempts con id={$intento_id}");
            return;
        }

        $examen = $DB->get_record('quiz', ['id' => $registro_intento->quiz]);
        if (!$examen) {
            self::log_debug("CORTE: no se encontró quiz con id={$registro_intento->quiz}");
            return;
        }

        $porcentaje_penalizacion = (float) get_config('local_mejoras_examen', 'penalizacion_gracia');
        self::log_debug("porcentaje_penalizacion={$porcentaje_penalizacion}");
        if ($porcentaje_penalizacion <= 0) {
            self::log_debug("CORTE: porcentaje_penalizacion <= 0");
            return;
        }

        // El período de gracia de Moodle está atado al vencimiento del timelimit de ESE intento
        // (timestart + timelimit), no al timeclose general del examen. Si además hay un timeclose
        // configurado, el deadline real es el que ocurra primero de los dos.
        $deadline_por_tiempo = (isset($examen->timelimit) && $examen->timelimit > 0)
            ? ((int) $registro_intento->timestart + (int) $examen->timelimit)
            : 0;

        $deadline_por_cierre = (isset($examen->timeclose) && $examen->timeclose > 0)
            ? (int) $examen->timeclose
            : 0;

        $candidatos_deadline = array_filter([$deadline_por_tiempo, $deadline_por_cierre]);
        $deadline = $candidatos_deadline ? min($candidatos_deadline) : 0;

        $gracewindow = (isset($examen->graceperiod) && $examen->graceperiod > 0)
            ? (int) $examen->graceperiod
            : 0;

        self::log_debug("timestart={$registro_intento->timestart} timefinish={$registro_intento->timefinish} "
            . "timelimit={$examen->timelimit} timeclose={$examen->timeclose} graceperiod={$examen->graceperiod} "
            . "overduehandling={$examen->overduehandling}");
        self::log_debug("deadline_por_tiempo={$deadline_por_tiempo} deadline_por_cierre={$deadline_por_cierre} "
            . "deadline_final={$deadline} gracewindow={$gracewindow}");

        // Se aplica sólo si la entrega es tardía pero todavía dentro del periodo de gracia real.
        $es_tardia = $deadline > 0 && $registro_intento->timefinish > $deadline;
        $dentro_gracia = $gracewindow > 0
            ? ($registro_intento->timefinish <= ($deadline + $gracewindow))
            : $es_tardia;

        self::log_debug("es_tardia=" . ($es_tardia ? '1' : '0') . " dentro_gracia=" . ($dentro_gracia ? '1' : '0'));

        if (!$es_tardia || !$dentro_gracia) {
            self::log_debug("CORTE: no es tardía o no está dentro de gracia");
            return;
        }

        $nota_bruta_original = (float) $registro_intento->sumgrades;
        self::log_debug("nota_bruta_original={$nota_bruta_original}");
        if ($nota_bruta_original <= 0) {
            self::log_debug("CORTE: nota_bruta_original <= 0 (probablemente falta calificación manual)");
            return;
        }

        $factor_multiplicador = 1 - ($porcentaje_penalizacion / 100);
        $nota_bruta_penalizada = max(0, $nota_bruta_original * $factor_multiplicador);

        $registro_intento->sumgrades = $nota_bruta_penalizada;
        $DB->update_record('quiz_attempts', $registro_intento);
        self::log_debug("sumgrades actualizado: {$nota_bruta_original} -> {$nota_bruta_penalizada}");

        require_once($CFG->dirroot . '/mod/quiz/locallib.php');
        quiz_save_best_grade($examen, $registro_intento->userid);

        $calificacion_actualizada = $DB->get_record('quiz_grades', ['quiz' => $examen->id, 'userid' => $registro_intento->userid]);
        $nueva_nota_escalada = $calificacion_actualizada ? (float) $calificacion_actualizada->grade : 0.0;

        $nota_escalada_original = ($examen->sumgrades > 0)
            ? ($nota_bruta_original / $examen->sumgrades) * $examen->grade
            : 0;

        $nota_orig_fmt = number_format($nota_escalada_original, 2);
        $nueva_nota_fmt = number_format($nueva_nota_escalada, 2);
        $mensaje = "Nota original calculada: {$nota_orig_fmt}. Se aplicó una deducción del {$porcentaje_penalizacion}% por entrega tardía (período de gracia). Nota ajustada: {$nueva_nota_fmt}.";

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
                // No confiar en que quiz_save_best_grade() ya haya empujado el valor
                // penalizado a finalgrade: si el registro llegó marcado 'overridden',
                // grade_update() actualiza rawgrade pero IGNORA finalgrade, dejando la
                // nota vieja visible en el reporte del calificador aunque el feedback
                // ya diga lo correcto. Forzamos ambos campos explícitamente acá.
                $grade_grade->rawgrade = $nueva_nota_escalada;
                $grade_grade->finalgrade = $nueva_nota_escalada;
                $grade_grade->feedback = $mensaje;
                $grade_grade->feedbackformat = FORMAT_MOODLE;
                $grade_grade->overridden = 0;
                $grade_grade->update('local_mejoras_examen');
            }
        }

        // El item ya quedó correcto, pero el Total del curso se recalcula en un paso
        // aparte de agregación. Forzamos ese recálculo para que no quede desfasado.
        grade_regrade_final_grades($examen->course);
        self::log_debug("=== Fin OK: penalización aplicada y gradebook actualizado ===");
    }
}