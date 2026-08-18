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
   * Inicia una vista previa del examen (mod/quiz/startattempt.php), la misma
   * acción a la que apunta el botón "Vista previa" de la pantalla del examen.
   * El comentario del código fuente dice "should only ever be posted to",
   * pero funcionalmente valida el sesskey vía optional_param (no exige
   * método POST), así que un GET normal con el sesskey funciona igual --
   * mismo criterio que con addquestion/addrandom.
   */
  async iniciarVistaPrevia(cmid: number) {
    const sesskey = await this.getSesskey();
    await this.page.goto(`/mod/quiz/startattempt.php?cmid=${cmid}&sesskey=${sesskey}`);

    // Cuando el examen tiene límite de tiempo, Moodle no arranca el intento
    // directo: muestra una pantalla de aviso ("el reloj empieza apenas
    // confirmes, no se puede pausar") con un botón "Comenzar intento" que
    // hay que confirmar. Si el examen no tuviera límite de tiempo (u otra
    // restricción de acceso), este botón no aparece y se sigue derecho.
    const botonComenzar = this.page.getByRole('button', { name: 'Comenzar intento' });
    if (await botonComenzar.count() > 0) {
      await botonComenzar.click();
    }
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
   * Verifica si una pregunta con el nombre dado ya está agregada al examen.
   * Útil antes de agregar una pregunta puntual que también podría haber
   * caído por sorteo (preguntas aleatorias, scope #3) -- evita duplicarla.
   */
  async contienePregunta(nombrePregunta: string): Promise<boolean> {
    return (await this.page.getByText(nombrePregunta, { exact: false }).count()) > 0;
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