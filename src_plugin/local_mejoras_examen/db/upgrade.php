<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_local_mejoras_examen_upgrade($oldversion) {
    global $DB;
    $dbman = $DB->get_manager();

    if ($oldversion < 2026082000) {

        $table = new xmldb_table('local_mejoras_webhook');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('intento_id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('carga_util', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('estado', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'pendiente');
        $table->add_field('reintentos', XMLDB_TYPE_INTEGER, '4', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('respuesta_http', XMLDB_TYPE_INTEGER, '4', null, null, null, null);
        $table->add_field('registro_error', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('tiempo_creacion', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('tiempo_modificacion', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2026082000, 'local', 'mejoras_examen');
    }

    return true;
}