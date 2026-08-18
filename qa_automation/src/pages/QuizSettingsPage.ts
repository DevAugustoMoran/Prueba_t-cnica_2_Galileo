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

    await this.page.locator('#id_submitbutton, input[name="submitbutton"]').first().click();

    // Assert real de que Moodle aceptó el formulario y navegó a la vista del
    // examen recién creado (no se quedó en el form con errores de validación).
    await expect(this.page).toHaveURL(/mod\/quiz\/view\.php\?id=\d+/, { timeout: 15_000 });
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
