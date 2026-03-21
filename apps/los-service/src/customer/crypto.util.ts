import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

function getKey(): Buffer {
  const rawKey = process.env['ENCRYPTION_KEY'];
  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Derive a 32-byte key using SHA-256 so any length secret works
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns a base64-encoded string in the format: <iv_hex>:<encrypted_hex>
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 * Expects format: <iv_hex>:<encrypted_hex>
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Masks a PAN number for safe display in API responses.
 * Input:  ABCDE1234F
 * Output: XXXXX1234F  (first 5 chars masked, last 5 visible)
 *
 * Per CLAUDE.md security rules: show last 4 chars before last + last char.
 * Pattern: XXXXX + last4before + lastChar  => XXXXX1234F
 */
export function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return 'XXXXXXXXXX';
  // Mask first 5, keep last 5 (4 digits + 1 alpha)
  return `XXXXX${pan.slice(5)}`;
}

/**
 * Masks an Aadhaar number for safe display in API responses.
 * Input:  123456781234
 * Output: XXXX-XXXX-1234 (only last 4 digits visible)
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 12) return 'XXXX-XXXX-XXXX';
  const last4 = aadhaar.slice(-4);
  return `XXXX-XXXX-${last4}`;
}
