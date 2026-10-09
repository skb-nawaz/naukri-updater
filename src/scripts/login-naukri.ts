import { chromium } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import {
  AUTH_FILE,
  BROWSER_FINGERPRINT,
  hasValidSessionFile,
  isSessionLive,
  saveSession,
  sessionStats,
} from '../utils/auth';

/**
 * Smart login — reuses stored cookies if still live, else logs in fresh.
 *   npm run login
 *
 * Why: every fresh login risks CAPTCHA / OTP / account lock.
 * Reusing storageState (cookies + localStorage) avoids blockers.
 */
async function main(): Promise<void> {
  const HEADLESS = process.env.HEADLESS !== 'false';

  // 1️⃣ Fast path — reuse stored session if it still works (no credentials needed)
  if (hasValidSessionFile()) {
    logger.info(`Found session (${sessionStats()}). Validating without password...`);
    const checkBrowser = await chromium.launch({
      headless: HEADLESS,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
    });
    try {
      const checkCtx = await checkBrowser.newContext({
        ...BROWSER_FINGERPRINT,
        storageState: AUTH_FILE,
      });
      const checkPage = await checkCtx.newPage();
      if (await isSessionLive(checkPage)) {
        logger.success('Stored session is still live — skipping fresh login (fewer blocks).');
        await checkCtx.close();
        await checkBrowser.close();
        return;
      }
      logger.info('Stored session expired — will login fresh.');
      await checkCtx.close();
    } finally {
      await checkBrowser.close();
    }
  }

  const email = env.requireEmail();
  const password = env.requirePassword();

  const masked = email.length > 4 ? `${email.slice(0, 2)}****${email.slice(-2)}` : '****';
  logger.info(`Logging in as ${masked} (headless=${HEADLESS})...`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
  });
  const context = await browser.newContext({ ...BROWSER_FINGERPRINT });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);

  try {
    await loginPage.login(email, password);
    logger.success('Login successful!');
    await saveSession(context);
    await page.screenshot({ path: 'test-results/naukri-logged-in.png' });
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  logger.error(`Login failed: ${(e as Error).message}`);
  process.exit(1);
});
