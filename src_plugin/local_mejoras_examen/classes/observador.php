<?php

namespace local_mejoras_examen;

defined('MOODLE_INTERNAL') || die();

class observador {

    public static function evaluar_intento_ia(\mod_quiz\event\attempt_submitted $evento) {
        global $DB, $CFG;

        $id_intento = $evento->objectid;

        $registro_intento = $DB->get_record('quiz_attempts', ['id' => $id_intento]);
        if (!$registro_intento) {
            return;
        }

        require_once($CFG->dirroot . '/mod/quiz/locallib.php');
        require_once($CFG->dirroot . '/question/engine/lib.php');

        $uso_preguntas = \question_engine::load_questions_usage_by_activity($registro_intento->uniqueid);

        $respuesta_estudiante = '';
        $id_ranura_ensayo = null;
        $calificacion_maxima = 1.0;

        foreach ($uso_preguntas->get_slots() as $ranura) {
            $pregunta = $uso_preguntas->get_question($ranura);
            
            if ($pregunta->qtype->name() === 'essay') {
                $id_ranura_ensayo = $ranura;
                $calificacion_maxima = $uso_preguntas->get_question_max_mark($ranura);
                $paso_intento = $uso_preguntas->get_last_step_with_submitted_data($ranura);
                
                if ($paso_intento->has_qt_var('answer')) {
                    $respuesta_estudiante = $paso_intento->get_qt_var('answer');
                }
                break; 
            }
        }

        if (!empty($respuesta_estudiante) && $id_ranura_ensayo !== null) {
            error_log("Iniciando evaluacion con Gemini IA para la respuesta: " . $respuesta_estudiante);
            
            // Cargar el archivo ignorado por Git
            require_once(__DIR__ . '/../config_ia.php');
            
            $clave_api = CLAVE_API_GEMINI; 
            $url_api = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' . $clave_api;

            // Resto del codigo de la peticion...

            // Se instruye al modelo para devolver exclusivamente un valor numérico
            $instruccion_ia = "Evalúa el siguiente ensayo. Asigna una calificación numérica del 0 al " . $calificacion_maxima . ". Tu respuesta debe contener ÚNICAMENTE el número, utilizando un punto para los decimales, sin texto adicional ni saltos de línea. Ensayo: " . strip_tags($respuesta_estudiante);

            $cuerpo_peticion = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $instruccion_ia]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.1
                ]
            ];

            $opciones_curl = [
                CURLOPT_URL => $url_api,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json'
                ],
                CURLOPT_POSTFIELDS => json_encode($cuerpo_peticion),
                CURLOPT_TIMEOUT => 30
            ];

            $conexion_curl = curl_init();
            curl_setopt_array($conexion_curl, $opciones_curl);
            
            $respuesta_ia = curl_exec($conexion_curl);
            $codigo_estado = curl_getinfo($conexion_curl, CURLINFO_HTTP_CODE);
            $error_curl = curl_error($conexion_curl);
            
            curl_close($conexion_curl);

            if ($codigo_estado === 200) {
                $datos_json = json_decode($respuesta_ia, true);
                if (isset($datos_json['candidates'][0]['content']['parts'][0]['text'])) {
                    
                    $texto_calificacion = trim($datos_json['candidates'][0]['content']['parts'][0]['text']);
                    $calificacion_numerica = (float) $texto_calificacion;
                    
                    // Se restringe matemáticamente el valor a los límites permitidos de la pregunta
                    $calificacion_numerica = max(0, min($calificacion_numerica, $calificacion_maxima));
                    
                    error_log("Calificacion Gemini obtenida: " . $calificacion_numerica);

                    $comentario_profesor = "Calificado automáticamente por Google Gemini.";
                    
                    // Se inyecta la calificación en la ranura específica de la pregunta de ensayo
                    $uso_preguntas->manual_grade($id_ranura_ensayo, $comentario_profesor, $calificacion_numerica, FORMAT_HTML);
                    \question_engine::save_questions_usage_by_activity($uso_preguntas);

                    // Se recalcula la suma total del intento
                    $registro_intento->sumgrades = $uso_preguntas->get_total_mark();
                    $DB->update_record('quiz_attempts', $registro_intento);

                    // Se sincroniza el nuevo resultado con el libro de calificaciones del curso
                    $registro_cuestionario = $DB->get_record('quiz', ['id' => $registro_intento->quiz]);
                    quiz_save_best_grade($registro_cuestionario, $registro_intento->userid);

                } else {
                    error_log("Estructura JSON inesperada de Gemini: " . $respuesta_ia);
                }
            } else {
                error_log("Fallo en Gemini API. HTTP Estado: " . $codigo_estado . " Error: " . $error_curl . " Respuesta: " . $respuesta_ia);
            }

        } else {
            error_log("No se encontro respuesta de ensayo valida en el intento: " . $id_intento);
        }
    }
}