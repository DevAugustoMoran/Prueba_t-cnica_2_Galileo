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

            // Releemos el intento en tiempo real: no confiamos en ningún snapshot
            // congelado, porque para preguntas de ensayo la nota todavía no existe al
            // encolar, y porque la penalización del período de gracia (Cambio 4) puede
            // aplicarse en cualquier momento antes de este reintento.
            $registro_intento = $DB->get_record('quiz_attempts', ['id' => $registro->intento_id]);
            if (!$registro_intento) {
                mtrace(" -> El intento ya no existe. Se marca como fallido sin reintentar.");
                $registro->estado = 'fallido';
                $registro->registro_error = 'El intento fue eliminado antes de poder notificarse.';
                $registro->tiempo_modificacion = time();
                $DB->update_record('local_mejoras_webhook', $registro);
                continue;
            }

            // sumgrades es NULL (no 0) mientras falte calificación manual (preguntas de
            // ensayo). Si todavía no está lista, esperamos al próximo ciclo de cron sin
            // gastar reintentos ni marcar el envío como fallido: no es un fallo de red,
            // es que la nota real todavía no existe.
            if ($registro_intento->sumgrades === null) {
                mtrace(" -> El intento todavía requiere calificación manual. Se reintentará más adelante.");
                continue;
            }

            $registro->carga_util = json_encode(\local_mejoras_examen\notificador::construir_carga_util($registro_intento));
            $exito = \local_mejoras_examen\notificador::enviar($registro, $url_destino);

            if ($exito) {
                mtrace(" -> Envio exitoso. HTTP {$registro->respuesta_http}.");
            } else {
                mtrace(" -> Envio fallido. HTTP {$registro->respuesta_http}. Reintento #" . $registro->reintentos);
            }
        }
    }
}