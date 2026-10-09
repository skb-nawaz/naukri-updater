import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string, fallback = ''): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `[env] Missing required env var "${name}". Copy .env.example to .env and fill it.`
    );
  }
  return value;
}

function resolveSecret(encryptedName: string, plainName: string): string {
  const enc = (process.env[encryptedName] ?? '').trim();
  if (enc) {
    // Lazy import to avoid circular deps + allow missing key error to surface clearly
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decrypt } = require('./cryptoUtils') as typeof import('./cryptoUtils');
    try {
      return decrypt(enc);
    } catch (e) {
      throw new Error(
        `[env] Failed to decrypt ${encryptedName}: ${(e as Error).message}`
      );
    }
  }
  return (process.env[plainName] ?? '').trim();
}

export const env = {
  get email(): string {
    return resolveSecret('NAUKRI_EMAIL_ENCRYPTED', 'NAUKRI_EMAIL');
  },
  get password(): string {
    return resolveSecret('NAUKRI_PASSWORD_ENCRYPTED', 'NAUKRI_PASSWORD');
  },
  newHeadline: process.env.NAUKRI_NEW_HEADLINE ?? '',
  headlineRotate: process.env.HEADLINE_ROTATE === 'true',
  headless: process.env.HEADLESS !== 'false',
  slowMo: Number(process.env.SLOW_MO ?? 0),

  requireEmail(): string {
    const v = this.email || required('NAUKRI_EMAIL_ENCRYPTED');
    if (!v) throw new Error('[env] Missing email. Set NAUKRI_EMAIL_ENCRYPTED via encrypt:creds.');
    return v;
  },
  requirePassword(): string {
    const v = this.password || required('NAUKRI_PASSWORD_ENCRYPTED');
    if (!v) throw new Error('[env] Missing password. Set NAUKRI_PASSWORD_ENCRYPTED via encrypt:creds.');
    return v;
  },
};
