import { Page, expect } from '@playwright/test';
import { fillRichText } from './richTextEditor';

/** Valores del <select id="id_fraction_N"> confirmados contra question/engine/bank.php. */
const FRACCION_CORRECTA = '1.0';
const FRACCION_INCORRECTA = '0.0';

export class QuestionBankPage {
  constructor(private readonly page: Page) {}

  /**
   * Resuelve el id de la categoría de preguntas "por defecto" del curso.
   *
   * En Moodle 4.3, el filtro de categoría del banco de preguntas (question/edit.php)
   * ya no es un <select> nativo visible: es un widget de autocompletado con
   * chips (confirmado contra la instancia real). En vez de pelear con ese
   * widget, se usa la pantalla de gestión de categorías
   * (question/bank/managecategories/category.php), que sigue siendo una lista
   * simple renderizada del lado del servidor: el nombre de cada categoría es
   * un link que apunta al banco de preguntas con "?cat=idCategoria,idContexto"
   * (confirmado contra question_category_list_item.php).
   *
   * Navegar primero a esta pantalla garantiza además que la categoría por
   * defecto ya exista (Moodle la crea automáticamente la primera vez que se
   * accede a un contexto sin categorías propias).
   */
  async getDefaultCategoryId(courseId: number, courseShortname: string): Promise<number> {
    await this.page.goto(`/question/bank/managecategories/category.php?courseid=${courseId}`);

    const enlaceCategoria = this.page.locator('a[href*="cat="]', { hasText: courseShortname }).first();
    await expect(enlaceCategoria).toBeVisible({ timeout: 10_000 });

    const href = await enlaceCategoria.getAttribute('href');
    if (!href) {
      throw new Error(`No se encontró el link de la categoría por defecto para "${courseShortname}".`);
    }

    const url = new URL(href, this.page.url());
    const catParam = url.searchParams.get('cat'); // formato "idCategoria,idContexto"
    if (!catParam) {
      throw new Error(`El link de la categoría no tiene el parámetro "cat": ${href}`);
    }

    const [idCategoria] = catParam.split(',');
    return parseInt(idCategoria, 10);
  }

  /**
   * Navega directo al formulario de alta de una pregunta del tipo indicado,
   * usando la misma URL a la que redirige el selector de tipo de pregunta del
   * banco. Igual criterio que con el examen: el selector de tipo es UI
   * genérica del banco de preguntas, no específica de cada tipo -- lo que
   * importa para el scope es el formulario real de cada tipo, que sí se
   * ejercita completo.
   */
  private async gotoAddQuestionForm(courseId: number, qtype: string, categoryId: number) {
    const returnurl = encodeURIComponent(`/question/edit.php?courseid=${courseId}`);
    await this.page.goto(
      `/question/bank/editquestion/question.php?qtype=${qtype}&category=${categoryId}&courseid=${courseId}&returnurl=${returnurl}`
    );
  }

  private async completarCamposComunes(nombre: string, enunciado: string, puntuacion = 1) {
    await this.page.locator('#id_name').fill(nombre);
    await fillRichText(this.page, 'id_questiontext', enunciado);
    await this.page.locator('#id_defaultmark').fill(String(puntuacion));
  }

  private async guardar() {
    await this.page.locator('#id_submitbutton').click();
    // Al guardar, Moodle vuelve al banco de preguntas (returnurl). Un assert
    // real de que no hubo errores de validación: si los hubiera, el form no
    // navega y sigue mostrando el mismo id_submitbutton.
    await expect(this.page).toHaveURL(/question\/edit\.php/, { timeout: 15_000 });
  }

  /** Opción múltiple. En Moodle, el texto de cada opción TAMBIÉN es un editor
   * de texto enriquecido (no un input simple) -- confirmado contra el código
   * fuente de qtype_multichoice, es una particularidad de este tipo puntual. */
  async crearOpcionMultiple(
    courseId: number,
    categoryId: number,
    datos: { nombre: string; enunciado: string; correcta: string; incorrectas: string[] }
  ) {
    await this.gotoAddQuestionForm(courseId, 'multichoice', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);

    await fillRichText(this.page, 'id_answer_0', datos.correcta);
    await this.page.locator('#id_fraction_0').selectOption(FRACCION_CORRECTA);

    for (let i = 0; i < datos.incorrectas.length; i++) {
      const indice = i + 1;
      await fillRichText(this.page, `id_answer_${indice}`, datos.incorrectas[i]);
      await this.page.locator(`#id_fraction_${indice}`).selectOption(FRACCION_INCORRECTA);
    }

    await this.guardar();
  }

  /** Verdadero/falso. */
  async crearVerdaderoFalso(
    courseId: number,
    categoryId: number,
    datos: { nombre: string; enunciado: string; respuestaCorrecta: boolean }
  ) {
    await this.gotoAddQuestionForm(courseId, 'truefalse', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);
    await this.page.locator('#id_correctanswer').selectOption(datos.respuestaCorrecta ? '1' : '0');
    await this.guardar();
  }

  /** Respuesta corta. El texto de cada respuesta es un input simple (a
   * diferencia de opción múltiple). */
  async crearRespuestaCorta(
    courseId: number,
    categoryId: number,
    datos: { nombre: string; enunciado: string; respuestasCorrectas: string[] }
  ) {
    await this.gotoAddQuestionForm(courseId, 'shortanswer', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);

    for (let i = 0; i < datos.respuestasCorrectas.length; i++) {
      await this.page.locator(`#id_answer_${i}`).fill(datos.respuestasCorrectas[i]);
      await this.page.locator(`#id_fraction_${i}`).selectOption(FRACCION_CORRECTA);
    }

    await this.guardar();
  }

  /** Numérica. Cada respuesta tiene, además de answer/fraction, un campo
   * "tolerance" (margen de error aceptado). */
  async crearNumerica(
    courseId: number,
    categoryId: number,
    datos: { nombre: string; enunciado: string; respuestaCorrecta: number; tolerancia: number }
  ) {
    await this.gotoAddQuestionForm(courseId, 'numerical', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);

    await this.page.locator('#id_answer_0').fill(String(datos.respuestaCorrecta));
    await this.page.locator('#id_tolerance_0').fill(String(datos.tolerancia));
    await this.page.locator('#id_fraction_0').selectOption(FRACCION_CORRECTA);

    await this.guardar();
  }

  /** Emparejamiento. Requiere al menos 3 preguntas y 2 respuestas distintas
   * (Moodle lo valida). El texto de cada "pregunta" (subquestion) es un
   * editor de texto enriquecido; la "respuesta" (subanswer) es un input simple. */
  async crearEmparejamiento(
    courseId: number,
    categoryId: number,
    datos: { nombre: string; enunciado: string; pares: { pregunta: string; respuesta: string }[] }
  ) {
    await this.gotoAddQuestionForm(courseId, 'match', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);

    for (let i = 0; i < datos.pares.length; i++) {
      await fillRichText(this.page, `id_subquestions_${i}`, datos.pares[i].pregunta);
      await this.page.locator(`#id_subanswers_${i}`).fill(datos.pares[i].respuesta);
    }

    await this.guardar();
  }

  /** Ensayo (respuesta abierta, calificación manual). No tiene respuestas
   * predefinidas -- es justamente el tipo que califica el profesor a mano
   * (relevante para el Cambio 1 y el Cambio 4 de este proyecto). */
  async crearEnsayo(courseId: number, categoryId: number, datos: { nombre: string; enunciado: string }) {
    await this.gotoAddQuestionForm(courseId, 'essay', categoryId);
    await this.completarCamposComunes(datos.nombre, datos.enunciado);
    await this.guardar();
  }

  /**
   * Abre el formulario de edición real de una pregunta ya existente
   * (navegando fila -> botón "Editar" -> ítem de menú "Editar pregunta", el
   * único camino que realmente lleva ahí) y devuelve su id.
   *
   * Reutilizable: lo usan tanto verificarEnListado (para leer el qtype) como
   * cualquier test que necesite el id real de una pregunta para agregarla al
   * examen (scope #3), sin tener que rehacer esta navegación.
   */
  async obtenerIdPregunta(courseId: number, nombre: string): Promise<number> {
    await this.page.goto(`/question/edit.php?courseid=${courseId}`);

    // El nombre de la pregunta en el listado es un trigger de renombrado en
    // línea (href="#", no navega), no un link al formulario de edición. El
    // botón "Editar" tampoco navega directo: abre un menú desplegable
    // (Vista previa / Editar pregunta / Duplicar / Borrar / ...); hay que
    // elegir "Editar pregunta" para llegar al formulario real.
    // .last(): con reset completo esto no debería hacer falta, pero es
    // inofensivo dejarlo como red de seguridad ante corridas parciales.
    const fila = this.page.getByRole('row', { name: nombre }).last();
    await expect(fila).toBeVisible({ timeout: 10_000 });

    await fila.getByRole('button', { name: 'Editar', exact: true }).click();
    await this.page.getByRole('menuitem', { name: 'Editar pregunta' }).click();

    const campoId = this.page.locator('input[name="id"]');
    return parseInt(await campoId.inputValue(), 10);
  }

  /**
   * Verifica que una pregunta con el nombre dado aparezca listada en el banco
   * de preguntas, y que sea del tipo esperado. Assert real de persistencia:
   * no alcanza con que guardar() haya navegado sin error, confirmamos que la
   * pregunta realmente está en el listado y que Moodle la guardó como el tipo
   * correcto -- leyendo el campo oculto "qtype" del propio formulario al
   * reabrirla, no el texto traducido del listado (que depende del idioma del
   * sitio y no lo tengo confirmado).
   */
  async verificarEnListado(courseId: number, nombre: string, qtypeEsperado: string) {
    const idPregunta = await this.obtenerIdPregunta(courseId, nombre);
    await expect(this.page.locator('input[name="qtype"]')).toHaveValue(qtypeEsperado, {
      timeout: 10_000,
    });
    return idPregunta;
  }
}
