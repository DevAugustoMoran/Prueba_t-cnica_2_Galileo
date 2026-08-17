<?php
define('AJAX_SCRIPT', true);
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

$ids_intentos = required_param('ids', PARAM_SEQUENCE);

global $DB;
$focos = [];

if (!empty($ids_intentos)) {
    // Sanitizar y asegurar que los IDs sean una lista numérica limpia
    $ids_seguros = array_map('intval', explode(',', $ids_intentos));
    list($sql_in, $parametros) = $DB->get_in_or_equal($ids_seguros, SQL_PARAMS_QM);

    // Consulta SQL estructurada correctamente: 
    // 1. La primera columna DEBE ser la llave primaria 'id' para cumplir con Moodle.
    // 2. Se seleccionan 'intento_id' y 'cantidad_perdidas'.
    $sql = "SELECT id, intento_id, cantidad_perdidas FROM {local_mejoras_foco} WHERE intento_id $sql_in";
    
    $registros = $DB->get_records_sql($sql, $parametros);
    
    if ($registros) {
        foreach ($registros as $registro) {
            // Mapeamos el ID del intento con su respectiva cantidad de pérdidas
            $focos[$registro->intento_id] = (int)$registro->cantidad_perdidas;
        }
    }
}

echo json_encode($focos);
die();