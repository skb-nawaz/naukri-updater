import { test } from '../../src/fixtures/base.fixture';
import { env } from '../../src/utils/env';
import { logger } from '../../src/utils/logger';

/**
 * Smoke test — verifies credentials work.
 * Run: npx playwright test --project=chromium-unauthenticated
 */
test.describe('Naukri Login', () => {
  test('should login with valid credentials', async ({ loginPage }) => {
    // Fresh password login is forced into OTP flow on CI datacenter IPs —
    // cloud auth is covered by session reuse (NAUKRI_STORAGE_STATE) instead.
    test.skip(
      !!process.env.CI,
      'Fresh login hits OTP on CI datacenter IPs — session reuse (auth.setup) covers auth'
    );
    const email = env.requireEmail();
    const password = env.requirePassword();

    await loginPage.login(email, password);
    logger.success('Login smoke test passed');
  });
});
