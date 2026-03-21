/**
 * Prompt 49 - Security Headers Configuration
 * Helmet.js configuration for CORS, CSP, HSTS, and other security headers.
 * RBI-compliant security headers for financial services.
 *
 * Usage in main.ts:
 *   import { applySecurityMiddleware } from '@bankos/common';
 *   applySecurityMiddleware(app);
 */

import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// ─── Environment ───────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// ─── Allowed Origins ───────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: (string | RegExp)[] = [
  // Production domains
  'https://app.bankos.in',
  'https://admin.bankos.in',
  'https://partner.bankos.in',
  // Staging
  'https://app.staging.bankos.in',
  'https://admin.staging.bankos.in',
  // Development (only in non-prod)
  ...(isProd ? [] : ['http://localhost:3000', 'http://localhost:4200', 'http://127.0.0.1:3000']),
];

// ─── CORS Configuration ────────────────────────────────────────────────────────

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });

    if (isAllowed || isTest) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Organization-ID',
    'X-Correlation-ID',
    'Accept',
    'Accept-Language',
    'Cache-Control',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
};

// ─── Helmet CSP Configuration ──────────────────────────────────────────────────

/**
 * Content Security Policy directives.
 * Conservative policy for a financial services API.
 */
const cspDirectives = {
  defaultSrc: ["'none'"],
  scriptSrc: ["'none'"], // API-only; no JS execution needed
  styleSrc: ["'none'"],
  imgSrc: ["'none'"],
  connectSrc: ["'self'"],
  fontSrc: ["'none'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'none'"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"], // Equivalent to X-Frame-Options: DENY
  formAction: ["'self'"],
  baseUri: ["'self'"],
  // Prevent MIME type sniffing attacks
  sandbox: [] as string[],
  upgradeInsecureRequests: [] as string[],
};

// ─── Helmet Configuration ──────────────────────────────────────────────────────

export const helmetConfig = helmet({
  // ── Content Security Policy ─────────────────────────────────────────────
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives,
  },

  // ── HTTP Strict Transport Security ──────────────────────────────────────
  // 1 year HSTS - forces HTTPS for all future requests
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // ── Clickjacking Protection ─────────────────────────────────────────────
  frameguard: { action: 'deny' },

  // ── MIME Type Sniffing ──────────────────────────────────────────────────
  noSniff: true,

  // ── XSS Filter (legacy browsers) ────────────────────────────────────────
  xssFilter: true,

  // ── Referrer Policy ─────────────────────────────────────────────────────
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // ── DNS Prefetch Control ────────────────────────────────────────────────
  dnsPrefetchControl: { allow: false },

  // ── IE No Open ──────────────────────────────────────────────────────────
  ieNoOpen: true,

  // ── Hide X-Powered-By ────────────────────────────────────────────────────
  hidePoweredBy: true,

  // ── Permissions Policy (Feature Policy) ────────────────────────────────
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // ── Origin Agent Cluster ────────────────────────────────────────────────
  originAgentCluster: true,

  // ── Cross Origin Opener Policy ──────────────────────────────────────────
  crossOriginOpenerPolicy: { policy: 'same-origin' },

  // ── Cross Origin Resource Policy ────────────────────────────────────────
  crossOriginResourcePolicy: { policy: 'same-site' },

  // ── Cross Origin Embedder Policy ────────────────────────────────────────
  crossOriginEmbedderPolicy: false, // disabled - would block legitimate integrations
});

// ─── Additional Security Headers Middleware ────────────────────────────────────

export function additionalSecurityHeaders(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  // Cache control - prevent caching of sensitive financial data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Request ID for tracing
  if (!req.headers['x-request-id']) {
    res.setHeader('X-Request-ID', `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  } else {
    res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
  }

  // Prevent content sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Remove server banner
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
}

// ─── Apply All Security Middleware ────────────────────────────────────────────

/**
 * Apply all security middleware to the NestJS application.
 * Call this in main.ts before app.listen().
 *
 * @example
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   applySecurityMiddleware(app);
 *   await app.listen(3000);
 * }
 */
export function applySecurityMiddleware(app: INestApplication): void {
  // 1. Helmet (sets most security headers)
  app.use(helmetConfig);

  // 2. Additional custom headers
  app.use(additionalSecurityHeaders);

  // 3. CORS
  app.enableCors(corsOptions);

  console.log('[Security] Helmet, CORS, and security headers applied');
}
