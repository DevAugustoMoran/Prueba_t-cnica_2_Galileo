import { Page, expect } from '@playwright/test';

export class GradingPage {
  constructor(private readonly page: Page) {}

  /**
   * Abre la interfaz de calificación manual para una pregunta del examen,
   * identificada por su NOMBRE real (no por slot/questionid, que son
   * dinámicos y dependen de qué preguntas terminó teniendo cada examen).
   * Confirmado contra mod/quiz/report/grading/report.php: en la fila de la
   * tabla índice, solo hay link en las columnas cuyo conteo es > 0 -- el
   * primer link de la fila es siempre la acción de calificación relevante
   * en cada momento (calificar lo pendiente, o reabrir lo ya calificado
   * cuando ya no queda nada pendiente).
   */
  async abrirCalificacionPorNombre(cmid: number, nombrePregunta: string) {
    await this.page.goto(`/mod/quiz/report.php?id=${cmid}&mode=grading`);

    const fila = this.page.locator('tr', { hasText: nombrePregunta });
    await expect(fila).toBeVisible({ timeout: 10_000 });
    await fila.getByRole('link').first().click();
  }

  /**
   * Completa la nota y el comentario para el intento mostrado en la
   * interfaz de calificación actual, y guarda.
   *
   * Los ids de estos campos son dinámicos
   * (q{usageid}:{slot}_-mark / q{usageid}:{slot}_-comment, confirmado contra
   * question/behaviour/rendererbase.php), así que se ubican por selector de
   * atributo "contiene" en vez de por id completo. El formulario tiene id
   * estable "manualgradingform" (confirmado contra
   * mod/quiz/report/grading/renderer.php).
   */
  async calificar(nota: string, comentario: string) {
    await this.page.locator('input[id*="-mark"]').fill(nota);

    const marco = this.page.frameLocator('iframe[id*="-comment_id_ifr"]');
    const cuerpo = marco.locator('body');
    await cuerpo.click();
    await cuerpo.fill(comentario);

    await this.page.locator('#manualgradingform input[type="submit"]').click();
  }
}
