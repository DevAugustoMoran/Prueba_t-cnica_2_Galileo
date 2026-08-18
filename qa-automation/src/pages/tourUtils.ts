import { Page } from '@playwright/test';

/**
 * Moodle muestra distintos tours de onboarding la primera vez que se visita
 * ciertas pantallas en un contexto nuevo (uno en la página del curso,
 * "Activar modo de edición"; otro en el gradebook, "Encontrar estudiantes
 * fácilmente"; puede haber más). Todos comparten el mismo botón "Salir del
 * tour". El tour lo carga un módulo JS aparte que renderiza con un pequeño
 * delay después del contenido principal: un chequeo instantáneo (.count())
 * corre antes de que aparezca y siempre da 0, por eso se espera activamente
 * un par de segundos, tolerando que nunca aparezca.
 */
export async function descartarTourSiAparece(page: Page) {
  const botonSalir = page.getByRole('button', { name: 'Salir del tour' });
  try {
    await botonSalir.waitFor({ state: 'visible', timeout: 3_000 });
    await botonSalir.click();
  } catch {
    // El tour no apareció en este load -- no hay nada que descartar.
  }
}
