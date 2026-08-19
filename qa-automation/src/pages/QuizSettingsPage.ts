import { Page, expect } from '@playwright/test';

/** Métodos de calificación nativos de mod_quiz (valor del <select id="id_grademethod">). */
export enum GradeMethod {
  Highest = '1',
  Average = '2',
  First = '3',
  Last = '4',
}

/** Qué hacer con intentos que exceden el tiempo (id_overduehandling). */
export enum OverdueHandling {
  Autosubmit = 'autosubmit',
  GracePeriod = 'graceperiod',
  AutoAbandon = 'autoabandon',
}

export interface QuizSettingsInput {
  name: string;
  /** Límite de tiempo en SEGUNDOS. Se deja sin definir (0/omitido) para "sin límite". */
  timelimitSeconds?: number;
  overdueHandling?: OverdueHandling;
  /** Período de gracia en SEGUNDOS (solo aplica si overdueHandling = GracePeriod). */
  graceperiodSeconds?: number;
  /** 0 = intentos ilimitados. */
  attempts?: number;
  grademethod?: GradeMethod;
  /**
   * Preguntas por página ('1' = una por página). Sin esto, el valor sale de
   * una configuración de sitio (mod_quiz > questionsperpage), que puede
   * variar entre instancias -- toda la suite asume "una por página" para
   * poder navegar de a una (StudentAttemptPage), así que conviene fijarlo
   * explícito en vez de depender de ese default.
   */
  questionsPerPage?: string;
  /** Contraseña requerida para iniciar un intento (campo "quizpassword"). */
  password?: string;
  /** Fecha/hora de apertura del examen. */
  timeopen?: Date;
  /** Fecha/hora de cierre del examen. */
  timeclose?: Date;
  /**
   * Opciones de revisión a configurar en el MISMO envío inicial del
   * formulario (evita un round-trip separado, ver
   * configurarOpcionesRevision para el formato de claves). Como mínimo,
   * "attemptimmediately: true" es necesario para que el alumno pueda llegar
   * a review.php justo después de enviar -- sin esto, depende de un default
   * de sitio que en algunas instancias no permite revisión inmediata
   * (confirmado contra la instancia real: sin este campo, Moodle redirige a
   * "No está autorizado para revisar este cuestionario" en vez de mostrar
   * la revisión).
   */
  reviewOptions?: Record<string, boolean>;
}

export interface QuizSettingsPersisted {
  name: string;
  timelimitSeconds: number;
  overdueHandling: string;
  graceperiodSeconds: number;
  attempts: number;
  grademethod: string;
}

export class QuizSettingsPage {
  constructor(private readonly page: Page) {}

  /**
   * Completa el formulario de configuración del examen (creación o edición) y
   * guarda. Los campos de duración (timelimit, graceperiod) se cargan siempre
   * en la UNIDAD "segundos" (value="1" del select de unidad) para que el valor
   * numérico que se envía sea exactamente el que se pide, sin depender de
   * redondeos de conversión de unidad.
   */
  async completarYGuardar(datos: QuizSettingsInput) {
    await this.page.locator('#id_name').fill(datos.name);

    // El formulario de mod_quiz colapsa por acordeón todas las secciones salvo
    // "General" (Temporalización, Calificación, etc. arrancan cerradas). Los
    // campos existen en el DOM pero no son "visibles" mientras están colapsados,
    // así que cualquier .check()/.selectOption() haría timeout esperando
    // visibilidad. "Expandir todo" los abre todos de una sola vez.
    await this.expandirTodasLasSecciones();

    if (datos.timelimitSeconds !== undefined) {
      await this.page.locator('#id_timelimit_enabled').check();
      await this.page.locator('#id_timelimit_number').fill(String(datos.timelimitSeconds));
      await this.page.locator('#id_timelimit_timeunit').selectOption('1'); // 1 = segundos
    }

    if (datos.overdueHandling) {
      await this.page.locator('#id_overduehandling').selectOption(datos.overdueHandling);
    }

    if (datos.graceperiodSeconds !== undefined) {
      await this.page.locator('#id_graceperiod_enabled').check();
      await this.page.locator('#id_graceperiod_number').fill(String(datos.graceperiodSeconds));
      await this.page.locator('#id_graceperiod_timeunit').selectOption('1'); // 1 = segundos
    }

    if (datos.attempts !== undefined) {
      await this.page.locator('#id_attempts').selectOption(String(datos.attempts));
    }

    if (datos.grademethod) {
      await this.page.locator('#id_grademethod').selectOption(datos.grademethod);
    }

    if (datos.questionsPerPage !== undefined) {
      await this.page.locator('#id_questionsperpage').selectOption(datos.questionsPerPage);
    }

    if (datos.password !== undefined) {
      // El campo de contraseña arranca oculto (class="d-none") detrás de un
      // link "Haz click para insertar texto" -- comportamiento "unmask" del
      // elemento passwordunmask, confirmado contra la instancia real. Hay
      // que clickearlo primero para revelar el input real antes de poder
      // completarlo.
      //
      // OJO: Safe Exam Browser tiene su propio campo de contraseña con el
      // mismo texto de placeholder, así que buscarlo en toda la página da
      // dos resultados ambiguos. Se busca el <div> más chico que realmente
      // envuelve a #id_quizpassword (con :has()) y se limita la búsqueda del
      // link a ESE contenedor -- estructuralmente correcto sin depender del
      // orden de las secciones en el documento.
      const contenedorPassword = this.page.locator('div:has(#id_quizpassword)').last();
      const linkRevelar = contenedorPassword.getByText('Haz click para insertar texto');
      if (await linkRevelar.count() > 0) {
        await linkRevelar.click();
      }
      await this.page.locator('#id_quizpassword').fill(datos.password);
    }

    if (datos.timeopen) {
      await this.seleccionarFechaHora('timeopen', datos.timeopen);
    }

    if (datos.timeclose) {
      await this.seleccionarFechaHora('timeclose', datos.timeclose);
    }

    if (datos.reviewOptions) {
      await this.aplicarOpcionesRevision(datos.reviewOptions);
    }

    await this.page.locator('#id_submitbutton, input[name="submitbutton"]').first().click();

    // Assert real de que Moodle aceptó el formulario y navegó a la vista del
    // examen recién creado (no se quedó en el form con errores de validación).
    await expect(this.page).toHaveURL(/mod\/quiz\/view\.php\?id=\d+/, { timeout: 15_000 });
  }

  /**
   * Completa un campo de tipo "date_time_selector" (usado por timeopen y
   * timeclose): un grupo de selects día/mes/año/hora/minuto más un checkbox
   * "Habilitar". Confirmado contra lib/form/dateselector.php y
   * datetimeselector.php: los VALUES de los selects son numéricos (día 1-31,
   * mes 1-12, año completo, hora 0-23), no dependen del idioma -- salvo el
   * de minuto, que solo ofrece pasos de a 5 (00,05,10...55), por eso se
   * redondea hacia abajo al múltiplo de 5 más cercano.
   */
  async seleccionarFechaHora(prefijoCampo: string, fecha: Date) {
    await this.page.locator(`#id_${prefijoCampo}_enabled`).check();
    await this.page.locator(`#id_${prefijoCampo}_day`).selectOption(String(fecha.getDate()));
    await this.page.locator(`#id_${prefijoCampo}_month`).selectOption(String(fecha.getMonth() + 1));
    await this.page.locator(`#id_${prefijoCampo}_year`).selectOption(String(fecha.getFullYear()));
    await this.page.locator(`#id_${prefijoCampo}_hour`).selectOption(String(fecha.getHours()));

    const minutoRedondeado = fecha.getMinutes() - (fecha.getMinutes() % 5);
    await this.page.locator(`#id_${prefijoCampo}_minute`).selectOption(String(minutoRedondeado));
  }

  /**
   * Navega a "Editar configuración" del examen indicado y lee de vuelta los
   * valores que quedaron persistidos. Se usa para el assert de "¿lo que guardé
   * es realmente lo que quedó guardado?", no solo "¿el form se envió sin
   * error?".
   */
  async leerConfiguracionPersistida(cmId: number): Promise<QuizSettingsPersisted> {
    await this.page.goto(`/course/modedit.php?update=${cmId}&return=1`);

    // Mismo motivo que en completarYGuardar: las secciones vuelven a arrancar
    // colapsadas en cada carga del formulario.
    await this.expandirTodasLasSecciones();

    const timelimitEnabled = await this.page.locator('#id_timelimit_enabled').isChecked();
    const timelimitNumber = timelimitEnabled
      ? parseInt(await this.page.locator('#id_timelimit_number').inputValue(), 10)
      : 0;
    const timelimitUnit = timelimitEnabled
      ? parseInt(await this.page.locator('#id_timelimit_timeunit').inputValue(), 10)
      : 1;

    const graceperiodEnabled = await this.page.locator('#id_graceperiod_enabled').isChecked();
    const graceperiodNumber = graceperiodEnabled
      ? parseInt(await this.page.locator('#id_graceperiod_number').inputValue(), 10)
      : 0;
    const graceperiodUnit = graceperiodEnabled
      ? parseInt(await this.page.locator('#id_graceperiod_timeunit').inputValue(), 10)
      : 1;

    return {
      name: await this.page.locator('#id_name').inputValue(),
      timelimitSeconds: timelimitNumber * timelimitUnit,
      overdueHandling: await this.page.locator('#id_overduehandling').inputValue(),
      graceperiodSeconds: graceperiodNumber * graceperiodUnit,
      attempts: parseInt(await this.page.locator('#id_attempts').inputValue(), 10),
      grademethod: await this.page.locator('#id_grademethod').inputValue(),
    };
  }

  /**
   * Configura opciones de revisión del examen ("qué ve el estudiante y
   * cuándo"). Cada clave es un id de campo real del formulario, con el patrón
   * "{campo}{momento}" confirmado contra mod_form.php:
   *   campo:   attempt | correctness | maxmarks | marks | specificfeedback |
   *            generalfeedback | rightanswer | overallfeedback
   *   momento: during | immediately | open | closed
   * Ej.: { attemptduring: true, overallfeedbackclosed: false }.
   *
   * OJO con las dependencias del propio formulario (no son un bug del test):
   * "marks{momento}" queda deshabilitado si "maxmarks{momento}" está
   * destildado; y en todo momento que no sea "during", "correctness",
   * "specificfeedback", "generalfeedback" y "rightanswer" quedan
   * deshabilitados si "attempt{momento}" está destildado. Si se necesita
   * tildar un campo dependiente, hay que asegurarse de que su campo del que
   * depende esté tildado en el mismo llamado.
   */
  async configurarOpcionesRevision(cmId: number, opciones: Record<string, boolean>) {
    await this.page.goto(`/course/modedit.php?update=${cmId}&return=1`);
    await this.expandirTodasLasSecciones();
    await this.aplicarOpcionesRevision(opciones);
    await this.page.locator('#id_submitbutton, input[name="submitbutton"]').first().click();
    await expect(this.page).toHaveURL(/mod\/quiz\/view\.php\?id=\d+/, { timeout: 15_000 });
  }

  /**
   * Tilda/destilda los campos de opciones de revisión indicados (asume que
   * las secciones ya están expandidas). Compartido entre completarYGuardar
   * (durante la creación) y configurarOpcionesRevision (edición aparte).
   */
  private async aplicarOpcionesRevision(opciones: Record<string, boolean>) {
    for (const [campo, valor] of Object.entries(opciones)) {
      const checkbox = this.page.locator(`#id_${campo}`);

      // Varios campos quedan deshabilitados por JS según la config actual del
      // examen -- no es un bug del test, es la propia UI de Moodle: los
      // campos de "durante el intento" (salvo maxmarks) se bloquean cuando el
      // comportamiento de preguntas es "Retroalimentación diferida" (no hay
      // nada que corregir todavía mientras se rinde), y el grupo completo de
      // "después de cerrar" se bloquea si el examen no tiene fecha de cierre
      // (timeclose) configurada. Se falla con un mensaje claro en vez de
      // dejar que Playwright agote el timeout tratando de tildar algo
      // inhabilitado.
      if (await checkbox.isDisabled()) {
        throw new Error(
          `El campo "${campo}" está deshabilitado en este examen (revisá el comportamiento de ` +
            `preguntas configurado y si tiene fecha de cierre) -- no se puede tildar/destildar.`
        );
      }

      if (valor) {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
    }
  }

  /** Relee del formulario el estado actual de los campos de revisión indicados. */
  async leerOpcionesRevisionPersistidas(
    cmId: number,
    campos: string[]
  ): Promise<Record<string, boolean>> {
    await this.page.goto(`/course/modedit.php?update=${cmId}&return=1`);
    await this.expandirTodasLasSecciones();

    const resultado: Record<string, boolean> = {};
    for (const campo of campos) {
      resultado[campo] = await this.page.locator(`#id_${campo}`).isChecked();
    }
    return resultado;
  }

  /**
   * Expande todas las secciones colapsables del formulario con un solo click,
   * en vez de expandir sección por sección -- más simple y resistente a que
   * Moodle reordene o renombre secciones en el futuro. Tolerante a que el
   * botón no exista (por si algún formulario relacionado no lo tuviera).
   */
  private async expandirTodasLasSecciones() {
    const botonExpandir = this.page.getByRole('button', { name: 'Expandir todo' });
    if (await botonExpandir.count() > 0) {
      await botonExpandir.click();
    }
  }

  /** Extrae el course-module id (cmid) de la URL actual (mod/quiz/view.php?id=X). */
  async obtenerCmIdDeUrlActual(): Promise<number> {
    const url = this.page.url();
    const coincidencia = url.match(/[?&]id=(\d+)/);
    if (!coincidencia) {
      throw new Error(`No se pudo extraer el cmid de la URL actual: ${url}`);
    }
    return parseInt(coincidencia[1], 10);
  }
}
