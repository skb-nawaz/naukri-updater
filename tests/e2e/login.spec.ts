import { test } from '../../src/fixtures/base.fixture';
import { env } from '../../src/utils/env';
import { logger } from '../../src/utils/logger';

/**
 * Smoke test — verifies credentials work.
 * Run: npx playwright test --project=chromium-unauthenticated
 */
test.describe('Naukri Login', () => {
  test('should login with valid credentials', async ({ loginPage }) => {
    const email = env.requireEmail();
    const password = env.requirePassword();

    await loginPage.login(email, password);
    logger.success('Login smoke test passed');
  });
});
