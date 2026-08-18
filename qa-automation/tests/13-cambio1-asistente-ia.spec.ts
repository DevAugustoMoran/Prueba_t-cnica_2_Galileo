import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { GradingPage } from '../src/pages/GradingPage';
import { config } from '../src/config';

// Cambio 1: "Asistente de IA para calificar ensayos" -- en la pantalla de
// calificación manual, un botón "Generar Sugerencia" llama a
// ajax_ia.php (que a su vez llama a la API de Gemini) y precarga los campos
// de nota y comentario con la respuesta.
//
// Se intercepta la llamada a ajax_ia.php con una respuesta simulada, en vez
// de llamar a la API real de Gemini: la suite no debe depender de gastar
// cuota de API real, ni de la latencia o variabilidad de una IA en cada
// corrida -- eso es responsabilidad de una prueba de integración aparte, no
// de una suite de e2e determinística.
//
// Depende de la pregunta de ensayo ya presente en "Examen QA E2E" (scope
// #6-9 la deja siempre ahí) -- el panel del asistente aparece igual esté o
// no ya calificada, así que no importa que scope #10 la haya calificado
// antes en la misma corrida.

test.describe('Cambio 1 · Asistente de IA para calificar ensayos', () => {
  test('el botón "Generar Sugerencia" llama al endpoint real y precarga nota y comentario', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const gradingPage = new GradingPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const cmid = await cursoPage.getActivityCmId(courseId, 'Examen QA E2E');

    const NOTA_SIMULADA = 0.8;
    const COMENTARIO_SIMULADO = 'Respuesta bien fundamentada, aunque podría profundizar más.';

    let cuerpoPeticion = '';
    await teacherPage.route('**/local/mejoras_examen/ajax_ia.php', async (route) => {
      cuerpoPeticion = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nota_sugerida: NOTA_SIMULADA,
          comentario_sugerido: COMENTARIO_SIMULADO,
        }),
      });
    });

    await gradingPage.abrirCalificacionPorNombre(cmid, 'QA - Ensayo');

    const panelIA = teacherPage.locator('.que.essay .panel-ia-agregado');
    await expect(panelIA).toBeVisible({ timeout: 10_000 });

    await panelIA.locator('.btn-procesar-ia').click();

    // Assert real #1: el panel de resultado muestra lo que devolvió el
    // endpoint (mockeado), confirmando que el JS procesó la respuesta.
    await expect(panelIA.locator('.nota-sugerida-texto')).toHaveText(String(NOTA_SIMULADA), {
      timeout: 10_000,
    });
    await expect(panelIA.locator('.comentario-sugerido-texto')).toHaveText(COMENTARIO_SIMULADO);

    // Assert real #2: el propio campo de nota del formulario de
    // calificación (no solo el panel informativo) quedó precargado con el
    // valor sugerido -- es lo que realmente le ahorra trabajo al profesor.
    await expect(teacherPage.locator('input[id*="-mark"]')).toHaveValue(String(NOTA_SIMULADA));

    // Assert real #3: la petición al endpoint llevó el contenido real de la
    // pregunta -- no un valor genérico o vacío -- confirmando que el JS
    // extrajo el enunciado real antes de mandarlo.
    expect(cuerpoPeticion).toContain('Explic');
  });
});
