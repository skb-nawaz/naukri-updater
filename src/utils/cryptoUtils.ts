import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit, standard for GCM

/**
 * Encrypt / decrypt sensitive data (email, password) stored in .env.
 *
 * Format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 * Key: 32-byte hex string in ENCRYPTION_KEY (generate with `npm run encrypt:creds -- --generate-key`)
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      '[crypto] Missing ENCRYPTION_KEY in .env. Run: npm run encrypt:creds -- --generate-key'
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `[crypto] ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes.`
    );
  }
  return key;
}

export function encrypt(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('[crypto] Invalid encrypted payload format. Expected iv:authTag:data');
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** True if value looks like our encrypted payload (iv:tag:data in hex). */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(value.trim());
}

export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
