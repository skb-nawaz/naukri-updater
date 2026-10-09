import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';

/**
 * Custom fixtures — Page Objects auto-injected into every test.
 *
 * Usage:
 *   import { test, expect } from '../../src/fixtures/base.fixture';
 *   test('...', async ({ loginPage, profilePage }) => { ... });
 */

type PageFixtures = {
  loginPage: LoginPage;
  profilePage: ProfilePage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
});

export { expect };
