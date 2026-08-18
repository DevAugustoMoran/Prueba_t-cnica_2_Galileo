import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';

// Scope #6, #8 y #9 (enunciado):
//   6. "Estudiante: iniciar intento, responder, navegar entre preguntas,
//       marcar para revisar."
//   8. "Estudiante: enviar el intento."
//   9. "Calificación automática y visualización del resultado."
//
// Los tres viven en el mismo test porque son, literalmente, el mismo flujo
// continuo -- separarlos en archivos distintos obligaría a repetir todo el
// setup sin ganar nada. El examen puede tener 2 preguntas aleatorias además
// de "QA - Opción múltiple" (scope #3): StudentAttemptPage.responderPreguntaActual()
// detecta el tipo de cada pregunta y la responde con la respuesta correcta
// conocida, así que el test funciona sin importar qué haya salido sorteado.

test.describe('Scope 6, 8 y 9 · Intento del alumno, envío y calificación', () => {
  test('el alumno rinde el examen completo, lo marca, lo envía, y la calificación automática refleja las respuestas correctas', async ({
    teacherPage,
    studentPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const examenPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    await test.step('Garantizar que el examen tenga la pregunta de ensayo', async () => {
      // "QA - Ensayo" puede o no haber caído entre las 2 preguntas
      // aleatorias de scope #3 (sorteadas de un pool de 5 tipos) -- no está
      // garantizado. Scope #10 (calificación manual) necesita que el
      // intento quede con una pregunta sin calificar automáticamente, así
      // que la agregamos acá explícitamente si todavía no está, ANTES de
      // que el alumno rinda el examen (agregarla después no serviría: no
      // modificaría un intento que ya se envió).
      await examenPage.goto(cmid);
      if (!(await examenPage.contienePregunta('QA - Ensayo'))) {
        const idEnsayo = await bancoPage.obtenerIdPregunta(courseId, 'QA - Ensayo');
        await examenPage.agregarPreguntaDelBanco(cmid, idEnsayo);
      }
    });

    await alumnoPage.iniciarIntento(cmid);

    // Assert real #1: efectivamente arrancó un intento real (no una vista
    // previa ni una pantalla de error).
    await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

    await test.step('Marcar la primera pregunta para revisar después', async () => {
      await alumnoPage.marcarParaRevisar();
      expect(await alumnoPage.estaMarcadaParaRevisar()).toBe(true);
    });

    const cantidadRespondidas = await test.step('Responder y navegar por todas las preguntas', async () => {
      return alumnoPage.responderTodoElExamen();
    });

    // Assert real #2: se navegó y respondió más de una pregunta -- confirma
    // que la navegación entre páginas realmente ocurrió, no que el examen
    // tenía una sola pregunta.
    expect(cantidadRespondidas).toBeGreaterThan(1);

    await test.step('Enviar el intento', async () => {
      await alumnoPage.confirmarEnvioDesdeResumen();
    });

    // Assert real #3 (scope #8 + #9): terminamos en la pantalla de revisión
    // del intento ya enviado, y la pregunta de opción múltiple -- que
    // siempre está en el examen y que se respondió con la opción correcta
    // (París) -- quedó marcada como "correct" por la calificación
    // automática. La clase CSS es la misma que usa Moodle internamente
    // (confirmado contra question/engine/states.php), no depende del idioma.
    await expect(studentPage).toHaveURL(/mod\/quiz\/review\.php/);
    await expect(studentPage.locator('.que.multichoice.correct')).toBeVisible({ timeout: 10_000 });
  });
});
