// Wrapper que corre el CLI de seed (local_qa_seed) DENTRO del contenedor de Moodle,
// vía `docker compose exec`. Se ejecuta desde qa-automation/, pero docker compose
// necesita correr desde la raíz del repo (donde está docker-compose.yml) -- por eso
// usamos `cwd: '..'`. Si tu estructura de carpetas es distinta, ajustá REPO_ROOT.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVICIO = process.env.MOODLE_COMPOSE_SERVICE || 'moodle';
const RESET = process.argv.includes('--reset');

const argsPhp = ['/var/www/html/local/qa_seed/cli/reset_y_seed.php'];
if (RESET) {
  argsPhp.push('--reset');
}

console.log(`[seed] Ejecutando en el servicio "${SERVICIO}": php ${argsPhp.join(' ')}`);

const resultado = spawnSync(
  'docker',
  ['compose', 'exec', '-T', SERVICIO, 'php', ...argsPhp],
  { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32' }
);

if (resultado.error) {
  console.error('[seed] No se pudo ejecutar docker compose. ¿Está Docker corriendo y el stack levantado?');
  console.error(resultado.error);
  process.exit(1);
}

process.exit(resultado.status ?? 1);
