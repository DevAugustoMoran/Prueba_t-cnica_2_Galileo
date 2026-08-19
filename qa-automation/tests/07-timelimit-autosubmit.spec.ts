import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { QuizSettingsPage, OverdueHandling } from '../src/pages/QuizSettingsPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';

// Scope #7 (enunciado): "Estudiante: límite de tiempo y auto-envío al expirar."
//
// Usa un examen APARTE de "Examen QA E2E" (timelimit de 90s, muy largo para
// esperarlo en un test), con un límite de tiempo corto (8s) para que la
// corrida sea rápida sin dejar de ser un test real de temporizador -- no se
// simula el paso del tiempo, se espera de verdad.
//
// No se responde ni se envía manualmente: se confirma contra el código
// fuente real (mod/quiz/module.js, M.mod_quiz.timer.update) que el propio
// JS del temporizador llama a form.submit() apenas se vence el tiempo, sin
// depender de cron ni de ninguna acción del alumno. El test solo espera a
// que esa navegación automática ocurra.

const TIMELIMIT_SEGUNDOS = 8;

test.describe('Scope 7 · Límite de tiempo y auto-envío al expirar', () => {
  test('el intento se envía solo al vencer el tiempo, sin que el alumno haga nada', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    const cmid = await test.step('Crear un examen dedicado con límite de tiempo corto', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Auto-envío',
        timelimitSeconds: TIMELIMIT_SEGUNDOS,
        overdueHandling: OverdueHandling.Autosubmit,
        attempts: 1,
        reviewOptions: { attemptimmediately: true, correctnessimmediately: true },
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    await alumnoPage.iniciarIntento(cmid);
    await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

    // No respondemos ni enviamos nada -- dejamos correr el reloj.
    await expect(studentPage).toHaveURL(/mod\/quiz\/review\.php/, {
      timeout: (TIMELIMIT_SEGUNDOS + 12) * 1000,
    });
  });
});
