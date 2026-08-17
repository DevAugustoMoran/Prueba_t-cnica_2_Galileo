<?php
namespace local_mejoras_examen\task;

defined('MOODLE_INTERNAL') || die();

class procesar_webhooks extends \core\task\scheduled_task {
    
    public function get_name() {
        return 'Procesar envíos de resultados a sistema externo';
    }

    public function execute() {
        global $DB;

        // Se verifica la existencia del endpoint configurado por el administrador
        $url_destino = get_config('local_mejoras_examen', 'webhook_url');
        if (empty($url_destino)) {
            mtrace("Endpoint no configurado. Se omite la ejecucion.");
            return;
        }

       // Se utiliza la funcion nativa get_records para evitar errores de sintaxis SQL directa
        $registros = $DB->get_records_select(
            'local_mejoras_webhook', 
            "estado IN (:estado1, :estado2) AND reintentos < :maxreintentos", 
            ['estado1' => 'pendiente', 'estado2' => 'fallido', 'maxreintentos' => 5]
        );

        if (empty($registros)) {
            mtrace("No se encontraron envios pendientes en la cola.");
            return;
        }

        foreach ($registros as $registro) {
            mtrace("Procesando intento ID: " . $registro->intento_id);

            // Inicializacion de peticion cURL
            $ch = curl_init($url_destino);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $registro->carga_util);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Accept: application/json'
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);

            $respuesta = curl_exec($ch);
            $codigo_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error_curl = curl_error($ch);
            curl_close($ch);

            // Actualizacion de metadatos de auditoria
            $registro->tiempo_modificacion = time();
            $registro->respuesta_http = $codigo_http;

            // Evaluacion del codigo de estado para determinar el exito o fallo
            if ($codigo_http >= 200 && $codigo_http < 300) {
                $registro->estado = 'completado';
                $registro->registro_error = 'Exito';
                mtrace(" -> Envio exitoso. HTTP {$codigo_http}.");
            } else {
                $registro->estado = 'fallido';
                $registro->reintentos += 1;
                $registro->registro_error = $error_curl ? "cURL Error: $error_curl" : "HTTP Status: $codigo_http. Resp: $respuesta";
                mtrace(" -> Envio fallido. HTTP {$codigo_http}. Reintento #" . $registro->reintentos);
            }

            // Persistencia del estado actualizado
            $DB->update_record('local_mejoras_webhook', $registro);
        }
    }
}