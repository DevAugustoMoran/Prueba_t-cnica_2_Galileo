import { Page, expect } from '@playwright/test';
import { extraerParametroEntero } from './urlUtils';
import { descartarTourSiAparece } from './tourUtils';

export class CoursePage {
  constructor(private readonly page: Page) {}

  /**
   * Resuelve el id numérico del curso a partir de su shortname, vía la búsqueda
   * de gestión de cursos. Requiere una sesión con permiso para verla (admin).
   */
  async getCourseIdByShortname(shortname: string): Promise<number> {
    await this.page.goto(`/course/management.php?search=${encodeURIComponent(shortname)}`);

    const enlaceCurso = this.page.locator('a[href*="view.php?id="]').first();
    await expect(enlaceCurso).toBeVisible({ timeout: 10_000 });

    const href = await enlaceCurso.getAttribute('href');
    if (!href) {
      throw new Error(
        `No se encontró el curso con shortname "${shortname}". ¿Corriste "npm run seed"?`
      );
    }

    const coincidencia = href.match(/id=(\d+)/);
    if (!coincidencia) {
      throw new Error(`No se pudo extraer el id del curso desde el link: ${href}`);
    }
    return parseInt(coincidencia[1], 10);
  }

  /**
   * Resuelve el course-module id (cmid) de una actividad ya existente en el
   * curso, a partir de su nombre visible (ej. el link del examen en el índice
   * del curso). Útil para tests que operan sobre una actividad creada en un
   * test anterior (scope #1 creó "Examen QA E2E"; scope #3 necesita su cmid
   * para agregarle preguntas).
   */
  async getActivityCmId(courseId: number, nombreActividad: string): Promise<number> {
    await this.goto(courseId);

    const main = this.page.locator('[role="main"]');

    // El link de la actividad en el contenido principal incluye el tipo de
    // actividad pegado a su nombre accesible (ej. "Examen QA E2E
    // Cuestionario"), así que casi nunca hay match 100% exacto. Se prioriza
    // exacto por si acaso (evita ambigüedad si coexisten nombres con el
    // mismo prefijo, ej. "Examen QA E2E" vs "Examen QA E2E - Auto-envío" del
    // scope #7), y se cae a substring -- tomando el primero -- si no hay
    // ninguno exacto.
    let enlace = main.getByRole('link', { name: nombreActividad, exact: true });
    if ((await enlace.count()) === 0) {
      enlace = main.getByRole('link', { name: nombreActividad }).first();
    }

    await expect(enlace).toBeVisible({ timeout: 10_000 });

    const href = await enlace.getAttribute('href');
    if (!href) {
      throw new Error(`No se encontró el link de la actividad "${nombreActividad}".`);
    }
    return extraerParametroEntero(href, 'id', this.page.url());
  }

  async goto(courseId: number) {
    await this.page.goto(`/course/view.php?id=${courseId}`);
    await descartarTourSiAparece(this.page);
  }

  /**
   * Navega directo al formulario de alta de un examen nuevo en la sección
   * indicada, usando la misma URL a la que redirige el selector de actividades
   * de Moodle. Se omite deliberadamente clickear el modal del selector: es UI
   * genérica de Moodle (igual para cualquier tipo de actividad), no algo
   * específico del sistema de exámenes. Lo que este scope pide verificar --
   * crear y configurar un examen -- se ejercita completo igual, contra el
   * formulario real.
   */
  async gotoAddQuizForm(courseId: number, sectionNumber = 0) {
    await this.page.goto(
      `/course/modedit.php?add=quiz&type=&course=${courseId}&section=${sectionNumber}&return=0&sr=0`
    );
  }
}
