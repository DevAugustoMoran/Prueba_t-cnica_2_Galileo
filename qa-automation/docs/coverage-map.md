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
| 2 | Banco de preguntas: crear preguntas de varios tipos | `tests/02-question-bank.spec.ts` | ✅ |
| 3 | Agregar preguntas al examen (del banco y aleatorias) | `tests/03-add-questions.spec.ts` | ✅ |
| 4 | Configurar opciones de revisión | `tests/04-review-options.spec.ts` | ✅ |
| 5 | Vista previa del examen como profesor | `tests/05-teacher-preview.spec.ts` | ✅ |
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
- **El formulario de configuración del examen colapsa por acordeón todas las
  secciones salvo "General"**: cualquier interacción con `timelimit`,
  `overduehandling`, `graceperiod`, `attempts` o `grademethod` necesita primero
  un click en "Expandir todo" (`QuizSettingsPage.expandirTodasLasSecciones`),
  o falla por timeout esperando visibilidad de un elemento que existe en el DOM
  pero está oculto.
- Los asserts de "aparece en pantalla" usan locators semánticos por rol
  (`getByRole('heading', { level: 1 })`), no selectores CSS por clase: un
  selector como `'h1, .page-header-headings'` puede matchear más de un
  elemento con el mismo texto (Moodle repite el título en el `<h1>` y en su
  contenedor), y Playwright rechaza (correctamente) un locator ambiguo en modo
  estricto.
- Los campos de texto enriquecido (TinyMCE) no se completan con `.fill()` sobre
  el `<textarea>` original (Moodle lo reemplaza visualmente): se interactúa
  directo con el `<iframe id="{campo}_ifr">` que genera TinyMCE, vía
  `src/pages/richTextEditor.ts`.
- La verificación de tipo de pregunta usa el campo oculto `qtype` del propio
  formulario (identificador interno, ej. `multichoice`), no el texto traducido
  del listado del banco -- evita depender del idioma configurado en el sitio.
- Confirmado contra el código fuente real de cada tipo (Moodle 4.3.12) que
  **el campo "respuesta" de Opción múltiple es un editor de texto enriquecido**,
  a diferencia de Respuesta corta y Numérica (donde es un `<input>` simple) --
  es una particularidad real de `qtype_multichoice`, no una inconsistencia del
  código de test.
- **Agregar preguntas al examen usa las acciones documentadas directamente en
  `mod/quiz/edit.php`** (`?addquestion=<id>`, `?addrandom=1&categoryid=...`),
  no el panel lateral dinámico del banco de preguntas embebido en esa
  pantalla. Mismo criterio que con el modal de actividades y el widget de
  filtros: se prioriza la acción real (que sí es scope) sobre la mecánica de
  un selector de UI genérico.
- El conteo de preguntas del examen usa `[id^="mod-indent-outer-slot-"]`
  (confirmado contra `question_slot.mustache`), válido para cualquier tipo de
  pregunta -- incluidas las aleatorias -- sin depender de texto traducido.
- **Opciones de revisión**: los 8 campos × 4 momentos (`{campo}{momento}`,
  confirmado contra `mod_form.php`) tienen dependencias cruzadas vía
  `disabledIf` (ej. `marks{momento}` depende de `maxmarks{momento}`). El test
  usa deliberadamente `maxmarksduring` y `overallfeedbackopen`, los únicos que
  confirmé habilitados contra la instancia real para la configuración actual
  del examen -- **hallazgo real, no documentado en el PHP del formulario**:
  con comportamiento "Retroalimentación diferida", Moodle deshabilita por JS
  casi todos los campos "durante el intento" salvo `maxmarks` (no tiene
  sentido corregir algo que todavía no se calificó); y como el examen no
  tiene fecha de cierre (`timeclose`), deshabilita el grupo completo
  "después de cerrar" -- ninguna de las dos reglas está en el código PHP que
  arma el formulario, son JS que se agrega en runtime según la config
  vigente. `configurarOpcionesRevision` detecta esto y falla con mensaje
  explícito en vez de dejar que el timeout de Playwright oscurezca la causa.
- **Vista previa con examen cronometrado**: `startattempt.php` no arranca el
  intento directo -- primero muestra una pantalla de aviso ("el reloj empieza
  apenas confirmes") con un botón "Comenzar intento" que hay que confirmar.
  `iniciarVistaPrevia` lo maneja de forma tolerante (solo confirma si
  aparece), para que siga funcionando igual en exámenes sin límite de tiempo.
- **La suite se valida con reset completo, no con cleanup idempotente por
  test**: `npm test` dispara `seed:reset` automáticamente (hook `pretest`), así
  que cada corrida real arranca de una base limpia. Los tests individuales no
  intentan "borrar si ya existe" antes de crear -- eso agregaría más UI para
  automatizar (selección, acción masiva, confirmación) sin necesidad, y con
  eso más superficie de fragilidad. Durante desarrollo de un test nuevo,
  `npm run seed` (sin `--reset`) sirve para iterar rápido sobre un archivo
  suelto sin resetear -- pero esas corridas parciales no representan el
  comportamiento real de la suite, que siempre se valida con reset completo.