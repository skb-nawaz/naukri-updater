import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { URLS } from '../constants/urls';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── User-facing locators first (getByRole/Label/Placeholder), CSS only as last-resort fallback ──
  private get emailInput() {
    return this.page
      .getByPlaceholder(/email|username/i)
      .or(this.page.getByLabel(/email|username/i))
      .or(this.page.getByRole('textbox', { name: /email|username/i }))
      .or(this.page.locator('#usernameField'))
      .first();
  }

  private get passwordInput() {
    return this.page
      .getByPlaceholder(/password/i)
      .or(this.page.getByLabel(/password/i))
      .or(this.page.locator('input[type="password"], #passwordField'))
      .first();
  }

  private get loginButton() {
    return this.page
      .getByRole('button', { name: /^login$/i })
      .or(this.page.locator('button[type="submit"]'))
      .first();
  }

  private get profileAvatar() {
    // Visible only when logged in (MyNaukri menu / profile link)
    return this.page
      .getByRole('link', { name: /my naukri|view profile|profile/i })
      .or(this.page.getByRole('img', { name: /profile|avatar|my naukri/i }))
      .or(this.page.locator('.nI-gNb-header__avatar, a[href*="/mnjuser/profile"]'))
      .first();
  }

  private get loginError() {
    return this.page
      .getByRole('alert')
      .or(this.page.getByText(/invalid|incorrect|failed|error|wrong/i))
      .first();
  }

  // ── Actions ──

  async open(): Promise<void> {
    await this.goto(URLS.login);
    await this.dismissPopups();
  }

  async login(email: string, password: string): Promise<void> {
    await this.open();
    await this.fill(this.emailInput, email, 'Email (masked in logs)', true);
    await this.fill(this.passwordInput, password, 'Password', true);
    await this.click(this.loginButton, 'Login button');

    // Naukri sometimes shows CAPTCHA / OTP — give user 60s to solve manually in headed mode
    try {
      await expect(this.profileAvatar).toBeVisible({ timeout: 60_000 });
      this.log('Login successful — avatar visible');
    } catch {
      if (await this.loginError.isVisible().catch(() => false)) {
        const msg = await this.loginError.innerText().catch(() => 'unknown error');
        throw new Error(`Naukri login failed: ${msg}`);
      }
      // Take a screenshot so the user can see CAPTCHA/OTP state
      await this.page.screenshot({ path: 'test-results/login-blocked.png' });
      throw new Error(
        'Login did not complete in 60s. If headed, solve CAPTCHA/OTP manually. Screenshot: test-results/login-blocked.png'
      );
    }
  }

  async isLoggedIn(): Promise<boolean> {
    return this.profileAvatar.isVisible({ timeout: 10_000 }).catch(() => false);
  }
}
