import { test as base, Page, Browser } from '@playwright/test';
import * as path from 'path';

type FixturesPorRol = {
  adminPage: Page;
  teacherPage: Page;
  studentPage: Page;
};

const authDir = path.resolve(__dirname, '../../.auth');

async function paginaConSesion(browser: Browser, archivoStorageState: string): Promise<Page> {
  const context = await browser.newContext({
    storageState: path.join(authDir, archivoStorageState),
  });
  return context.newPage();
}

/**
 * Extiende el test base de Playwright con tres fixtures listas para usar:
 * adminPage, teacherPage, studentPage. Cada una es una Page en su PROPIO
 * contexto de navegador (con la sesión ya autenticada, cargada desde el
 * storageState que generó tests/setup/auth.setup.ts) -- así un mismo test
 * puede tener, por ejemplo, al profesor y al alumno interactuando en paralelo
 * (necesario para varios escenarios: el alumno rinde mientras el profesor
 * revisa, o el profesor califica y el alumno ve el resultado actualizado).
 */
export const test = base.extend<FixturesPorRol>({
  adminPage: async ({ browser }, use) => {
    const page = await paginaConSesion(browser, 'admin.json');
    await use(page);
    await page.context().close();
  },
  teacherPage: async ({ browser }, use) => {
    const page = await paginaConSesion(browser, 'teacher.json');
    await use(page);
    await page.context().close();
  },
  studentPage: async ({ browser }, use) => {
    const page = await paginaConSesion(browser, 'student.json');
    await use(page);
    await page.context().close();
  },
});

export { expect } from '@playwright/test';
