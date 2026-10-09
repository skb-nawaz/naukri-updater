export function todayStamp(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Naukri bumps "Last updated" only when you SAVE the headline.
 * Appending the date keeps the headline fresh without changing meaning.
 * e.g. "QA Automation Engineer | Playwright | TypeScript" ->
 *      "QA Automation Engineer | Playwright | TypeScript | Updated 08-10-2026"
 */
export function withDateSuffix(headline: string): string {
  const clean = headline.replace(/\s*\|\s*Updated \d{2}-\d{2}-\d{4}\s*$/, '').trim();
  return `${clean} | Updated ${todayStamp()}`;
}

/** Remove our date suffix to compare / restore original headline. */
export function withoutDateSuffix(headline: string): string {
  return headline.replace(/\s*\|\s*Updated \d{2}-\d{2}-\d{4}\s*$/, '').trim();
}
