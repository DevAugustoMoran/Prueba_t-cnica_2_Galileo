import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.MOODLE_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',

  // Los tests de examen comparten estado real del curso (crean el mismo examen,
  // lo rinden, lo califican) -- correrlos en paralelo generaría condiciones de
  // carrera. Se corren en serie, por diseño, no por limitación.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Evidencia de cada corrida: reporte HTML navegable, trace y video SOLO en
  // fallos (para no acumular gigabytes en corridas verdes), y un JSON para que
  // el reporte de cobertura pueda cruzarse programáticamente si hace falta.
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    locale: 'es-ES',
  },

  projects: [
    {
      // Loguea admin/profesor/alumno una sola vez y guarda su sesión; el resto
      // de los proyectos depende de este, así que Playwright lo corre primero
      // automáticamente con un solo `npx playwright test`.
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },
  ],
});
