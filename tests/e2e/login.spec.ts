import { test } from '../../src/fixtures/base.fixture';
import { env } from '../../src/utils/env';
import { logger } from '../../src/utils/logger';

/**
 * Smoke test — verifies credentials work.
 * Run: npx playwright test --project=chromium-unauthenticated
 */
test.describe('Naukri Login', () => {
  test('should login with valid credentials', async ({ loginPage }) => {
    // Unattended runs (Jenkins) can't solve the image CAPTCHA Naukri throws
    // on a fresh password login — auth is covered by the stored session
    // (setup project) there. Run locally: npm run test:login
    test.skip(
      !!process.env.CI,
      'Fresh login shows CAPTCHA — run locally with: npm run test:login'
    );
    const email = env.requireEmail();
    const password = env.requirePassword();

    await loginPage.login(email, password);
    logger.success('Login smoke test passed');
  });
});
