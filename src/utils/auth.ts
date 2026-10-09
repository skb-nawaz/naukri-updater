import * as fs from 'fs';
import * as path from 'path';
import { BrowserContext, Page } from '@playwright/test';
import { URLS } from '../constants/urls';
import { logger } from './logger';

export const AUTH_FILE = path.resolve(process.cwd(), 'auth', 'naukri-auth.json');

/** Shared browser fingerprint — MUST match login time or Naukri invalidates session. */
export const BROWSER_FINGERPRINT = {
  viewport: { width: 1920, height: 1080 },
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
} as const;

type StorageState = {
  cookies: Array<{ name: string; domain: string; expires: number }>;
  origins?: Array<unknown>;
};

/** Quick disk check — file exists, has cookies, has Naukri session cookies. */
export function hasValidSessionFile(): boolean {
  try {
    if (!fs.existsSync(AUTH_FILE)) return false;
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const state = JSON.parse(raw) as StorageState;
    if (!state.cookies || state.cookies.length === 0) return false;
    // Naukri session markers — if none present, it's a logged-out state
    const names = state.cookies.map((c) => c.name.toLowerCase());
    const hasSessionCookie = names.some((n) =>
      ['nauk_at', 'nauk_aid', 'session', 'auth', 'token', 'naukri'].some((k) =>
        n.includes(k)
      )
    );
    // Even without known names, non-empty cookies + origins = likely valid.
    // Live check (isLoggedIn) is the real gate — this is just a fast pre-filter.
    return hasSessionCookie || state.cookies.length >= 3;
  } catch {
    return false;
  }
}

export function sessionStats(): string {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const state = JSON.parse(raw) as StorageState;
    const domains = [...new Set(state.cookies.map((c) => c.domain))].slice(0, 5);
    return `${state.cookies.length} cookies (${domains.join(', ')}) + ${state.origins?.length ?? 0} origins`;
  } catch {
    return 'unreadable';
  }
}

/** Persist cookies + localStorage. Call AFTER login success — never on failure. */
export async function saveSession(context: BrowserContext): Promise<void> {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  logger.success(`Session saved: ${sessionStats()} -> ${AUTH_FILE}`);
}

/**
 * Live check — does the stored session still log us in?
 * Opens profile page directly (no credentials) and looks for logged-in markers.
 */
export async function isSessionLive(page: Page): Promise<boolean> {
  try {
    await page.goto(URLS.profile, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    const title = await page.title().catch(() => '');
    if (/access denied/i.test(title)) {
      logger.warn('Bot-wall "Access Denied" during session check — retry headed (HEADLESS=false).');
      return false;
    }
    // Logged-out users get bounced to /nlogin
    if (/nlogin|login/i.test(page.url())) return false;
    // User-facing markers first: profile link (avatar menu) or Resume headline heading
    const avatar = page
      .getByRole('link', { name: /my naukri|view profile|profile/i })
      .or(page.locator('.nI-gNb-header__avatar, a[href*="/mnjuser/profile"]'))
      .first();
    const headline = page.getByRole('heading', { name: /resume headline/i }).first();
    return (
      (await avatar.isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await headline.isVisible({ timeout: 8000 }).catch(() => false))
    );
  } catch {
    return false;
  }
}
