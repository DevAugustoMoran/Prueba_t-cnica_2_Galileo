import { Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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
 * Dispara admin/cli/cron.php a demanda, vía el mismo mecanismo que usa
 * scripts/seed.mjs (docker compose exec).
 *
 * El envío inmediato del Cambio 3 (dentro de la misma request que procesa el
 * intento) cubre el camino feliz rápido; el cron es la resiliencia real para
 * cuando ese camino no alcanza. Pero confirmado contra la instancia real, el
 * ciclo del cron en segundo plano del contenedor no es un simple "cada 60s":
 * cron.php mantiene una ventana interna de ~100s revisando tareas adhoc
 * antes de volver a evaluar las tareas PROGRAMADAS (como
 * procesar_webhooks), así que esperar pasivamente ese ciclo completo es
 * lento e impredecible para un test. Dispararlo a demanda hace que el test
 * sea determinístico en vez de depender de ese timing.
 */
export function dispararCronMoodle(): void {
  const servicio = process.env.MOODLE_COMPOSE_SERVICE || 'moodle';
  // process.cwd() siempre es qa-automation/ cuando corre la suite (igual que
  // en scripts/seed.mjs) -- la raíz del repo es un nivel arriba. Se evita
  // __dirname a propósito: no está garantizado según cómo Playwright
  // transpila los módulos (CJS vs ESM).
  const repoRoot = path.resolve(process.cwd(), '..');

  const resultado = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      servicio,
      'php',
      '/var/www/html/admin/cli/cron.php',
      // Sin esto, cron.php se queda ~100s revisando tareas adhoc antes de
      // devolver el control (confirmado contra --help del propio script:
      // "-k, --keep-alive=N Keep this script alive for N seconds..."). Acá
      // solo interesa que evalúe las tareas PROGRAMADAS (procesar_webhooks
      // entre ellas) y salga, no que se quede escuchando.
      '--keep-alive=0',
    ],
    { cwd: repoRoot, stdio: 'pipe', shell: process.platform === 'win32' }
  );

  if (resultado.error) {
    throw new Error(
      `No se pudo disparar cron.php vía docker compose: ${resultado.error.message}`
    );
  }
}

/**
 * Sondea la bitácora en dos fases:
 *   1. Espera corta, dándole chance al envío inmediato del Cambio 3 (el
 *      camino feliz rápido, dentro de la misma request que procesa el
 *      intento).
 *   2. Si no llegó, dispara cron.php a demanda (en vez de seguir esperando
 *      pasivamente el loop de fondo del contenedor) y vuelve a sondear.
 *      Confirmado contra la instancia real que ese loop de fondo no es un
 *      simple "cada 60s": cron.php mantiene una ventana interna de ~100s
 *      revisando tareas adhoc antes de reevaluar las tareas PROGRAMADAS
 *      (procesar_webhooks incluida), así que esperarlo pasivamente es lento
 *      e impredecible para un test -- dispararlo a demanda lo hace
 *      determinístico.
 */
export async function esperarNuevaEntradaEnBitacora(
  page: Page,
  contenidoAntes: string,
  opciones: { timeoutInmediatoMs?: number; timeoutTrasCronMs?: number } = {}
): Promise<string> {
  const { timeoutInmediatoMs = 8_000, timeoutTrasCronMs = 20_000 } = opciones;

  const inicioFase1 = Date.now();
  while (Date.now() - inicioFase1 < timeoutInmediatoMs) {
    const actual = await leerBitacoraWebhook(page);
    if (actual.length > contenidoAntes.length) {
      return actual;
    }
    await page.waitForTimeout(500);
  }

  dispararCronMoodle();

  const inicioFase2 = Date.now();
  while (Date.now() - inicioFase2 < timeoutTrasCronMs) {
    const actual = await leerBitacoraWebhook(page);
    if (actual.length > contenidoAntes.length) {
      return actual;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(
    'La bitácora del webhook no creció ni con el envío inmediato ni forzando cron.php -- el envío no llegó a receptor.php.'
  );
}
