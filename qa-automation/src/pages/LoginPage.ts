import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/login/index.php');
  }

  async loginAs(username: string, password: string) {
    await this.goto();
    await this.page.locator('#username').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#loginbtn').click();

    // Assert real: si el login falló, Moodle vuelve a mostrar el formulario con un
    // mensaje de error visible. Si tuvo éxito, aparece el menú de usuario logueado.
    const errorLogin = this.page.locator('#loginerrormessage, .loginerrors');
    const menuUsuario = this.page.locator('.usermenu, [data-region="drawer"] .userinitials');

    await Promise.race([
      menuUsuario.first().waitFor({ state: 'visible', timeout: 15_000 }),
      errorLogin.first().waitFor({ state: 'visible', timeout: 15_000 }),
    ]);

    if (await errorLogin.count() > 0 && await errorLogin.first().isVisible()) {
      const mensaje = await errorLogin.first().innerText();
      throw new Error(`Login fallido para "${username}": ${mensaje}`);
    }

    await expect(menuUsuario.first()).toBeVisible();
  }
}
