import { Page, expect } from '@playwright/test';

export class QuizContentPage {
  constructor(private readonly page: Page) {}

  async goto(cmid: number) {
    await this.page.goto(`/mod/quiz/edit.php?cmid=${cmid}`);
  }

  private async getSesskey(): Promise<string> {
    return this.page.evaluate(() => (window as any).M.cfg.sesskey);
  }

  /**
   * Cuenta la cantidad de preguntas (slots) actualmente en el examen. Cada
   * slot -- de cualquier tipo, incluidas las preguntas aleatorias -- se
   * renderiza con id="mod-indent-outer-slot-{id}" (confirmado contra
   * mod/quiz/templates/question_slot.mustache), así que el conteo no depende
   * del idioma del sitio ni del tipo de pregunta.
   */
  async contarPreguntas(): Promise<number> {
    return this.page.locator('[id^="mod-indent-outer-slot-"]').count();
  }

  /**
   * Agrega una pregunta puntual del banco al examen.
   *
   * Navega directo a la acción "addquestion" documentada en el propio código
   * fuente de mod/quiz/edit.php, en vez de interactuar con el panel lateral
   * del banco de preguntas embebido en esta pantalla (otro componente
   * dinámico, con el mismo tipo de fricción que ya se vio en el banco de
   * preguntas standalone). Confirmado contra el código real: valida sesskey,
   * agrega la pregunta a la última página del examen, y redirige de vuelta a
   * esta misma pantalla -- se puede navegar con un GET normal.
   */
  async agregarPreguntaDelBanco(cmid: number, questionId: number) {
    const sesskey = await this.getSesskey();
    await this.page.goto(
      `/mod/quiz/edit.php?cmid=${cmid}&addquestion=${questionId}&addonpage=0&sesskey=${sesskey}`
    );
  }

  /**
   * Agrega `cantidad` preguntas aleatorias de una categoría al examen, vía la
   * acción "addrandom" documentada en el mismo archivo. `incluirSubcategorias`
   * controla el parámetro "recurse".
   */
  async agregarPreguntasAleatorias(
    cmid: number,
    categoryId: number,
    cantidad: number,
    incluirSubcategorias = false
  ) {
    const sesskey = await this.getSesskey();
    await this.page.goto(
      `/mod/quiz/edit.php?cmid=${cmid}&addrandom=1&categoryid=${categoryId}` +
        `&randomcount=${cantidad}&recurse=${incluirSubcategorias ? 1 : 0}` +
        `&addonpage=0&sesskey=${sesskey}`
    );
  }
}
