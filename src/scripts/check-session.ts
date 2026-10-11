import { chromium } from '@playwright/test';
import {
  AUTH_FILE,
  BROWSER_FINGERPRINT,
  hasValidSessionFile,
  isSessionLive,
  sessionStats,
} from '../utils/auth';
import { logger } from '../utils/logger';

/**
 * Verify stored cookies work WITHOUT using credentials.
 *   npm run session:check
 * Exit 0 = live, Exit 1 = expired/missing (run `npm run login`).
 */
async function main(): Promise<void> {
  if (!hasValidSessionFile()) {
    logger.error(`No session file at ${AUTH_FILE}. Run: npm run login`);
    process.exit(1);
  }
  logger.info(`Checking session (${sessionStats()})...`);
  const HEADLESS = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
  });
  try {
    const ctx = await browser.newContext({
      ...BROWSER_FINGERPRINT,
      storageState: AUTH_FILE,
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    const page = await ctx.newPage();
    if (await isSessionLive(page)) {
      logger.success('Session is LIVE — future runs will skip login, no blockers.');
    } else {
      logger.error('Session EXPIRED (redirected to login). Run: npm run login');
      process.exit(1);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  logger.error((e as Error).message);
  process.exit(1);
});
