import { chromium } from '@playwright/test';
import { URLS } from '../constants/urls';
import { logger } from '../utils/logger';

/**
 * Simple script to navigate to Naukri login page.
 *
 * Run:
 *   npm run navigate:login
 *   npm run navigate:login:headed   (to see the browser)
 */

const HEADLESS = process.env.HEADLESS !== 'false';
const SLOW_MO = Number(process.env.SLOW_MO ?? 0);

async function main(): Promise<void> {
  logger.info(`Launching Chromium (headless=${HEADLESS})...`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    // Reduce headless bot-detection footprint (Naukri uses PerimeterX/Akamai)
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--start-maximized',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    // Real Chrome UA + geolocation + permissions help avoid "Access Denied"
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    geolocation: { latitude: 28.6139, longitude: 77.209 },
    permissions: ['geolocation'],
  });

  // Hide webdriver flag (basic stealth)
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  try {
    logger.info(`Navigating to ${URLS.login} ...`);
    await page.goto(URLS.login, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      logger.info('networkidle timeout ignored (analytics noise)');
    });

    const title = await page.title();
    logger.success(`Page loaded! Title: "${title}"`);
    logger.info(`Current URL: ${page.url()}`);

    // Naukri bot-wall shows "Access Denied" for datacenter/headless IPs
    if (/access denied/i.test(title) || /access denied/i.test(await page.content())) {
      await page.screenshot({ path: 'test-results/naukri-blocked.png' });
      logger.error(
        'Naukri returned "Access Denied" (bot protection). ' +
          'Run headed on your local machine: npm run navigate:login:headed'
      );
      return;
    }

    // Verify login form is visible (user-facing: placeholder / label / role, CSS fallback)
    const emailInput = page
      .getByPlaceholder(/email|username/i)
      .or(page.getByLabel(/email|username/i))
      .or(page.getByRole('textbox', { name: /email|username/i }))
      .or(page.locator('#usernameField'))
      .first();
    try {
      await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
      logger.success('Login form is visible — navigation successful.');
    } catch {
      await page.screenshot({ path: 'test-results/naukri-login-missing.png' });
      logger.error(
        'Login form not found. Selectors may have changed — run with HEADLESS=false ' +
          'and use: npm run codegen to re-record locators.'
      );
      return;
    }

    await page.screenshot({ path: 'test-results/naukri-login-page.png' });
    logger.info('Screenshot saved: test-results/naukri-login-page.png');
  } finally {
    await browser.close();
    logger.info('Browser closed.');
  }
}

main().catch((err) => {
  logger.error(`Navigation failed: ${(err as Error).message}`);
  process.exit(1);
});
