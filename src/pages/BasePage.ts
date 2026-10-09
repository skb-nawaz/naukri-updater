import { Page, Locator, expect } from '@playwright/test';
import { logger } from '../utils/logger';

/**
 * BasePage — shared helpers for every Page Object.
 * Keeps selectors resilient and adds logging + auto-waiting.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected log(action: string) {
    logger.info(`[${this.constructor.name}] ${action}`);
  }

  async goto(url: string): Promise<void> {
    this.log(`Navigating to ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      // Naukri fires continuous analytics requests — networkidle may never hit.
      this.log('networkidle timeout ignored (analytics noise)');
    });
  }

  async click(locator: Locator, name: string): Promise<void> {
    this.log(`Click: ${name}`);
    await locator.waitFor({ state: 'visible', timeout: 20_000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
  }

  async fill(locator: Locator, value: string, name: string, sensitive = false): Promise<void> {
    const isSensitive = sensitive || /password|secret|token|otp/i.test(name);
    const display = isSensitive ? `******** (len=${value.length})` : `${value.slice(0, 60)}${value.length > 60 ? '…' : ''}`;
    this.log(`Fill ${name}: ${display}`);
    await locator.waitFor({ state: 'visible', timeout: 20_000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value);
  }

  async getText(locator: Locator): Promise<string> {
    await locator.waitFor({ state: 'visible', timeout: 20_000 });
    return (await locator.innerText()).trim();
  }

  async expectVisible(locator: Locator, name: string): Promise<void> {
    await expect(locator, `${name} should be visible`).toBeVisible({ timeout: 20_000 });
  }

  /** Dismiss common Naukri popups (notifications, chat, cookies) — user-facing roles first. */
  async dismissPopups(): Promise<void> {
    const popupClosers = [
      this.page.getByRole('button', { name: /allow/i }).first(),
      this.page.getByRole('button', { name: /accept.*cookie|accept all|got it/i }).first(),
      this.page.getByRole('button', { name: /close/i }).first(),
      this.page.locator('.crossIcon.chatBot_discovery').first(),
    ];
    for (const popup of popupClosers) {
      try {
        if (await popup.isVisible({ timeout: 2000 })) {
          await popup.click({ timeout: 3000 });
          this.log('Dismissed a popup');
        }
      } catch {
        /* ignore — popup not present */
      }
    }
    // Press Escape to close any modal overlay
    await this.page.keyboard.press('Escape').catch(() => {});
  }
}
