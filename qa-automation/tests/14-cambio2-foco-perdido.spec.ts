import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { QuizSettingsPage } from '../src/pages/QuizSettingsPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';

// Cambio 2: "Señal de foco perdido" -- foco.js (lado alumno) registra cada
// vez que la pestaña del examen deja de estar visible durante un intento;
// alerta_profesor.js (lado profesor) muestra un badge "Foco perdido: N" en
// el reporte de resultados por cada intento con infracciones.
//
// La pérdida de foco se simula disparando el mismo evento real que dispara
// foco.js (visibilitychange a "hidden"), no cambiando de pestaña de verdad
// -- ver StudentAttemptPage.simularPerdidaDeFoco().

test.describe('Cambio 2 · Señal de foco perdido', () => {
  test('dos pérdidas de foco durante el intento se reflejan en el reporte de resultados del profesor', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    const cmid = await test.step('Crear un examen dedicado', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Foco',
        attempts: 1,
        reviewOptions: { attemptimmediately: true, correctnessimmediately: true },
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    await test.step('El alumno pierde el foco dos veces durante el intento', async () => {
      await alumnoPage.iniciarIntento(cmid);
      await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

      await alumnoPage.simularPerdidaDeFoco();
      await alumnoPage.simularPerdidaDeFoco();

      await alumnoPage.responderVerdaderoFalso(true);
      await alumnoPage.siguientePagina();
      await alumnoPage.confirmarEnvioDesdeResumen();
    });

    await test.step('El profesor ve el badge de foco perdido en el reporte de resultados', async () => {
      await teacherPage.goto(`/mod/quiz/report.php?id=${cmid}&mode=overview`);

      // Assert real: alerta_profesor.js hace su propio fetch asincrónico al
      // cargar la página -- el badge tarda un instante en aparecer, no está
      // en el HTML inicial.
      await expect(teacherPage.getByText('Foco perdido: 2')).toBeVisible({ timeout: 10_000 });
    });
  });
});
