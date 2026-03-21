/**
 * Prompt 48 - Sentry Configuration
 * Error monitoring and performance tracing for BankOS services.
 * Initialized once per NestJS application bootstrap.
 *
 * Usage in main.ts:
 *   import { initSentry } from '@bankos/common';
 *   initSentry('loan-service');
 *   // Must be called BEFORE creating the NestJS application
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SentryOptions {
  /** Service/microservice name, e.g. 'loan-service' */
  serviceName: string;
  /** Service version, defaults to npm package version */
  release?: string;
  /** Override DSN (useful in tests) */
  dsn?: string;
  /** Override sample rate */
  tracesSampleRate?: number;
  /** Override profiles sample rate */
  profilesSampleRate?: number;
  /** Additional tags */
  tags?: Record<string, string>;
}

// ─── Configuration Constants ───────────────────────────────────────────────────

const DEFAULT_TRACES_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
); // 10% in production

const DEFAULT_PROFILES_SAMPLE_RATE = parseFloat(
  process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.05',
); // 5% profiling

const ENVIRONMENT = process.env.NODE_ENV ?? 'development';

// ─── PII Scrubbing ─────────────────────────────────────────────────────────────

/** Fields that must be redacted from Sentry events (RBI/PCI compliance) */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'aadhaarNumber',
  'panNumber',
  'accountNumber',
  'cardNumber',
  'cvv',
  'otp',
  'mfaSecret',
  'authorization',
  'cookie',
  'x-api-key',
  'JWT_SECRET',
  'DB_PASSWORD',
];

function scrubSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Sentry Initialization ─────────────────────────────────────────────────────

let isInitialized = false;

export function initSentry(serviceNameOrOptions: string | SentryOptions): void {
  const options: SentryOptions =
    typeof serviceNameOrOptions === 'string'
      ? { serviceName: serviceNameOrOptions }
      : serviceNameOrOptions;

  const dsn = options.dsn ?? process.env.SENTRY_DSN;

  // Skip initialization if no DSN or in test environment
  if (!dsn || ENVIRONMENT === 'test') {
    console.log(`[Sentry] Skipping initialization (environment: ${ENVIRONMENT}, dsn: ${dsn ? 'present' : 'missing'})`);
    return;
  }

  if (isInitialized) {
    console.warn('[Sentry] Already initialized. Skipping duplicate initialization.');
    return;
  }

  const release =
    options.release ??
    process.env.npm_package_version ??
    process.env.IMAGE_TAG ??
    'unknown';

  Sentry.init({
    dsn,
    environment: ENVIRONMENT,
    release: `${options.serviceName}@${release}`,

    // Performance monitoring
    tracesSampleRate: options.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE,

    // Profiling (requires @sentry/profiling-node)
    profilesSampleRate: options.profilesSampleRate ?? DEFAULT_PROFILES_SAMPLE_RATE,

    integrations: [
      // Node.js native integrations
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      // CPU profiling
      nodeProfilingIntegration(),
    ],

    // Tag all events with service name and environment
    initialScope: {
      tags: {
        service: options.serviceName,
        region: process.env.AWS_REGION ?? 'ap-south-1',
        'compliance.rbi': 'true',
        ...options.tags,
      },
    },

    // ── Event processing hooks ─────────────────────────────────────────────
    beforeSend(event) {
      // Scrub PII from request data
      if (event.request?.data) {
        try {
          const data =
            typeof event.request.data === 'string'
              ? JSON.parse(event.request.data)
              : event.request.data;
          event.request.data = scrubSensitiveData(data);
        } catch {
          event.request.data = '[UNPARSEABLE]';
        }
      }

      // Scrub PII from extra context
      if (event.extra) {
        event.extra = scrubSensitiveData(event.extra as Record<string, unknown>);
      }

      // Drop health check errors (avoid noise from K8s probes)
      if (event.request?.url?.includes('/health')) {
        return null;
      }

      // Drop metrics endpoint errors
      if (event.request?.url?.includes('/metrics')) {
        return null;
      }

      return event;
    },

    beforeSendTransaction(transaction) {
      // Drop health check and metrics transactions from performance data
      if (
        transaction.transaction?.includes('/health') ||
        transaction.transaction?.includes('/metrics')
      ) {
        return null;
      }
      return transaction;
    },
  });

  isInitialized = true;

  console.log(
    `[Sentry] Initialized | service: ${options.serviceName} | ` +
      `environment: ${ENVIRONMENT} | ` +
      `tracesSampleRate: ${options.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE}`,
  );
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Capture an error with additional context.
 * Use this instead of Sentry.captureException for consistency.
 */
export function captureError(
  error: Error,
  context?: {
    userId?: string;
    organizationId?: string;
    loanId?: string;
    applicationId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): string {
  return Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.organizationId) scope.setTag('organizationId', context.organizationId);
    if (context?.loanId) scope.setTag('loanId', context.loanId);
    if (context?.applicationId) scope.setTag('applicationId', context.applicationId);
    if (context?.tags) {
      for (const [k, v] of Object.entries(context.tags)) {
        scope.setTag(k, v);
      }
    }
    if (context?.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        scope.setExtra(k, v);
      }
    }
    return Sentry.captureException(error);
  });
}

/**
 * Flush pending Sentry events before process shutdown.
 * Call in graceful shutdown handler.
 */
export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  return Sentry.flush(timeoutMs);
}

// Re-export Sentry for direct use
export { Sentry };
