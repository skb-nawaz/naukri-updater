import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from .env (fallback to .env.example values in code)
dotenv.config({ path: path.resolve(__dirname, '.env') });

const AUTH_FILE = path.resolve(__dirname, 'auth', 'naukri-auth.json');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Naukri blocks parallel logins from same account
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // keep 1 to avoid account lockout
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 90 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  use: {
    baseURL: 'https://www.naukri.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: process.env.HEADLESS !== 'false',
    // Full Chromium (new headless mode) — the headless-shell binary is
    // fingerprinted by Naukri's bot-wall and served "Access Denied".
    channel: 'chromium',
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    },
    viewport: { width: 1920, height: 1080 }, // full-HD headed window
    actionTimeout: 20 * 1000,
    navigationTimeout: 60 * 1000,
    // Spoof a real browser to reduce bot detection
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    // 1️⃣ Setup project — logs in once and saves storageState
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 2️⃣ Authenticated tests — reuse login session
    {
      name: 'chromium-authenticated',
      testMatch: /.*(profile-update|dashboard).*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },
    // 3️⃣ Unauthenticated tests (login itself)
    {
      name: 'chromium-unauthenticated',
      testMatch: /.*login.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
