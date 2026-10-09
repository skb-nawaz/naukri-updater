import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { URLS } from '../constants/urls';
import { logger } from '../utils/logger';

/**
 * ProfilePage — https://www.naukri.com/mnjuser/profile
 * Handles the daily "touch" that refreshes your
 * "Last Active / Last Updated" timestamp recruiters sort by.
 */
export class ProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Section locators: user-facing first (getByRole/Text), CSS only as fallback ──
  private get resumeHeadlineHeading() {
    return this.page.getByRole('heading', { name: /resume headline/i }).first();
  }

  private get resumeHeadlineText() {
    // Reader: proven CSS card selector (finds headline text incl. UI junk, cleaned later).
    // No stable accessible name exists for the arbitrary headline string itself,
    // so CSS is kept here; all ACTIONS use getByRole below.
    return this.page.locator('.resumeHeadline, [class*="resume-headline"]').first();
  }

  private headlineEditButton() {
    // Exact accessible name from snapshot: button "Edit resume headline"
    return this.page.getByRole('button', { name: /Edit resume headline/i }).first();
  }

  private get headlineTextarea() {
    // Headline modal input — user-facing dialog textbox first
    return this.page
      .getByRole('dialog')
      .getByRole('textbox', { name: /headline|resume/i })
      .or(this.page.getByPlaceholder(/headline/i))
      .or(this.page.locator('[role="dialog"] textarea, [role="dialog"] input[type="text"], textarea#resumeHeadline').first())
      .first();
  }

  private get saveButton() {
    // Scope Save to the open dialog (page has multiple Save buttons — Basic details etc.)
    return this.page
      .getByRole('dialog')
      .getByRole('button', { name: /^save$/i })
      .or(this.page.locator('[role="dialog"] button:has-text("Save")'))
      .first();
  }

  private get lastUpdatedLabel() {
    return this.page.getByText(/last updated|profile last updated/i).first();
  }

  // ── Actions ──

  async open(): Promise<void> {
    await this.goto(URLS.profile);
    await this.dismissPopups();
    // Profile page loads sections lazily — wait for headline heading (user-facing)
    await this.expectVisible(this.resumeHeadlineHeading, 'Resume Headline heading');
    logger.success('Profile page loaded');
  }

  async getResumeHeadline(): Promise<string> {
    try {
      const raw = await this.getText(this.resumeHeadlineText);
      // Strip UI chrome that leaks into the container text:
      // e.g. "Resume headlineeditOneTheme\nSenior QA ..." -> "Senior QA ..."
      const clean = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !/^resume headline$/i.test(l) &&
            !/^resume headline\s*edit.*$/i.test(l) &&
            !/^edit(\s*resume\s*headline)?$/i.test(l) &&
            !/^edit.*onetheme$/i.test(l) &&
            !/^onetheme$/i.test(l) &&
            !/^editoneTheme$/i.test(l)
        )
        .join('\n')
        .replace(/^Resume headlineeditOneTheme\s*/i, '')
        .replace(/^Edit resume headline\s*/i, '')
        .trim();
      logger.info(`Current headline (${clean.length} chars): "${clean.slice(0, 120)}${clean.length > 120 ? '…' : ''}"`);
      return clean;
    } catch {
      logger.warn('Could not read headline text (selector may have changed)');
      return '';
    }
  }

  /**
   * Core automation: replace the Resume Headline and Save.
   * Saving — even with the same text — refreshes "Last Updated".
   */
  async updateResumeHeadline(newHeadline: string): Promise<void> {
    const before = await this.getResumeHeadline();

    // Close any stray modal from a previous mis-click (e.g. Basic details)
    await this.page.keyboard.press('Escape').catch(() => {});

    await this.click(this.headlineEditButton(), 'Edit resume headline button');

    await this.expectVisible(this.headlineTextarea, 'Headline textarea');
    await this.fill(this.headlineTextarea, newHeadline, 'New headline');
    await this.click(this.saveButton, 'Save headline');

    // Verify save: modal closes + headline text updates
    await this.headlineTextarea.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await expect(this.resumeHeadlineText).toContainText(
      newHeadline.slice(0, 30), // partial match — Naukri may truncate
      { timeout: 15_000 }
    );

    logger.success(`Headline updated:\n  BEFORE: "${before}"\n  AFTER:  "${newHeadline}"`);
  }

  /**
   * "Touch" strategy — re-save the EXISTING headline untouched.
   * Use when you don't want to change text but still bump the date.
   */
  async touchResumeHeadline(): Promise<void> {
    const current = await this.getResumeHeadline();
    if (!current) throw new Error('Cannot touch headline: could not read current value');
    await this.updateResumeHeadline(current);
  }

  async getLastUpdatedText(): Promise<string> {
    try {
      return await this.getText(this.lastUpdatedLabel);
    } catch {
      return 'Last-updated label not found (Naukri changed DOM)';
    }
  }
}
