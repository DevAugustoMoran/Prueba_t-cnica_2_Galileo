<?php
define('AJAX_SCRIPT', true);
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

$id_intento = required_param('intento_id', PARAM_INT);

global $DB;

$registro_existente = $DB->get_record('local_mejoras_foco', ['intento_id' => $id_intento]);
$tiempo_actual = time();

if ($registro_existente) {
    $registro_existente->cantidad_perdidas += 1;
    $registro_existente->tiempo_modificacion = $tiempo_actual;
    $DB->update_record('local_mejoras_foco', $registro_existente);
} else {
    $nuevo_registro = new stdClass();
    $nuevo_registro->intento_id = $id_intento;
    $nuevo_registro->cantidad_perdidas = 1;
    $nuevo_registro->tiempo_modificacion = $tiempo_actual;
    $DB->insert_record('local_mejoras_foco', $nuevo_registro);
}

echo json_encode(['estado' => 'exito']);
die();