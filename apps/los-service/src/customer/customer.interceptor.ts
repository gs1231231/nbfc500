import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { maskPan, maskAadhaar, decrypt } from './crypto.util';

/**
 * SensitiveDataInterceptor automatically masks PAN and Aadhaar fields
 * in API responses throughout the customer module.
 *
 * It deep-walks the response object and applies masking to any field
 * named `panNumber` or `aadhaarNumber`.
 *
 * Note: CustomerService.maskCustomer() already handles masking at the
 * service layer. This interceptor acts as a safety net to catch any
 * inadvertently exposed raw/encrypted values elsewhere in the response.
 */
@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => this.sanitize(data)));
  }

  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        if (key === 'panNumber' && typeof obj[key] === 'string') {
          result[key] = this.safeMaskPan(obj[key] as string);
        } else if (key === 'aadhaarNumber' && typeof obj[key] === 'string') {
          result[key] = this.safeMaskAadhaar(obj[key] as string);
        } else {
          result[key] = this.sanitize(obj[key]);
        }
      }
      return result;
    }
    return value;
  }

  /**
   * Attempts to detect if the value is an already-masked PAN (starts with X),
   * an encrypted ciphertext (contains ':'), or a plain PAN, and applies
   * the appropriate masking.
   */
  private safeMaskPan(value: string): string {
    if (!value) return value;
    // Already masked
    if (value.startsWith('X')) return value;
    // Encrypted (iv:ciphertext format)
    if (value.includes(':')) {
      try {
        return maskPan(decrypt(value));
      } catch {
        return 'XXXXXXXXXX';
      }
    }
    // Plain PAN
    return maskPan(value);
  }

  private safeMaskAadhaar(value: string): string {
    if (!value) return value;
    // Already masked (starts with X or contains -)
    if (value.startsWith('X') || value.includes('-')) return value;
    // Encrypted
    if (value.includes(':')) {
      try {
        return maskAadhaar(decrypt(value));
      } catch {
        return 'XXXX-XXXX-XXXX';
      }
    }
    // Plain Aadhaar
    return maskAadhaar(value);
  }
}
