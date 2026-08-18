import { Page } from '@playwright/test';

/**
 * Completa un campo de texto enriquecido de Moodle (TinyMCE). Moodle reemplaza
 * el <textarea id="fieldId"> original por un editor dentro de un <iframe
 * id="{fieldId}_ifr">, cuyo <body> es el área editable (contenteditable). Hay
 * que interactuar con ESE body, no con el textarea oculto -- TinyMCE recién
 * sincroniza el textarea al enviar el formulario, no en cada tecla.
 *
 * Confirmado que el sitio usa TinyMCE (no Atto) por evidencia real: el editor
 * de descripción del examen mostraba el link "Con tecnología de Tiny" en las
 * pruebas anteriores de este mismo proyecto.
 */
export async function fillRichText(page: Page, fieldId: string, texto: string) {
  const marco = page.frameLocator(`#${fieldId}_ifr`);
  const cuerpo = marco.locator('body');
  await cuerpo.click();
  await cuerpo.fill(texto);
}
