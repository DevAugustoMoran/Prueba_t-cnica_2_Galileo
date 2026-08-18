import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { QuizSettingsPage } from '../src/pages/QuizSettingsPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';

// Scope #12 (enunciado): "Restricciones de acceso al examen (contraseña,
// ventana de fechas)."
//
// Cada caso usa un examen APARTE y dedicado (no "Examen QA E2E"), para no
// interferir con el resto de la suite y para poder verificar el bloqueo real
// contra una config mínima y controlada.

test.describe('Scope 12 · Restricciones de acceso', () => {
  test('el examen con contraseña bloquea el acceso sin ella y lo permite con la correcta', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const CONTRASENA = 'ClaveExamen123';

    const cmid = await test.step('Crear un examen dedicado con contraseña', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Contraseña',
        password: CONTRASENA,
        attempts: 0,
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    await test.step('Sin contraseña, el intento queda bloqueado', async () => {
      await alumnoPage.iniciarIntento(cmid);
      // Assert real: nunca se llega a la pantalla real del intento.
      await expect(studentPage).not.toHaveURL(/mod\/quiz\/attempt\.php/);
    });

    await test.step('Con la contraseña correcta, el intento arranca', async () => {
      await alumnoPage.iniciarIntento(cmid, { password: CONTRASENA });
      await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });
    });
  });

  test('el examen fuera de la ventana de fechas no ofrece manera de iniciar el intento', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const cmid = await test.step('Crear un examen dedicado que abre recién mañana', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Fecha',
        timeopen: manana,
        attempts: 0,
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    await test.step('El alumno no tiene forma de iniciar el intento', async () => {
      await studentPage.goto(`/mod/quiz/view.php?id=${cmid}`);

      // Assert real: no existe ningún link ni formulario hacia
      // startattempt.php en la página -- no depende de ningún texto
      // traducido, verifica directamente que el mecanismo de inicio de
      // intento no está disponible.
      await expect(
        studentPage.locator('a[href*="startattempt.php"], form[action*="startattempt.php"]')
      ).toHaveCount(0);
    });
  });
});
