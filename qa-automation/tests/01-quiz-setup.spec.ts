import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuizSettingsPage, GradeMethod, OverdueHandling } from '../src/pages/QuizSettingsPage';
import { config } from '../src/config';

// Scope #1 (enunciado): "Crear y configurar un examen (timing, intentos
// permitidos, método de calificación)."
//
// Este test es también la base para los demás: crea el examen "Examen QA E2E"
// que usan los tests posteriores (banco de preguntas, intento del alumno,
// calificación, Cambio 4, etc.), así que corre primero (ver el prefijo 01- del
// archivo -- Playwright, en modo serie, respeta el orden alfabético de archivo).

test.describe('Scope 1 · Crear y configurar un examen', () => {
  test('el profesor crea un examen con timing, intentos y método de calificación específicos, y todo queda persistido tal cual', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const quizPage = new QuizSettingsPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    await cursoPage.gotoAddQuizForm(courseId, 1);

    const configuracionEsperada = {
      name: 'Examen QA E2E',
      timelimitSeconds: 90,
      overdueHandling: OverdueHandling.GracePeriod,
      graceperiodSeconds: 300,
      attempts: 2,
      grademethod: GradeMethod.Highest,
    };

    await quizPage.completarYGuardar(configuracionEsperada);

    // --- Assert real #1: el examen aparece en el curso con el nombre configurado ---
    await expect(teacherPage.getByRole('heading', { level: 1 })).toContainText(
      configuracionEsperada.name
    );

    const cmId = await quizPage.obtenerCmIdDeUrlActual();
    expect(cmId).toBeGreaterThan(0);

    // --- Assert real #2: cada valor volvió a leerse igual al guardado ---
    // No alcanza con que el form se haya enviado sin error -- confirmamos que
    // Moodle efectivamente PERSISTIÓ cada campo releyendo el formulario de
    // edición desde cero.
    const persistido = await quizPage.leerConfiguracionPersistida(cmId);

    expect(persistido.name).toBe(configuracionEsperada.name);
    expect(persistido.timelimitSeconds).toBe(configuracionEsperada.timelimitSeconds);
    expect(persistido.overdueHandling).toBe(configuracionEsperada.overdueHandling);
    expect(persistido.graceperiodSeconds).toBe(configuracionEsperada.graceperiodSeconds);
    expect(persistido.attempts).toBe(configuracionEsperada.attempts);
    expect(persistido.grademethod).toBe(configuracionEsperada.grademethod);
  });

  test('el método de calificación no aparece si el examen permite un solo intento', async ({
    teacherPage,
  }) => {
    // Regla real de Moodle (mod_form.php): grademethod se oculta cuando
    // attempts=1, porque con un solo intento no hay nada que "agregar". Este
    // test documenta y verifica ese comportamiento nativo, para que quede
    // declarado (no es un bug de nuestro lado si grademethod no se ve acá).
    const cursoPage = new CoursePage(teacherPage);
    const quizPage = new QuizSettingsPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    await cursoPage.gotoAddQuizForm(courseId, 1);

    await teacherPage.locator('#id_name').fill('Examen QA - un solo intento');

    // Mismo motivo que en QuizSettingsPage.completarYGuardar: "Calificación"
    // (donde viven attempts y grademethod) arranca colapsada.
    await teacherPage.getByRole('button', { name: 'Expandir todo' }).click();

    await teacherPage.locator('#id_attempts').selectOption('1');

    await expect(teacherPage.locator('#id_grademethod')).toBeHidden();

    // Limpieza: no guardamos este examen de prueba (cancelamos), para no
    // ensuciar el curso con exámenes que no usa ningún otro test.
    await teacherPage.locator('input[name="cancel"]').click();
  });
});
