import * as fs from 'fs';
import * as path from 'path';
import { AUTH_FILE, hasValidSessionFile, sessionStats } from '../utils/auth';
import { logger } from '../utils/logger';

/**
 * Export stored session for GitHub Actions (OTP workaround).
 *
 * Why: GitHub runners use datacenter IPs -> fresh password login triggers
 * OTP every time. Reusing a session created on your trusted home IP skips
 * the password step entirely (auth.setup.ts fast-path) and avoids OTP
 * until the session expires.
 *
 * Usage:
 *   1. npm run login          (headed, solve OTP manually once)
 *   2. npm run session:export (prints base64, copy it)
 *   3. GitHub -> Settings -> Secrets -> Actions -> New secret:
 *      NAUKRI_STORAGE_STATE = <pasted base64>
 *   4. Re-run workflow. When session expires (days/weeks), repeat.
 */
async function main(): Promise<void> {
  if (!hasValidSessionFile()) {
    logger.error(`No session file at ${AUTH_FILE}. Run: npm run login (solve OTP manually)`);
    process.exit(1);
  }
  const raw = fs.readFileSync(AUTH_FILE, 'utf8');
  // Validate it's JSON before exporting
  JSON.parse(raw);
  const b64 = Buffer.from(raw, 'utf8').toString('base64');
  const outFile = path.resolve(process.cwd(), 'auth', 'naukri-auth.b64.txt');
  fs.writeFileSync(outFile, b64, 'utf8');
  logger.success(`Session ready: ${sessionStats()}`);
  logger.info(`Wrote: ${outFile} (${b64.length} chars)`);
  logger.info('Next: copy its contents into GitHub secret NAUKRI_STORAGE_STATE');
  logger.info('PowerShell copy: Get-Content auth\\naukri-auth.b64.txt | Set-Clipboard');
}

main().catch((e) => {
  logger.error((e as Error).message);
  process.exit(1);
});
