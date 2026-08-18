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
| 6 | Estudiante: iniciar intento, responder, navegar, marcar para revisar | `tests/06-student-attempt-flow.spec.ts` | ✅ |
| 7 | Estudiante: límite de tiempo y auto-envío al expirar | `tests/07-timelimit-autosubmit.spec.ts` | ✅ |
| 8 | Estudiante: enviar el intento | `tests/06-student-attempt-flow.spec.ts` (mismo flujo que #6) | ✅ |
| 9 | Calificación automática y visualización del resultado | `tests/06-student-attempt-flow.spec.ts` (mismo flujo que #6) | ✅ |
| 10 | Profesor: ver intentos, calificar manualmente (ensayo), recalificar | `tests/10-manual-grading.spec.ts` | ✅ |
| 11 | Profesor: override de notas y reportes del examen | `tests/11-grade-override-reports.spec.ts` | ✅ |
| 12 | Restricciones de acceso (contraseña, ventana de fechas) | `tests/12-access-restrictions.spec.ts` | ✅ |

## Los 4 cambios del mes

| Cambio | Test(s) | Estado |
|---|---|---|
| 1 · Sugerencia de calificación con IA | `tests/13-cambio1-asistente-ia.spec.ts` | ✅ |
| 2 · Señal de integridad por pérdida de foco | `tests/14-cambio2-foco-perdido.spec.ts` | ✅ |
| 3 · Notificación de resultado a sistema externo | `tests/15-cambio3-webhook.spec.ts` | ✅ |
| 4 · Penalización por entrega en período de gracia | `tests/16-cambio4-penalizacion-gracia.spec.ts` | ✅ |

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
  `iniciarVistaPrevia` (y, del lado del alumno, `StudentAttemptPage.iniciarIntento`)
  lo manejan de forma tolerante (solo confirman si aparece), para que sigan
  funcionando igual en exámenes sin límite de tiempo.
- **Contenedor de cada pregunta durante el intento**: `<div class="que {tipo}
  ...">` (confirmado contra `question/engine/renderer.php`), con `{tipo}` =
  multichoice/truefalse/shortanswer/numerical/match/essay. `StudentAttemptPage`
  detecta el tipo de la pregunta actual por esta clase, no por su posición ni
  por texto traducido -- funciona igual sin importar qué haya salido sorteado
  entre las preguntas aleatorias (scope #3).
- **Verificación de respuesta correcta** usa las clases CSS
  `correct`/`partiallycorrect`/`incorrect` que Moodle agrega al mismo
  contenedor `.que` tras calificar (confirmado contra
  `question/engine/states.php`), no un texto traducido.
- **Envío final del intento requiere DOS clicks**, no uno: el botón real
  dispara un handler JS que siempre intercepta el click (`preventDefault`) y
  abre un modal de confirmación cuyo botón reutiliza el mismo texto
  (`get_string('submitallandfinish', 'quiz')` se usa para los dos --
  confirmado contra `mod_quiz/amd/src/submission_confirmation.js`). Un solo
  click deja el modal abierto sin enviar nada.
- **El auto-envío por límite de tiempo (scope #7) es 100% del lado del
  cliente**, confirmado contra `mod/quiz/module.js`
  (`M.mod_quiz.timer.update`): cuando el tiempo restante es negativo, el
  propio JS hace `form.submit()` directo, sin depender de cron ni de ninguna
  tarea programada. El test usa un examen aparte con límite de 8 segundos
  (no los 90s de "Examen QA E2E") para que la corrida sea rápida sin dejar
  de esperar el vencimiento real.
- **El control de "marcar para revisar" es un botón toggle, no un
  checkbox**: `question/engine/renderer.php` documenta un
  `<input type="checkbox" class="questionflag">` como mecanismo genérico del
  motor de preguntas, pero en la pantalla real del intento (Moodle 4.3.12),
  `mod_quiz` usa su propio `<button aria-pressed="...">` -- discrepancia real
  entre el código PHP consultado y el comportamiento efectivo, encontrada
  recién al correr contra la instancia real, no legible desde el código
  fuente por sí solo.
- **Calificación manual**: la interfaz vive en
  `mod/quiz/report.php?mode=grading`, con un formulario de id estable
  `#manualgradingform` (confirmado contra
  `mod/quiz/report/grading/renderer.php`). Los campos de nota y comentario
  usan el mismo patrón dinámico `q{usageid}:{slot}_-mark` /
  `q{usageid}:{slot}_-comment` que las respuestas del alumno (confirmado
  contra `question/behaviour/rendererbase.php`), así que se ubican por
  selector de atributo "contiene", no por id completo. La pregunta a
  calificar se identifica por su nombre real en la fila de la tabla índice,
  no por slot/questionid (dinámicos según qué preguntas tenga cada examen).
- **Override de notas** se hace vía el Informe del calificador
  (`grade/report/grader/`), no dentro del examen: escribir directo sobre la
  celda de nota calculada y guardar es, por definición en Moodle, lo que
  protege esa nota de recálculos automáticos futuros. Funciona sin activar
  nada porque "Calificación rápida" (`quickgrading`) viene habilitada por
  defecto a nivel de sitio (confirmado contra
  `grade/report/grader/settings.php`: `admin_setting_configcheckbox(...,
  1)`). El botón de guardar tiene id estable `#gradersubmit`.
- Los reportes de "Respuestas" y "Estadísticas" del examen usan el mismo
  patrón `mod/quiz/report.php?mode=...` que "Calificación manual", con
  `responses`/`statistics` como nombre de modo (confirmado por los
  directorios reales de esos plugins de reporte).
- **Restricciones de acceso**: el campo de contraseña (`quizpassword`) aparece
  con el mismo nombre tanto en la configuración del examen como en el
  formulario de verificación previa al iniciar el intento (confirmado contra
  `mod/quiz/accessrule/password/rule.php`) -- Moodle combina todos los
  chequeos previos que correspondan (contraseña, aviso de límite de tiempo,
  etc.) en un único formulario, por eso `StudentAttemptPage.iniciarIntento`
  completa la contraseña si el campo está presente, antes de confirmar. Los
  campos de fecha (`timeopen`/`timeclose`) son grupos de selects
  día/mes/año/hora/minuto con valores numéricos (confirmado contra
  `lib/form/dateselector.php` y `datetimeselector.php`), no dependen del
  idioma del sitio -- salvo el de minuto, limitado a pasos de 5. El bloqueo
  por fecha se verifica de forma estructural (ausencia de cualquier link o
  formulario hacia `startattempt.php` en la página), no por mensaje
  traducido.
- **Cambio 1 (asistente de IA)**: la llamada real a `ajax_ia.php` (que a su
  vez llama a la API de Gemini) se intercepta con `page.route()` y se
  responde con datos simulados -- la suite no debe depender de gastar cuota
  de API real ni de la variabilidad de una IA en cada corrida. Se verifica
  tanto que el resultado mockeado se refleje en el panel como que el propio
  campo de nota del formulario de calificación quede precargado, y que la
  petición saliente haya llevado el contenido real de la pregunta (no un
  valor genérico).
- **Cambio 2 (pérdida de foco)**: la pérdida de foco se simula
  sobreescribiendo `document.visibilityState` a `"hidden"` y disparando
  `visibilitychange` manualmente vía `page.evaluate()`, en vez de cambiar de
  pestaña de verdad (poco confiable en automatización) -- dispara el mismo
  código real de `foco.js`. Se verifica tanto el registro del lado del
  alumno como el badge "Foco perdido: N" que `alerta_profesor.js` agrega en
  el reporte de resultados del profesor (ese script hace su propio fetch
  asincrónico al cargar la página, así que el badge no está en el HTML
  inicial).
- **Cambio 3 (webhook)**: no hay ninguna pantalla de Moodle que muestre "se
  mandó el webhook" -- el efecto es una llamada HTTP servidor-a-servidor. Se
  verifica leyendo directo por HTTP la bitácora que arma `receptor.php`
  (vive en una carpeta pública del plugin, `bitacora_webhook.txt`, accesible
  sin sesión). OJO: ese archivo vive en el filesystem, no en la base de
  datos, así que un reset de curso NO lo vacía -- por eso nunca se verifica
  "tiene contenido" a secas, sino que haya crecido respecto a un snapshot
  tomado antes del envío, y que lo nuevo agregado incluya la fecha de hoy
  (confirma que es una entrada de esta corrida, no una vieja).
- **Cambio 4 (penalización por gracia)**: usa un examen con límite de tiempo
  corto (5s) y período de gracia generoso (120s) -- el alumno responde antes
  de que venza el tiempo pero envía después, dentro de la gracia. No se
  asume el porcentaje exacto de la deducción (`penalizacion_gracia` es una
  config de sitio) -- se verifica la estructura real del mensaje que arma el
  propio plugin (texto propio, no traducido por Moodle, confirmado contra
  `classes/observador.php`), visible en la vista de calificaciones del
  propio alumno.
- **La suite se valida con reset completo, no con cleanup idempotente por
  test**: `npm test` dispara `seed:reset` automáticamente (hook `pretest`), así
  que cada corrida real arranca de una base limpia. Los tests individuales no
  intentan "borrar si ya existe" antes de crear -- eso agregaría más UI para
  automatizar (selección, acción masiva, confirmación) sin necesidad, y con
  eso más superficie de fragilidad. Durante desarrollo de un test nuevo,
  `npm run seed` (sin `--reset`) sirve para iterar rápido sobre un archivo
  suelto sin resetear -- pero esas corridas parciales no representan el
  comportamiento real de la suite, que siempre se valida con reset completo.
