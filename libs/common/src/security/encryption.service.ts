/**
 * Encryption Service
 * AES-256-GCM authenticated encryption for sensitive financial data.
 * Suitable for encrypting PAN numbers, Aadhaar references, account numbers,
 * and other PII that must be stored at rest.
 *
 * Usage:
 *   const enc = new EncryptionService(process.env.ENCRYPTION_KEY);
 *   const cipher = enc.encrypt('123456789012');   // Aadhaar / PAN
 *   const plain  = enc.decrypt(cipher);
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export class EncryptionService {
  private key: Buffer;

  constructor(secretKey?: string) {
    const raw = secretKey || process.env.ENCRYPTION_KEY || 'default-change-in-production-32b';
    // SHA-256 of the raw key gives us a stable 32-byte key regardless of input length
    this.key = createHash('sha256').update(raw).digest();
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns a colon-delimited string: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  /**
   * Decrypt a ciphertext previously produced by `encrypt`.
   * If the value does not match the expected format (e.g. it was stored plain),
   * it is returned unchanged so existing unencrypted records are not broken.
   * Throws if the auth tag fails (tampered data).
   */
  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !tagHex || !encrypted) return ciphertext; // already plain
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
