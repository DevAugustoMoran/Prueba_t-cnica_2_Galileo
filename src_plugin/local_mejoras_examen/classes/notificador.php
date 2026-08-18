<?php
namespace local_mejoras_examen;

defined('MOODLE_INTERNAL') || die();

/**
 * Lógica compartida para el Cambio 3 (notificación de resultado a sistema externo).
 * La usan tanto el intento de envío inmediato (observador::intentar_notificar_resultado,
 * disparado justo cuando la nota queda final) como la tarea de cron
 * (task\procesar_webhooks, que reintenta los envíos que fallaron), para no duplicar
 * la lógica de armado de payload ni de la llamada HTTP en dos lugares distintos.
 */
class notificador {

    /**
     * Arma el payload con datos siempre frescos, releídos de la BD en el momento del
     * envío (no un snapshot congelado de cuando se encoló), y en escalas consistentes.
     */
    public static function construir_carga_util(\stdClass $registro_intento): array {
        global $DB;

        $examen = $DB->get_record('quiz', ['id' => $registro_intento->quiz]);

        // sumgrades es la nota cruda sobre el total de puntos de las preguntas (ej.
        // sobre 2), mientras que quiz_grades.grade está escalada sobre quiz->grade
        // (ej. sobre 10). Enviar ambas sin escalar (ej. "1.8" y "9" para la misma
        // nota) es confuso para el sistema externo. Escalamos nota_intento con la
        // misma fórmula que usa el propio Moodle (quiz_rescale_grade en locallib.php)
        // para que ambos valores sean comparables.
        if ($examen && $examen->sumgrades > 0) {
            $nota_intento_escalada = ((float) $registro_intento->sumgrades) * $examen->grade / $examen->sumgrades;
        } else {
            $nota_intento_escalada = 0.0;
        }

        $registro_nota_final = $DB->get_record('quiz_grades', [
            'quiz' => $registro_intento->quiz,
            'userid' => $registro_intento->userid,
        ]);
        $nota_final = $registro_nota_final ? (float) $registro_nota_final->grade : $nota_intento_escalada;

        return [
            'estudiante_id' => (int) $registro_intento->userid,
            'examen_id'     => (int) $registro_intento->quiz,
            'nota_intento'  => round($nota_intento_escalada, 5),
            'nota_final'    => round($nota_final, 5),
            // timefinish es el momento real en que el alumno entregó el intento: es
            // estable entre reintentos. Usar time() aquí haría que cada reintento de
            // un mismo resultado llevara un timestamp distinto, rompiendo la
            // trazabilidad de "cuándo pasó esto" del lado del sistema externo.
            'timestamp'     => (int) $registro_intento->timefinish,
        ];
    }

    /**
     * Intenta entregar un registro de la cola al endpoint configurado.
     * Actualiza el registro en BD con el resultado. Devuelve true si se entregó.
     */
    public static function enviar(\stdClass $registro_webhook, string $url_destino): bool {
        global $DB;

        $ch = curl_init($url_destino);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $registro_webhook->carga_util);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $respuesta = curl_exec($ch);
        $codigo_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error_curl = curl_error($ch);
        curl_close($ch);

        $registro_webhook->tiempo_modificacion = time();
        $registro_webhook->respuesta_http = $codigo_http;

        $exito = $codigo_http >= 200 && $codigo_http < 300;
        if ($exito) {
            $registro_webhook->estado = 'completado';
            $registro_webhook->registro_error = 'Exito';
        } else {
            $registro_webhook->estado = 'fallido';
            $registro_webhook->reintentos += 1;
            $registro_webhook->registro_error = $error_curl ? "cURL Error: $error_curl" : "HTTP Status: $codigo_http. Resp: $respuesta";
        }

        $DB->update_record('local_mejoras_webhook', $registro_webhook);
        return $exito;
    }
}