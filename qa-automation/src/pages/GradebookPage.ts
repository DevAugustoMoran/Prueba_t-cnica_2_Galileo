import { Page, expect } from '@playwright/test';
import { descartarTourSiAparece } from './tourUtils';

export class GradebookPage {
  constructor(private readonly page: Page) {}

  async gotoGraderReport(courseId: number) {
    await this.page.goto(`/grade/report/grader/index.php?id=${courseId}&edit=1`);
    await descartarTourSiAparece(this.page);

    // El parámetro ?edit=1 no alcanza por sí solo (confirmado contra la
    // instancia real: el checkbox global "Modo de edición" de la barra de
    // navegación seguía destildado incluso con ese parámetro). Ese
    // checkbox es el que realmente determina si las celdas de nota se
    // renderizan como <input> editables o como texto plano -- se activa
    // directamente si no lo está ya.
    const toggleEdicion = this.page.getByRole('checkbox', { name: 'Modo de edición' });
    if (!(await toggleEdicion.isChecked())) {
      await toggleEdicion.check();
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Lee la nota actualmente mostrada para un alumno (asume una sola
   * actividad calificable en el curso -- toma el primer input numérico de
   * su fila).
   */
  async leerNota(nombreAlumno: string): Promise<string> {
    const fila = this.page.locator('tr', { hasText: nombreAlumno });
    await expect(fila).toBeVisible({ timeout: 10_000 });
    return fila.locator('input[type="text"], input[type="number"]').first().inputValue();
  }

  /**
   * Sobrescribe la nota de un alumno en el Informe del calificador.
   *
   * Confirmado contra grade/report/grader/lib.php: con "Calificación
   * rápida" activa (habilitada por defecto a nivel de sitio --
   * admin_setting_configcheckbox('grade_report_quickgrading', ..., 1)),
   * cada celda editable es un <input name="grade[{userid}][{itemid}]">.
   * Como no se resuelven userid/itemid de antemano, se ubica el input
   * dentro de la fila del alumno (por su nombre visible) -- en este curso,
   * con una sola actividad calificable, es el único input de esa fila.
   *
   * Escribir directamente sobre esta celda y guardar es, por definición en
   * Moodle, lo que constituye un "override": la nota calculada por el
   * módulo queda protegida de recálculos automáticos futuros.
   */
  async sobrescribirNota(nombreAlumno: string, nuevaNota: string) {
    const fila = this.page.locator('tr', { hasText: nombreAlumno });
    await expect(fila).toBeVisible({ timeout: 10_000 });

    const campoNota = fila.locator('input[type="text"], input[type="number"]').first();
    await campoNota.fill(nuevaNota);

    // Id estable confirmado contra grade/report/grader/index.php.
    await this.page.locator('#gradersubmit').click();
  }
}