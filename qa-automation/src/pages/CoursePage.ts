import { Page, expect } from '@playwright/test';

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

  async goto(courseId: number) {
    await this.page.goto(`/course/view.php?id=${courseId}`);
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
