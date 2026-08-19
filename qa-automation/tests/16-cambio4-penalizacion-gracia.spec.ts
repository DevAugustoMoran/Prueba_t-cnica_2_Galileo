import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { QuizSettingsPage, OverdueHandling } from '../src/pages/QuizSettingsPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';

// Cambio 4: "Penalización por período de gracia" -- si un intento se envía
// después del límite de tiempo pero todavía dentro del período de gracia,
// se le aplica una deducción porcentual (configurable, default 10%) a la
// nota, y queda documentado en la retroalimentación de la calificación.
//
// El límite de tiempo es corto (5s) para que la corrida sea rápida, y el
// período de gracia generoso (2 minutos) para que responder y enviar
// manualmente tenga margen de sobra sin correr contra el auto-envío.
//
// No se asume el porcentaje exacto de la deducción (es una config de sitio,
// configurable) -- se verifica la estructura real del mensaje que arma el
// propio plugin, no traducida (texto propio, no de Moodle), confirmada
// contra classes/observador.php.

const TIMELIMIT_SEGUNDOS = 5;

test.describe('Cambio 4 · Penalización por período de gracia', () => {
  test('el intento enviado tarde, dentro de la gracia, queda con la nota penalizada y su retroalimentación', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    const cmid = await test.step('Crear un examen dedicado con límite corto y período de gracia', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Gracia',
        timelimitSeconds: TIMELIMIT_SEGUNDOS,
        overdueHandling: OverdueHandling.GracePeriod,
        graceperiodSeconds: 120,
        attempts: 1,
        reviewOptions: { attemptimmediately: true, correctnessimmediately: true, maxmarksopen: true, marksopen: true },
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    await test.step('El alumno responde antes de que venza el tiempo, pero envía después', async () => {
      await alumnoPage.iniciarIntento(cmid);
      await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

      // Responder ya, mientras el tiempo sigue corriendo -- la penalización
      // es por CUÁNDO SE ENVÍA, no por cuándo se responde.
      await alumnoPage.responderVerdaderoFalso(true);

      // Esperar a que venza el límite de tiempo (con margen), mientras se
      // sigue bien dentro del período de gracia de 120s.
      await studentPage.waitForTimeout((TIMELIMIT_SEGUNDOS + 3) * 1000);

      // El propio JS del temporizador puede haber navegado solo a la
      // pantalla de resumen durante la espera (mismo mecanismo confirmado
      // para el auto-envío de scope #7) -- ahí ya no existe el botón
      // "Siguiente", así que solo se clickea si todavía hace falta.
      if (!/mod\/quiz\/summary\.php/.test(studentPage.url())) {
        await alumnoPage.siguientePagina();
      }
      await alumnoPage.confirmarEnvioDesdeResumen();
    });

    await test.step('La retroalimentación de la nota documenta la penalización aplicada', async () => {
      await studentPage.goto(`/grade/report/user/index.php?id=${courseId}`);

      // Assert real: el mensaje real que arma el plugin (texto propio, no
      // traducido) aparece en la vista de calificaciones del alumno --
      // confirma que la penalización se aplicó de verdad, no solo que la
      // nota "dio distinto" por alguna otra razón.
      await expect(studentPage.getByText('Se aplicó una deducción del')).toBeVisible({
        timeout: 10_000,
      });
      await expect(studentPage.getByText('% por entrega tardía')).toBeVisible();
    });
  });
});
