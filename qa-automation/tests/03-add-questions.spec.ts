import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { config } from '../src/config';

// Scope #3 (enunciado): "Agregar preguntas al examen, del banco y aleatorias."
//
// Depende de que ya existan el examen "Examen QA E2E" (scope #1, tests/01) y
// las preguntas del banco (scope #2, tests/02). Con la suite corrida vía
// `npm test` (reset completo + orden alfabético de archivo), ambos ya están
// garantizados para cuando arranca este test.

test.describe('Scope 3 · Agregar preguntas al examen', () => {
  test('el profesor agrega una pregunta puntual del banco y varias aleatorias, y el examen refleja la cantidad correcta', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const examenPage = new QuizContentPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const categoryId = await bancoPage.getDefaultCategoryId(courseId, config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    await examenPage.goto(cmid);

    // El examen se creó vacío en scope #1 -- assert real de punto de partida,
    // no una suposición.
    const preguntasAlInicio = await examenPage.contarPreguntas();
    expect(preguntasAlInicio).toBe(0);

    await test.step('Agregar una pregunta puntual del banco', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Opción múltiple');

      await examenPage.goto(cmid);
      await examenPage.agregarPreguntaDelBanco(cmid, idPregunta);

      const preguntasDespues = await examenPage.contarPreguntas();
      expect(preguntasDespues).toBe(preguntasAlInicio + 1);

      // Assert adicional: como esta es una pregunta puntual (no aleatoria),
      // su nombre real debe aparecer en la lista del examen.
      await expect(teacherPage.getByText('QA - Opción múltiple', { exact: false })).toBeVisible();
    });

    await test.step('Agregar preguntas aleatorias de la categoría', async () => {
      const preguntasAntes = await examenPage.contarPreguntas();

      await examenPage.agregarPreguntasAleatorias(cmid, categoryId, 2);

      const preguntasDespues = await examenPage.contarPreguntas();
      expect(preguntasDespues).toBe(preguntasAntes + 2);
    });

    await test.step('El examen termina con el total esperado de preguntas', async () => {
      const totalFinal = await examenPage.contarPreguntas();
      expect(totalFinal).toBe(preguntasAlInicio + 1 + 2);
    });
  });
});
