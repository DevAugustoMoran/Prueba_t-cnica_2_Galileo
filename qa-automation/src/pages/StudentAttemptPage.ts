import { Page, expect, Locator } from '@playwright/test';
import { fillRichText } from './richTextEditor';

/**
 * Cada pregunta durante un intento se envuelve en un <div class="que {tipo}
 * ...">, con el tipo de pregunta (multichoice, truefalse, shortanswer,
 * numerical, match, essay) como clase CSS -- confirmado contra
 * question/engine/renderer.php. Esto da una forma robusta de ubicar la
 * pregunta actual sin depender de texto traducido.
 */
export class StudentAttemptPage {
  constructor(private readonly page: Page) {}

  private async getSesskey(): Promise<string> {
    return this.page.evaluate(() => (window as any).M.cfg.sesskey);
  }

  /**
   * Inicia el intento del examen. Si el examen tiene límite de tiempo,
   * Moodle muestra antes una pantalla de aviso con un botón "Comenzar
   * intento" que hay que confirmar (mismo comportamiento que la vista previa
   * del profesor).
   */
  async iniciarIntento(cmid: number, opciones?: { password?: string }) {
    // studentPage arranca en blanco (about:blank): hay que cargar una página
    // real de Moodle primero para que M.cfg exista, o page.evaluate falla
    // con "Cannot read properties of undefined (reading 'cfg')".
    await this.page.goto(`/mod/quiz/view.php?id=${cmid}`);

    const sesskey = await this.getSesskey();
    await this.page.goto(`/mod/quiz/startattempt.php?cmid=${cmid}&sesskey=${sesskey}`);

    // Si el examen requiere contraseña, Moodle combina ese chequeo con
    // cualquier otro (ej. el aviso de límite de tiempo) en un mismo
    // formulario previo -- el campo "quizpassword" (mismo nombre que en la
    // configuración del examen) aparece ahí si corresponde.
    const campoPassword = this.page.locator('#id_quizpassword');
    if (opciones?.password !== undefined && (await campoPassword.count()) > 0) {
      // Mismo comportamiento "unmask" que en la configuración del examen: el
      // campo arranca oculto detrás de un link "Haz click para insertar
      // texto" que hay que clickear primero para revelar el input real.
      const linkRevelar = this.page.getByText('Haz click para insertar texto');
      if (await linkRevelar.count() > 0) {
        await linkRevelar.first().click();
      }
      await campoPassword.fill(opciones.password);
    }

    const botonComenzar = this.page.getByRole('button', { name: 'Comenzar intento' });
    if (await botonComenzar.count() > 0) {
      await botonComenzar.click();
    }
  }

  /**
   * Simula una pérdida de foco (cambio de pestaña/ventana) disparando el
   * mismo evento real que escucha foco.js -- no cambia de pestaña de verdad
   * (mecanismo poco confiable en automatización), sino que fuerza
   * document.visibilityState a "hidden" y dispara 'visibilitychange'
   * directamente, ejercitando el código real de detección.
   *
   * Espera más que el debounce interno de foco.js (150ms) más el tiempo de
   * red del fetch real a registrar_foco.php, para que la infracción quede
   * efectivamente registrada del lado del servidor antes de continuar.
   */
  async simularPerdidaDeFoco() {
    await this.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await this.page.waitForTimeout(1_000);
  }

  /** El contenedor de la pregunta actualmente visible en la página. */
  private preguntaActual(): Locator {
    return this.page.locator('.que');
  }

  /**
   * Responde una pregunta de opción múltiple, clickeando el radio cuya
   * etiqueta coincide con el texto de la respuesta.
   */
  async responderOpcionMultiple(textoRespuesta: string) {
    const contenedor = this.page.locator('.que.multichoice');
    await expect(contenedor).toBeVisible({ timeout: 10_000 });
    await contenedor.getByRole('radio', { name: textoRespuesta }).check();
  }

  /**
   * Responde verdadero/falso por el value del input (1=verdadero, 0=falso,
   * confirmado contra qtype_truefalse/renderer.php), no por el texto de la
   * etiqueta -- así no depende del idioma del sitio.
   */
  async responderVerdaderoFalso(esVerdadero: boolean) {
    const contenedor = this.page.locator('.que.truefalse');
    await expect(contenedor).toBeVisible({ timeout: 10_000 });
    const valor = esVerdadero ? '1' : '0';
    await contenedor.locator(`input[type="radio"][value="${valor}"]`).check();
  }

  /** Respuesta corta o numérica: en ambos casos, un único input de texto. */
  async responderTextoLibre(tipo: 'shortanswer' | 'numerical', respuesta: string) {
    const contenedor = this.page.locator(`.que.${tipo}`);
    await expect(contenedor).toBeVisible({ timeout: 10_000 });
    await contenedor.locator('input[type="text"]').fill(respuesta);
  }

  /** Ensayo: el enunciado es de solo lectura, pero la respuesta del alumno
   * es un editor de texto enriquecido. */
  async responderEnsayo(respuesta: string) {
    const contenedor = this.page.locator('.que.essay');
    await expect(contenedor).toBeVisible({ timeout: 10_000 });

    const iframe = contenedor.locator('iframe');
    await expect(iframe).toBeVisible({ timeout: 10_000 });
    const idIframe = await iframe.getAttribute('id');
    if (!idIframe) {
      throw new Error('No se encontró el id del iframe del editor de la respuesta de ensayo.');
    }
    // El id del textarea original es el id del iframe sin el sufijo "_ifr".
    const idCampo = idIframe.replace(/_ifr$/, '');
    await fillRichText(this.page, idCampo, respuesta);
  }

  /**
   * Emparejamiento: para cada par {pregunta, respuesta}, ubica la fila de la
   * tabla que contiene el texto de la pregunta y selecciona la respuesta en
   * el <select> de esa misma fila.
   */
  async responderEmparejamiento(pares: { pregunta: string; respuesta: string }[]) {
    const contenedor = this.page.locator('.que.match');
    await expect(contenedor).toBeVisible({ timeout: 10_000 });

    for (const par of pares) {
      const fila = contenedor.locator('tr', { hasText: par.pregunta });
      await fila.locator('select').selectOption({ label: par.respuesta });
    }
  }

  /**
   * Responde la pregunta de la página actual, detectando su tipo por la
   * clase CSS del contenedor (.que.{tipo}) y aplicando la respuesta correcta
   * conocida para ese tipo (todas las preguntas del banco -- scope #2 -- se
   * crearon con una única respuesta correcta conocida, y cada tipo aparece
   * a lo sumo una vez en el examen). Esto desacopla el test de qué
   * subconjunto de preguntas termine teniendo el examen en cada corrida:
   * funciona igual si cayeron distintas preguntas aleatorias (scope #3).
   */
  async responderPreguntaActual() {
    if ((await this.page.locator('.que.multichoice').count()) > 0) {
      await this.responderOpcionMultiple('París');
    } else if ((await this.page.locator('.que.truefalse').count()) > 0) {
      await this.responderVerdaderoFalso(true);
    } else if ((await this.page.locator('.que.shortanswer').count()) > 0) {
      await this.responderTextoLibre('shortanswer', 'inglés');
    } else if ((await this.page.locator('.que.numerical').count()) > 0) {
      await this.responderTextoLibre('numerical', '42');
    } else if ((await this.page.locator('.que.match').count()) > 0) {
      await this.responderEmparejamiento([
        { pregunta: 'Francia', respuesta: 'París' },
        { pregunta: 'España', respuesta: 'Madrid' },
        { pregunta: 'Italia', respuesta: 'Roma' },
      ]);
    } else if ((await this.page.locator('.que.essay').count()) > 0) {
      await this.responderEnsayo('Es un examen que se corre solo.');
    } else {
      throw new Error(
        'No se reconoció el tipo de la pregunta en la página actual (ningún .que.{tipo} conocido encontrado).'
      );
    }
  }

  /**
   * Responde todas las preguntas del examen, navegando página por página
   * (el layout está configurado como "una pregunta por página"). Se detiene
   * al llegar a la pantalla de resumen. Devuelve la cantidad de preguntas
   * respondidas.
   */
  async responderTodoElExamen(): Promise<number> {
    let cantidad = 0;
    while (!/mod\/quiz\/summary\.php/.test(this.page.url())) {
      await this.responderPreguntaActual();
      cantidad++;
      await this.siguientePagina();
    }
    return cantidad;
  }

  /**
   * Marca (o desmarca) para revisar la pregunta actualmente visible.
   *
   * OJO: en la pantalla real del intento de examen (Moodle 4.3.12), el
   * control de marcar es un <button role="button"> con estado toggle
   * (aria-pressed), no el <input type="checkbox"> clásico que documenta
   * question/engine/renderer.php para el motor de preguntas genérico -- el
   * módulo mod_quiz usa su propio control para esta pantalla en particular.
   * Confirmado contra la instancia real, no contra el código PHP (que
   * describe el checkbox como si fuera universal, y no lo es).
   */
  async marcarParaRevisar(marcar = true) {
    const boton = this.preguntaActual().getByRole('button', { name: 'Marcadas' });
    const yaMarcada = (await boton.getAttribute('aria-pressed')) === 'true';
    if (yaMarcada !== marcar) {
      await boton.click();
    }
  }

  async estaMarcadaParaRevisar(): Promise<boolean> {
    const boton = this.preguntaActual().getByRole('button', { name: 'Marcadas' });
    return (await boton.getAttribute('aria-pressed')) === 'true';
  }

  /** Avanza a la siguiente página del examen (id estable, no depende del
   * idioma -- en la última página, el mismo botón lleva al resumen). */
  async siguientePagina() {
    await this.page.locator('#mod_quiz-next-nav').click();
  }

  async paginaAnterior() {
    await this.page.locator('#mod_quiz-prev-nav').click();
  }

  /**
   * Desde la pantalla de resumen (summary.php, a la que ya llegó
   * responderTodoElExamen), confirma el envío final. El botón real dispara
   * un handler JS que casi siempre intercepta el click (preventDefault) y
   * abre un modal de confirmación cuyo botón reutiliza el mismo texto
   * (get_string('submitallandfinish', 'quiz') se usa para los dos --
   * confirmado contra mod_quiz/amd/src/submission_confirmation.js), así que
   * hace falta un segundo click sobre el botón del modal para que el envío
   * se efectúe de verdad.
   *
   * OJO: en un intento ya vencido (fuera de tiempo, dentro del período de
   * gracia), confirmado contra la instancia real que el modal se saltea y
   * el primer click ya envía directo a review.php -- se tolera cualquiera
   * de los dos casos.
   */
  async confirmarEnvioDesdeResumen() {
    await expect(this.page).toHaveURL(/mod\/quiz\/summary\.php/, { timeout: 15_000 });

    const botonesEnviar = this.page.getByRole('button', { name: 'Enviar todo y terminar' });
    await botonesEnviar.first().click();

    try {
      // Caso "sin modal": ya navegó directo, no hay nada más que hacer.
      await expect(this.page).toHaveURL(/mod\/quiz\/review\.php/, { timeout: 3_000 });
      return;
    } catch {
      // No navegó todavía -- asumimos que sigue en el modal de confirmación.
    }

    // El botón del modal reutiliza el mismo texto que el original: esperamos
    // a que aparezca el segundo (el del modal) antes de confirmarlo.
    await expect(botonesEnviar).toHaveCount(2, { timeout: 10_000 });
    await botonesEnviar.last().click();

    await expect(this.page).toHaveURL(/mod\/quiz\/review\.php/, { timeout: 15_000 });
  }
}