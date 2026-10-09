import { test as setup } from '@playwright/test';
import { LoginPage } from '../../src/pages/LoginPage';
import { env } from '../../src/utils/env';
import {
  hasValidSessionFile,
  isSessionLive,
  saveSession,
} from '../../src/utils/auth';

/**
 * Runs once before authenticated tests (see playwright.config.ts `dependencies`).
 * Reuses stored cookies if still live — only logs in fresh when expired.
 * Run manually: npx playwright test --project=setup
 */
setup('authenticate to Naukri', async ({ page }) => {
  // Fast path: session already live → keep it, don't risk a fresh login
  if (hasValidSessionFile() && (await isSessionLive(page))) {
    return;
  }
  const loginPage = new LoginPage(page);
  await loginPage.login(env.requireEmail(), env.requirePassword());
  await saveSession(page.context());
});
