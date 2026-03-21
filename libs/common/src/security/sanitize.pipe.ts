/**
 * Prompt 49 - Input Sanitization Pipe
 * Strips HTML tags and prevents XSS across all string inputs.
 * Applied globally to prevent injection attacks.
 *
 * Usage (global):
 *   app.useGlobalPipes(new SanitizePipe());
 *
 * Usage (controller level):
 *   @UsePipes(SanitizePipe)
 */

import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';

// ─── XSS / HTML sanitization (no external dependency) ─────────────────────────

/** Characters that must be HTML-entity-encoded */
const HTML_ENCODE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/** Regex patterns for SQL injection detection (block, not encode) */
const SQL_INJECTION_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|UNION|SCRIPT)\b/gi,
  /(-{2}|\/\*|\*\/)/g, // SQL comments
  /(;)\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
];

/** Regex patterns for script injection (block) */
const SCRIPT_INJECTION_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // onclick=, onload=, etc.
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
];

function stripHtmlTags(input: string): string {
  // Remove all HTML tags
  return input.replace(/<[^>]*>/g, '');
}

function encodeHtmlEntities(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENCODE_MAP[char] ?? char);
}

function hasSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

function hasScriptInjection(input: string): boolean {
  return SCRIPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

function sanitizeString(value: string, options: SanitizeOptions): string {
  let result = value;

  // 1. Trim whitespace
  if (options.trim) {
    result = result.trim();
  }

  // 2. Detect and block script injection
  if (options.blockScriptInjection && hasScriptInjection(result)) {
    throw new BadRequestException(
      'Input contains potentially malicious script content',
    );
  }

  // 3. Detect and block SQL injection
  if (options.blockSqlInjection && hasSqlInjection(result)) {
    throw new BadRequestException(
      'Input contains potentially malicious SQL content',
    );
  }

  // 4. Strip HTML tags
  if (options.stripHtml) {
    result = stripHtmlTags(result);
  }

  // 5. Encode remaining HTML entities
  if (options.encodeHtml) {
    result = encodeHtmlEntities(result);
  }

  // 6. Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 7. Remove null bytes (common in injection attacks)
  result = result.replace(/\0/g, '');

  // 8. Enforce max length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }

  return result;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SanitizeOptions {
  /** Strip HTML tags (default: true) */
  stripHtml?: boolean;
  /** Encode remaining HTML entities (default: false - use stripHtml instead) */
  encodeHtml?: boolean;
  /** Block requests with SQL injection patterns (default: true) */
  blockSqlInjection?: boolean;
  /** Block requests with XSS/script injection (default: true) */
  blockScriptInjection?: boolean;
  /** Trim whitespace from string fields (default: true) */
  trim?: boolean;
  /** Maximum length for string fields (default: 10000) */
  maxLength?: number;
  /** Fields to exclude from sanitization (e.g. binary fields) */
  excludeFields?: string[];
}

// ─── Fields exempt from SQL injection check ────────────────────────────────────
// These fields may legitimately contain SQL-like content (e.g. addresses)
const EXEMPT_FROM_SQL_CHECK = new Set([
  'address',
  'addressLine1',
  'addressLine2',
  'currentAddressLine1',
  'permanentAddressLine1',
  'narration',
  'remarks',
  'description',
  'signingPurpose',
]);

// ─── Recursive sanitization ────────────────────────────────────────────────────

function sanitizeValue(
  value: unknown,
  fieldName: string,
  options: SanitizeOptions,
): unknown {
  if (typeof value === 'string') {
    const fieldOptions = EXEMPT_FROM_SQL_CHECK.has(fieldName)
      ? { ...options, blockSqlInjection: false }
      : options;
    return sanitizeString(value, fieldOptions);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, `${fieldName}[${index}]`, options),
    );
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (options.excludeFields?.includes(key)) {
        result[key] = val;
      } else {
        result[key] = sanitizeValue(val, key, options);
      }
    }
    return result;
  }

  return value;
}

// ─── Pipe ──────────────────────────────────────────────────────────────────────

@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly options: Required<SanitizeOptions>;

  constructor(options: SanitizeOptions = {}) {
    this.options = {
      stripHtml: options.stripHtml ?? true,
      encodeHtml: options.encodeHtml ?? false,
      blockSqlInjection: options.blockSqlInjection ?? true,
      blockScriptInjection: options.blockScriptInjection ?? true,
      trim: options.trim ?? true,
      maxLength: options.maxLength ?? 10000,
      excludeFields: options.excludeFields ?? [
        'password',
        'passwordHash',
        'content',         // base64 document content
        'documentContent', // eSign documents
        'qrCodeBase64',
        'photo',
      ],
    };
  }

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only sanitize body, query, and param inputs
    if (metadata.type === 'custom') return value;

    // Don't sanitize if no value
    if (value === null || value === undefined) return value;

    // Don't sanitize primitive non-string types
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      Buffer.isBuffer(value)
    ) {
      return value;
    }

    try {
      return sanitizeValue(value, metadata.data ?? 'root', this.options);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // If sanitization itself fails, pass through (don't block legitimate requests)
      return value;
    }
  }
}
