# Mapa de cobertura

Este documento cruza cada ítem del scope pedido en el enunciado contra el archivo
de test que lo cubre. Se actualiza a medida que se agregan tests (entregable #4).

Leyenda: ✅ implementado y verificado contra la instancia real · 🚧 en construcción
(este documento se genera junto con el código, no después) · ⛔ excluido (con
justificación).

## Scope del módulo Quiz

| # | Ítem del scope | Test(s) | Estado |
|---|---|---|---|
| 1 | Crear y configurar un examen (timing, intentos, método de calificación) | `tests/01-quiz-setup.spec.ts` | ✅ |
| 2 | Banco de preguntas: crear preguntas de varios tipos | `tests/02-question-bank.spec.ts` | 🚧 |
| 3 | Agregar preguntas al examen (del banco y aleatorias) | `tests/03-add-questions.spec.ts` | 🚧 |
| 4 | Configurar opciones de revisión | `tests/04-review-options.spec.ts` | 🚧 |
| 5 | Vista previa del examen como profesor | `tests/05-teacher-preview.spec.ts` | 🚧 |
| 6 | Estudiante: iniciar intento, responder, navegar, marcar para revisar | `tests/06-student-attempt-flow.spec.ts` | 🚧 |
| 7 | Estudiante: límite de tiempo y auto-envío al expirar | `tests/07-timelimit-autosubmit.spec.ts` | 🚧 |
| 8 | Estudiante: enviar el intento | `tests/06-student-attempt-flow.spec.ts` (mismo flujo que #6) | 🚧 |
| 9 | Calificación automática y visualización del resultado | `tests/09-autograding-results.spec.ts` | 🚧 |
| 10 | Profesor: ver intentos, calificar manualmente (ensayo), recalificar | `tests/10-manual-grading.spec.ts` | 🚧 |
| 11 | Profesor: override de notas y reportes del examen | `tests/11-grade-override-reports.spec.ts` | 🚧 |
| 12 | Restricciones de acceso (contraseña, ventana de fechas) | `tests/12-access-restrictions.spec.ts` | 🚧 |

## Los 4 cambios del mes

| Cambio | Test(s) | Estado |
|---|---|---|
| 1 · Sugerencia de calificación con IA | `tests/change1-ai-grading-suggestion.spec.ts` | 🚧 |
| 2 · Señal de integridad por pérdida de foco | `tests/change2-focus-loss.spec.ts` | 🚧 |
| 3 · Notificación de resultado a sistema externo | `tests/change3-webhook-notification.spec.ts` | 🚧 |
| 4 · Penalización por entrega en período de gracia | `tests/change4-grace-penalty.spec.ts` | 🚧 |

## Notas de diseño que afectan la cobertura

- **Selección de actividad vía URL directa, no vía el modal selector**
  (`CoursePage.gotoAddQuizForm`): el modal de "Agregar actividad o recurso" es UI
  genérica de Moodle (igual para cualquier módulo), no específica del sistema de
  exámenes. Se prioriza ejercitar el formulario real de configuración del examen
  (que sí es scope) sobre la mecánica de apertura del modal (que no lo es).
- **Selectores por id de campo del formulario (`#id_timelimit_number`, etc.), no
  por texto traducido**: los ids que genera Moodle a partir del nombre interno
  del campo son estables entre idiomas y entre versiones menores. Confirmados
  contra el código fuente real de Moodle 4.3.12 (`mod/quiz/mod_form.php`,
  `lib/form/duration.php`), no adivinados.
- Los campos de duración (`timelimit`, `graceperiod`) se completan siempre en la
  unidad "segundos" (value `1` del select de unidad) para que el valor numérico
  que viaja al form sea exactamente el pedido, sin conversión.
