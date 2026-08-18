import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { GradebookPage } from '../src/pages/GradebookPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { config } from '../src/config';

// Scope #11 (enunciado): "Profesor: override de notas y reportes del examen."
//
// El override se hace vía el Informe del calificador (gradebook), no dentro
// del examen: escribir directo sobre la celda de nota calculada y guardar
// es, por definición en Moodle, lo que protege esa nota de recálculos
// automáticos futuros -- el mecanismo real de "override".
//
// Los valores de nota se comparan normalizados (parseFloat, coma o punto)
// porque el separador decimal que renderiza el campo depende del idioma
// configurado del sitio, y no está confirmado cuál usa esta instancia.

test.describe('Scope 11 · Override de notas y reportes del examen', () => {
  test('el profesor sobrescribe la nota final del alumno', async ({ teacherPage }) => {
    const cursoPage = new CoursePage(teacherPage);
    const gradebookPage = new GradebookPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    await gradebookPage.gotoGraderReport(courseId);

    const notaOriginal = parseFloat((await gradebookPage.leerNota('Estudiante QA')).replace(',', '.'));
    const notaNueva = notaOriginal >= 5 ? 2 : 8; // se elige lejos de la original, para que el cambio sea inequívoco

    await gradebookPage.sobrescribirNota('Estudiante QA', String(notaNueva));

    // Assert real: no alcanza con que el form se haya enviado sin error --
    // releemos la celda desde cero para confirmar que el valor nuevo quedó
    // realmente persistido (y que además es distinto del original).
    const notaFinal = parseFloat((await gradebookPage.leerNota('Estudiante QA')).replace(',', '.'));
    expect(notaFinal).toBeCloseTo(notaNueva, 1);
    expect(notaFinal).not.toBeCloseTo(notaOriginal, 1);
  });

  test('los reportes de respuestas y estadísticas del examen muestran datos reales', async ({ teacherPage }) => {
    const cursoPage = new CoursePage(teacherPage);
    const examenPage = new QuizContentPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    await test.step('Reporte de respuestas', async () => {
      await examenPage.gotoReporte(cmid, 'responses');
      // Assert real: el intento real del alumno (scope #6-9) aparece listado.
      await expect(teacherPage.getByText('Estudiante QA')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Reporte de estadísticas', async () => {
      await examenPage.gotoReporte(cmid, 'statistics');
      // Assert real: el desglose por pregunta lista el nombre real de la
      // pregunta de opción múltiple (siempre presente en el examen) -- este
      // reporte muestra nombres de pregunta, no su enunciado/texto.
      await expect(teacherPage.getByText('QA - Opción múltiple')).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
