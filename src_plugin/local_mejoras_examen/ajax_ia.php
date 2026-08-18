<?php
require_once('../../config.php');

// config_ia.php contiene la clave real de la API de Gemini y está en
// .gitignore a propósito (no se debe subir una clave de API a un repo) --
// así que en un clon nuevo del repo, este archivo directamente no existe.
// require_once sobre un archivo inexistente tira un error fatal de PHP, así
// que se chequea la existencia primero para degradar de forma prolija al
// mismo mensaje informativo que ya estaba previsto para cuando el archivo
// existe pero la constante no está definida.
$archivo_config_ia = __DIR__ . '/config_ia.php';
if (file_exists($archivo_config_ia)) {
    require_once($archivo_config_ia);
}

require_login();

header('Content-Type: application/json');

// Captura de datos provenientes del formulario
$pregunta = required_param('pregunta', PARAM_RAW);
$respuesta_estudiante = required_param('respuesta', PARAM_RAW);
$nota_maxima = optional_param('nota_maxima', 1.0, PARAM_FLOAT);

// Validacion de la existencia de la constante
if (!defined('CLAVE_API_GEMINI') || empty(CLAVE_API_GEMINI)) {
    echo json_encode([
        'nota_sugerida' => 0,
        'comentario_sugerido' => 'Error: La constante CLAVE_API_GEMINI no se encuentra definida en config_ia.php.'
    ]);
    exit;
}

$clave_api = CLAVE_API_GEMINI;

// Endpoint oficial de la API apuntando al modelo gemini-3.1-flash-lite
$url_gemini = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=" . $clave_api;

// Instrucciones para forzar a la IA a devolver un JSON estandarizado
$instruccion = "Eres un asistente de calificación académica para profesores.
Pregunta del examen: " . $pregunta . "
Respuesta del estudiante: " . $respuesta_estudiante . "
Nota máxima posible: " . $nota_maxima . "

Evalúa la calidad de la respuesta del estudiante basándote en la pregunta.
Proporciona una nota sugerida (número decimal, máximo " . $nota_maxima . ") y un breve comentario de retroalimentación constructiva para el estudiante.
IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido, sin formato Markdown ni etiquetas de bloque de código. La estructura exacta debe ser:
{
  \"nota_sugerida\": 0.0,
  \"comentario_sugerido\": \"Tu comentario justificado aquí\"
}";

// Construccion de la estructura de la peticion requerida por la API
$cuerpo_peticion = [
    "contents" => [
        [
            "parts" => [
                ["text" => $instruccion]
            ]
        ]
    ]
];

// Inicializacion y ejecucion de la peticion HTTP
$ch = curl_init($url_gemini);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($cuerpo_peticion));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$respuesta_cruda = curl_exec($ch);
$codigo_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error_curl = curl_error($ch);
curl_close($ch);

// Procesamiento de la respuesta generada por el modelo
if ($codigo_http >= 200 && $codigo_http < 300 && $respuesta_cruda) {
    $datos_respuesta = json_decode($respuesta_cruda, true);
    
    if (isset($datos_respuesta['candidates'][0]['content']['parts'][0]['text'])) {
        $texto_generado = $datos_respuesta['candidates'][0]['content']['parts'][0]['text'];
        
        // Limpieza de posibles formatos markdown introducidos por el modelo
        $texto_generado = str_replace(['```json', '```'], '', $texto_generado);
        $json_limpio = json_decode(trim($texto_generado), true);
        
        if ($json_limpio && isset($json_limpio['nota_sugerida']) && isset($json_limpio['comentario_sugerido'])) {
            echo json_encode([
                'nota_sugerida' => (float)$json_limpio['nota_sugerida'],
                'comentario_sugerido' => trim($json_limpio['comentario_sugerido'])
            ]);
            exit;
        }
    }
}

// Emision de error en caso de fallo en la integracion o parseo incorrecto
echo json_encode([
    'nota_sugerida' => 0,
    'comentario_sugerido' => 'Error al generar la sugerencia. Código HTTP: ' . $codigo_http . '. Reintente la operación.'
]);