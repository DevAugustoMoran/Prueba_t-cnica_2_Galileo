import { Page } from '@playwright/test';

/**
 * receptor.php (Cambio 3) registra cada webhook recibido en un archivo de
 * texto plano en su misma carpeta (__DIR__ . '/bitacora_webhook.txt'), que
 * por estar dentro de una carpeta pública del plugin es directamente
 * accesible por HTTP -- no hace falta sesión ni permisos especiales para
 * leerlo, igual que cualquier archivo estático servido por Apache.
 *
 * OJO: este archivo vive en el FILESYSTEM, no en la base de datos, así que
 * un reset de curso (que sí borra y recrea todo lo que está en BD) NO lo
 * toca -- el contenido de corridas anteriores queda ahí. Por eso nunca se
 * verifica "tiene contenido" a secas, sino que crezca respecto a un
 * snapshot tomado antes de la acción que debería dispararlo.
 */
export async function leerBitacoraWebhook(page: Page): Promise<string> {
  const respuesta = await page.request.get('/local/mejoras_examen/bitacora_webhook.txt');
  if (!respuesta.ok()) {
    return '';
  }
  return respuesta.text();
}

/**
 * Sondea la bitácora hasta que crezca respecto al contenido dado, o hasta
 * agotar el timeout. El envío inmediato del Cambio 3 debería reflejarse casi
 * al toque, pero se sondea con margen por si hay alguna demora residual del
 * lado del servidor.
 */
export async function esperarNuevaEntradaEnBitacora(
  page: Page,
  contenidoAntes: string,
  timeoutMs = 10_000
): Promise<string> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const actual = await leerBitacoraWebhook(page);
    if (actual.length > contenidoAntes.length) {
      return actual;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(
    'La bitácora del webhook no creció dentro del tiempo esperado -- el envío no llegó a receptor.php.'
  );
}
