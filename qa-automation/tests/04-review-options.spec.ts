import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuizSettingsPage } from '../src/pages/QuizSettingsPage';
import { config } from '../src/config';

// Scope #4 (enunciado): "Configurar opciones de revisión (qué ve el
// estudiante y cuándo)."
//
// Los campos elegidos están confirmados como editables contra la instancia
// real para la configuración actual del examen (ver notas en
// QuizSettingsPage.configurarOpcionesRevision): con comportamiento
// "Retroalimentación diferida", la mayoría de los campos "durante el
// intento" quedan bloqueados por Moodle salvo "maxmarksduring"; y como el
// examen no tiene fecha de cierre configurada, todo el grupo "closed" queda
// bloqueado -- por eso se usa "overallfeedbackopen" en su lugar.

test.describe('Scope 4 · Configurar opciones de revisión', () => {
  test('el profesor cambia las opciones de revisión y quedan persistidas tal cual', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const quizPage = new QuizSettingsPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    const antes = await quizPage.leerOpcionesRevisionPersistidas(cmid, [
      'maxmarksduring',
      'overallfeedbackopen',
    ]);

    const configuracionNueva = {
      maxmarksduring: !antes.maxmarksduring,
      overallfeedbackopen: !antes.overallfeedbackopen,
    };

    await quizPage.configurarOpcionesRevision(cmid, configuracionNueva);

    // Assert real: no alcanza con que el form se haya guardado sin error --
    // confirmamos que Moodle invirtió efectivamente cada valor, releyendo el
    // formulario desde cero.
    const despues = await quizPage.leerOpcionesRevisionPersistidas(cmid, [
      'maxmarksduring',
      'overallfeedbackopen',
    ]);

    expect(despues.maxmarksduring).toBe(configuracionNueva.maxmarksduring);
    expect(despues.overallfeedbackopen).toBe(configuracionNueva.overallfeedbackopen);
  });
});