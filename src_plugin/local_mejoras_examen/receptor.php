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
$escritura_exitosa = file_put_contents(__DIR__ . '/bitacora_webhook.txt', $entrada_bitacora, FILE_APPEND | LOCK_EX);

if ($escritura_exitosa === false) {
    // No se pudo persistir el registro de auditoria (ej. problema de
    // permisos en la carpeta) -- se deja rastro en error_log para que quede
    // visible del lado del servidor, y se responde con error real en vez de
    // "exito" silencioso: si no se pudo guardar la prueba de que se recibio
    // el webhook, quien lo mando deberia reintentar, no asumir que ya quedo
    // resuelto (antes, esta funcion ignoraba el resultado de
    // file_put_contents y siempre respondia 200 sin importar si la
    // escritura habia fallado).
    error_log('receptor.php: no se pudo escribir bitacora_webhook.txt (revisar permisos de la carpeta).');
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(["estado" => "error", "mensaje" => "No se pudo persistir el registro de auditoria."]);
    exit;
}

// Respuesta HTTP 200 de exito
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(["estado" => "exito", "mensaje" => "Carga util recibida y validada correctamente"]);