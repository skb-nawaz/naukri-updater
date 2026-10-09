import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { encrypt, generateKey } from '../utils/cryptoUtils';

const ENV_PATH = path.resolve(process.cwd(), '.env');

function mask(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)} (len=${value.length})`;
}

/**
 * Helper to encrypt Naukri credentials into .env
 *
 *   npm run encrypt:key                        -> print a new ENCRYPTION_KEY
 *   npm run encrypt:creds -- --email X --password Y [--save]
 *     without --save: prints encrypted payloads
 *     with --save: writes ENCRYPTION_KEY (if missing) + *_ENCRYPTED into .env
 */
function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--generate-key' || a === '--save') {
      out[a.replace('--', '')] = true;
    } else if (a === '--email' || a === '--password') {
      out[a.replace('--', '')] = args[i + 1] ?? '';
      i++;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const opts = parseArgs();

  if (opts['generate-key']) {
    console.log(generateKey());
    return;
  }

  const email = opts['email'] as string;
  const password = opts['password'] as string;

  if (!email || !password) {
    console.error(
      'Usage: npm run encrypt:creds -- --email <email> --password <pwd> [--save]'
    );
    process.exit(1);
  }

  // Ensure .env exists and has a key
  dotenv.config({ path: ENV_PATH });
  let key = process.env.ENCRYPTION_KEY;
  if (!key) {
    key = generateKey();
    console.log('[encrypt] Generated new ENCRYPTION_KEY');
  }
  process.env.ENCRYPTION_KEY = key;

  const encEmail = encrypt(email);
  const encPass = encrypt(password);

  console.log(`[encrypt] Email ${mask(email)} -> encrypted (len=${encEmail.length})`);
  console.log('[encrypt] Password ******** -> encrypted (len=' + encPass.length + ')');

  if (opts['save']) {
    let content = '';
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, 'utf8');
    }

    const upsert = (name: string, value: string) => {
      const line = `${name}=${value}`;
      const re = new RegExp(`^${name}=.*$`, 'm');
      if (re.test(content)) {
        content = content.replace(re, line);
      } else {
        content += (content.endsWith('\n') || content === '' ? '' : '\n') + line + '\n';
      }
    };

    upsert('ENCRYPTION_KEY', key);
    upsert('NAUKRI_EMAIL_ENCRYPTED', encEmail);
    upsert('NAUKRI_PASSWORD_ENCRYPTED', encPass);

    // Remove plaintext if present (avoid leaving secrets on disk)
    content = content.replace(/^NAUKRI_EMAIL=(?!_ENCRYPTED).*$/m, '# NAUKRI_EMAIL=<removed - using encrypted>');
    content = content.replace(/^NAUKRI_PASSWORD=(?!_ENCRYPTED).*$/m, '# NAUKRI_PASSWORD=<removed - using encrypted>');

    fs.writeFileSync(ENV_PATH, content);
    console.log('[encrypt] Saved ENCRYPTION_KEY + *_ENCRYPTED to .env (plaintext removed)');
  } else {
    console.log(`NAUKRI_EMAIL_ENCRYPTED=${encEmail}`);
    console.log(`NAUKRI_PASSWORD_ENCRYPTED=${encPass}`);
    console.log(`ENCRYPTION_KEY=${key}`);
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
