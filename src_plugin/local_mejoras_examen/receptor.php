<?php
// Captura del cuerpo de la peticion en formato JSON
$json_recibido = file_get_contents('php://input');
$datos_decodificados = json_decode($json_recibido, true);

// Bloque de codigo opcional para simular intermitencia de red (1 de cada 3 peticiones falla)
// Para probar la resiliencia de la cola, se debe descomentar este bloque
/*
if (rand(1, 3) === 1) {
    http_response_code(500);
    echo json_encode(["error" => "Fallo interno simulado del servidor"]);
    exit;
}
*/

// Registro de la carga util en un archivo de texto local para auditoria
$entrada_bitacora = date('Y-m-d H:i:s') . " - Datos recibidos:\n" . print_r($datos_decodificados, true) . "\n-----------------\n";
file_put_contents(__DIR__ . '/bitacora_webhook.txt', $entrada_bitacora, FILE_APPEND);

// Respuesta HTTP 200 de exito
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(["estado" => "exito", "mensaje" => "Carga util recibida y validada correctamente"]);