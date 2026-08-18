import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { config } from '../src/config';

// Scope #5 (enunciado): "Vista previa del examen como profesor."
//
// Depende de que el examen ya tenga preguntas (scope #3 le agregó
// "QA - Opción múltiple" entre otras). El assert de contenido usa el
// enunciado real de esa pregunta ("¿Cuál es la capital de Francia?"), texto
// que el propio test escribió en scope #2 -- no una cadena traducida de
// Moodle, así que no depende del idioma del sitio.

test.describe('Scope 5 · Vista previa del examen como profesor', () => {
  test('el profesor inicia una vista previa y ve el contenido real del examen', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const examenPage = new QuizContentPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    await examenPage.iniciarVistaPrevia(cmid);

    // Assert real #1: la vista previa efectivamente arranca un intento
    // (mod/quiz/attempt.php), no se queda en una pantalla de error/mensaje.
    await expect(teacherPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

    // Assert real #2: el contenido de una pregunta real del examen está
    // visible en la pantalla de vista previa.
    await expect(teacherPage.getByText('¿Cuál es la capital de Francia?')).toBeVisible({
      timeout: 10_000,
    });
  });
});
