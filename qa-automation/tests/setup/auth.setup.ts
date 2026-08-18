import { test as setup } from '@playwright/test';
import { LoginPage } from '../../src/pages/LoginPage';
import { config } from '../../src/config';

const ARCHIVO_ADMIN = '.auth/admin.json';
const ARCHIVO_PROFESOR = '.auth/teacher.json';
const ARCHIVO_ESTUDIANTE = '.auth/student.json';

setup('autenticar admin', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(config.admin.username, config.admin.password);
  await page.context().storageState({ path: ARCHIVO_ADMIN });
});

setup('autenticar profesor', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(config.teacher.username, config.teacher.password);
  await page.context().storageState({ path: ARCHIVO_PROFESOR });
});

setup('autenticar estudiante', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(config.student.username, config.student.password);
  await page.context().storageState({ path: ARCHIVO_ESTUDIANTE });
});
