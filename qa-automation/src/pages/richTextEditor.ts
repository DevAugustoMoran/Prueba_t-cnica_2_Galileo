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
  // Los ids dinámicos de Moodle en las respuestas de un intento tienen la
  // forma "q{usageid}:{slot}_answer_id" -- el ":" es un carácter especial de
  // CSS (arranca una pseudo-clase), así que un selector de ID clásico
  // (#valor) rompe con "Unexpected token" apenas el id trae uno. Un selector
  // de atributo con el valor entre comillas ([id="valor"]) lo trata como
  // texto literal, sin ese problema.
  const marco = page.frameLocator(`iframe[id="${fieldId}_ifr"]`);
  const cuerpo = marco.locator('body');
  await cuerpo.click();
  await cuerpo.fill(texto);
}
