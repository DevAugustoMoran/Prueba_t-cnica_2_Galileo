<?php
/**
 * Siembra los datos base necesarios para correr la suite de QA automatizado:
 * un curso, y las cuentas de profesor y alumno ya matriculadas con su rol.
 *
 * Deliberadamente NO crea el examen, las preguntas del banco, ni las configura --
 * eso es justamente lo que cubren los tests de Playwright como parte del scope
 * que están verificando (scope #1-4: crear/configurar examen, banco de preguntas,
 * agregar preguntas, opciones de revisión). Sembrarlo acá sería simular el propio
 * comportamiento que se supone que hay que probar.
 *
 * Es idempotente: correrlo varias veces sin --reset reutiliza lo que ya existe.
 * Con --reset, borra el curso (si existe) y lo vuelve a crear desde cero, para
 * garantizar una corrida limpia y reproducible antes de cada ejecución de la suite.
 *
 * Uso:
 *   php local/qa_seed/cli/reset_y_seed.php            # crea si no existe, reutiliza si existe
 *   php local/qa_seed/cli/reset_y_seed.php --reset     # borra y vuelve a crear desde cero
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->libdir . '/enrollib.php');
require_once($CFG->libdir . '/clilib.php');

list($opciones, $inesperados) = cli_get_params(
    ['reset' => false, 'help' => false],
    ['h' => 'help']
);

if ($opciones['help']) {
    cli_writeln("Uso: php reset_y_seed.php [--reset]");
    exit(0);
}

$reset = (bool) $opciones['reset'];

// Estos valores deben coincidir con qa-automation/.env (COURSE_SHORTNAME,
// TEACHER_USERNAME/PASSWORD, STUDENT_USERNAME/PASSWORD).
const QA_SHORTNAME = 'QA-AUTOMATION';
const QA_FULLNAME = 'Curso de QA Automatizado';
const QA_PASSWORD = 'ClaveSegura123!';

cli_writeln('=== Seed de datos base para QA ===');

// --- Curso ---
$curso_existente = $DB->get_record('course', ['shortname' => QA_SHORTNAME]);
if ($curso_existente && $reset) {
    cli_writeln('Curso existente encontrado, se elimina para reiniciar (--reset)...');
    delete_course($curso_existente, false);
    $curso_existente = null;
}

if (!$curso_existente) {
    cli_writeln('Creando curso "' . QA_SHORTNAME . '"...');
    $datos_curso = new stdClass();
    $datos_curso->fullname = QA_FULLNAME;
    $datos_curso->shortname = QA_SHORTNAME;
    $datos_curso->category = 1;
    $datos_curso->summary = 'Curso reservado para la suite de QA automatizado. No usar para datos reales.';
    $datos_curso->format = 'topics';
    $datos_curso->numsections = 3;
    $datos_curso->startdate = time() - DAYSECS; // Ayer, para que no interfiera con restricciones por fecha.
    $curso = create_course($datos_curso);
} else {
    cli_writeln('Curso "' . QA_SHORTNAME . '" ya existe, se reutiliza (id=' . $curso_existente->id . ').');
    $curso = $curso_existente;
}

// --- Usuarios ---
function qa_obtener_o_crear_usuario(string $username, string $nombre, string $apellido, string $password): stdClass {
    global $CFG, $DB;

    $usuario = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
    if ($usuario) {
        $usuario->password = $password;
        $usuario->firstname = $nombre;
        $usuario->lastname = $apellido;
        // Forzado en cada reset, no solo en la creación: si esta cuenta se
        // creó alguna vez con el sitio en inglés (antes de que existiera el
        // fix de idioma), la preferencia queda grabada en el usuario y
        // persiste para siempre -- ningún cambio posterior al idioma del
        // sitio la corrige sola, porque una preferencia de usuario ya
        // guardada pisa el default del sitio.
        $usuario->lang = 'es';
        user_update_user($usuario, true, false);
        cli_writeln('Usuario "' . $username . '" ya existía, se actualizó.');
        return $DB->get_record('user', ['id' => $usuario->id]);
    }

    $nuevo = new stdClass();
    $nuevo->username = $username;
    $nuevo->password = $password;
    $nuevo->firstname = $nombre;
    $nuevo->lastname = $apellido;
    $nuevo->email = $username . '@qa-automation.test';
    $nuevo->confirmed = 1;
    $nuevo->mnethostid = $CFG->mnet_localhost_id;
    $nuevo->auth = 'manual';
    $nuevo->lang = 'es';
    $id = user_create_user($nuevo, true, false);
    cli_writeln('Usuario "' . $username . '" creado (id=' . $id . ').');
    return $DB->get_record('user', ['id' => $id]);
}

$profesor = qa_obtener_o_crear_usuario('qa_profesor', 'Profesor', 'QA', QA_PASSWORD);
$estudiante = qa_obtener_o_crear_usuario('qa_estudiante', 'Estudiante', 'QA', QA_PASSWORD);

// --- Matrícula con el rol correspondiente ---
function qa_matricular(int $courseid, stdClass $usuario, string $rolshortname): void {
    global $DB;

    $rol = $DB->get_record('role', ['shortname' => $rolshortname], '*', MUST_EXIST);
    $context = context_course::instance($courseid);

    if (is_enrolled($context, $usuario)) {
        cli_writeln('  "' . $usuario->username . '" ya estaba matriculado.');
        return;
    }

    enrol_try_internal_enrol($courseid, $usuario->id, $rol->id);
    cli_writeln('  "' . $usuario->username . '" matriculado como ' . $rolshortname . '.');
}

cli_writeln('Matriculando usuarios en el curso...');
qa_matricular($curso->id, $profesor, 'editingteacher');
qa_matricular($curso->id, $estudiante, 'student');

cli_writeln('=== Seed completo ===');
cli_writeln('courseid=' . $curso->id);
cli_writeln('shortname=' . QA_SHORTNAME);
cli_writeln('profesor: username=qa_profesor password=' . QA_PASSWORD);
cli_writeln('estudiante: username=qa_estudiante password=' . QA_PASSWORD);