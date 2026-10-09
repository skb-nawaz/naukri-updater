import { withDateSuffix } from '../utils/dateUtils';

/**
 * Central place for the headline(s) you want to rotate.
 * Add your own variants — the framework picks one per day so
 * every run saves something slightly different (bumps profile rank).
 */
export const HEADLINE_VARIANTS: string[] = [
  'QA Automation Engineer | Playwright | TypeScript | Selenium | API Testing',
  'SDET | Playwright TypeScript | Automation Frameworks | CI/CD | API Testing',
  'Senior QA Engineer | UI + API Automation | Playwright | RestAssured | Jenkins',
];

/** Pick a deterministic variant based on day-of-year (no randomness). */
export function headlineForToday(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const base = HEADLINE_VARIANTS[dayOfYear % HEADLINE_VARIANTS.length];
  return withDateSuffix(base);
}

export const PROFILE_DATA = {
  // If NAUKRI_NEW_HEADLINE is set in .env it wins, else we rotate.
  fallbackHeadline: headlineForToday(),
} as const;
