import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { GradingPage } from '../src/pages/GradingPage';
import { config } from '../src/config';

// Scope #10 (enunciado): "Profesor: ver intentos, calificar manualmente
// (ensayo), recalificar."
//
// Depende de un intento ya enviado con "QA - Ensayo" sin calificar --
// scope #6-9 lo dejó exactamente así: el motor de preguntas nunca resuelve
// solo una pregunta de ensayo, siempre requiere intervención manual.

test.describe('Scope 10 · Calificar manualmente y recalificar', () => {
  test('el profesor califica la pregunta de ensayo y luego la recalifica con una nota distinta', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const gradingPage = new GradingPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    await test.step('Calificar la pregunta de ensayo por primera vez', async () => {
      await gradingPage.abrirCalificacionPorNombre(cmid, 'QA - Ensayo');
      await gradingPage.calificar('1', 'Buena respuesta, completa y clara.');

      // Assert real: al no quedar más intentos pendientes de calificar,
      // Moodle redirige de vuelta al índice (confirmado contra el código:
      // "redirect($this->list_questions_url(), 'alldoneredirecting')").
      await expect(teacherPage).toHaveURL(/mode=grading/, { timeout: 15_000 });
      expect(teacherPage.url()).not.toContain('slot=');
    });

    await test.step('Recalificar la misma pregunta con una nota distinta', async () => {
      await gradingPage.abrirCalificacionPorNombre(cmid, 'QA - Ensayo');

      // Assert real: al reabrir la pregunta ya calificada, el campo de nota
      // trae precargado el valor anterior (1) -- confirma que la primera
      // calificación sí quedó guardada, antes de sobreescribirla.
      await expect(teacherPage.locator('input[id*="-mark"]')).toHaveValue('1');

      await gradingPage.calificar('0.5', 'Revisando de nuevo: la respuesta es más breve de lo esperado.');
    });

    await test.step('La nueva nota queda persistida (verificación independiente)', async () => {
      await gradingPage.abrirCalificacionPorNombre(cmid, 'QA - Ensayo');
      await expect(teacherPage.locator('input[id*="-mark"]')).toHaveValue('0.5');
    });
  });
});
