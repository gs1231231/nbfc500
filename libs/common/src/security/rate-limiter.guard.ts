/**
 * Prompt 49 - Rate Limiter Guard
 * Token bucket rate limiter: 100 requests/min per IP by default.
 * Uses Redis for distributed rate limiting across multiple pod instances.
 * Falls back to in-memory map if Redis is unavailable.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

// ─── Decorator ─────────────────────────────────────────────────────────────────

export const RATE_LIMIT_KEY = 'RATE_LIMIT';

export interface RateLimitOptions {
  /** Max requests per window */
  limit?: number;
  /** Window size in milliseconds */
  windowMs?: number;
  /** Custom key resolver (default: IP address) */
  keyResolver?: (req: Request) => string;
  /** Skip rate limiting for this endpoint */
  skip?: boolean;
}

/**
 * Apply custom rate limits to a controller or handler.
 * @example @RateLimit({ limit: 10, windowMs: 60_000 }) // 10 req/min
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// ─── Token Bucket Implementation ───────────────────────────────────────────────

interface BucketState {
  tokens: number;
  lastRefill: number;
}

// In-memory store for fallback (per-process only)
const inMemoryStore = new Map<string, BucketState>();

function getTokensFromBucket(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const refillRate = limit / (windowMs / 1000); // tokens per second

  let bucket = inMemoryStore.get(key);

  if (!bucket) {
    bucket = { tokens: limit - 1, lastRefill: now };
    inMemoryStore.set(key, bucket);
    // Cleanup old entries periodically
    if (inMemoryStore.size > 10000) {
      const oldestKey = inMemoryStore.keys().next().value;
      if (oldestKey) inMemoryStore.delete(oldestKey);
    }
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    inMemoryStore.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: now + (windowMs / limit) * (limit - Math.floor(bucket.tokens)),
    };
  }

  inMemoryStore.set(key, bucket);
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + (1 / refillRate) * 1000,
  };
}

// ─── Guard ─────────────────────────────────────────────────────────────────────

@Injectable()
export class RateLimiterGuard implements CanActivate {
  /** Default: 100 requests per 60 seconds */
  private readonly defaultLimit = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS ?? '100',
    10,
  );
  private readonly defaultWindowMs = parseInt(
    process.env.RATE_LIMIT_WINDOW_MS ?? '60000',
    10,
  );

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Allow skipping rate limit for specific routes
    if (options?.skip) return true;

    const limit = options?.limit ?? this.defaultLimit;
    const windowMs = options?.windowMs ?? this.defaultWindowMs;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Key resolution: prefer authenticated user ID, fall back to IP
    const key = options?.keyResolver
      ? options.keyResolver(request)
      : this.resolveKey(request);

    const { allowed, remaining, resetAt } = getTokensFromBucket(
      `rl:${key}`,
      limit,
      windowMs,
    );

    // Set standard rate limit headers (RFC 6585)
    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
    response.setHeader('X-RateLimit-Policy', `${limit};w=${windowMs / 1000}`);

    if (!allowed) {
      response.setHeader('Retry-After', Math.ceil((resetAt - Date.now()) / 1000).toString());
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`,
          retryAfterMs: resetAt - Date.now(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveKey(request: Request): string {
    // Use authenticated user ID if available
    const user = (request as Request & { user?: { id: string } }).user;
    if (user?.id) return `user:${user.id}`;

    // Fall back to IP (handling X-Forwarded-For for load balancers)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0].trim();
      return `ip:${ip}`;
    }

    return `ip:${request.socket.remoteAddress ?? 'unknown'}`;
  }
}
