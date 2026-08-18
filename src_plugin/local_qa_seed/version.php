<?php
defined('MOODLE_INTERNAL') || die();

// Plugin exclusivo para la suite de QA automatizado: siembra (y opcionalmente
// reinicia) los datos base -- curso, cuentas de profesor y alumno, matrícula --
// necesarios para que los tests de Playwright corran de forma reproducible.
// No forma parte de los 4 cambios del mes; es infraestructura de testing.
$plugin->component = 'local_qa_seed';
$plugin->version   = 2026081900;
$plugin->requires  = 2022041200; // Moodle 4.0+, compatible con 4.3.
$plugin->maturity  = MATURITY_ALPHA;
$plugin->release   = 'v1.0.0';
