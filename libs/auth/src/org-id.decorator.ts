import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

/**
 * Parameter decorator that extracts the organization ID from the request.
 *
 * Resolution order:
 * 1. JWT user payload (request.user.orgId) — set by JwtAuthGuard + OrgGuard
 * 2. X-Organization-Id request header — fallback for non-JWT routes / tests
 * 3. orgId query parameter — backward-compat fallback (avoid relying on this)
 *
 * When applied on a controller protected by JwtAuthGuard + OrgGuard the JWT
 * path is always taken, which means the org isolation cannot be bypassed by a
 * caller supplying a crafted query param or header.
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers: Record<string, string | string[] | undefined>;
      query?: Record<string, string | undefined>;
    }>();

    // 1. JWT user — highest priority; set by JwtStrategy.validate()
    if (request.user?.orgId) {
      return request.user.orgId;
    }

    // 2. X-Organization-Id header — for non-JWT internal routes
    const header = request.headers['x-organization-id'];
    if (header && !Array.isArray(header)) {
      return header;
    }

    // 3. Query param — backward-compat only; controllers should migrate away
    if (request.query?.orgId) {
      return request.query.orgId;
    }

    return '';
  },
);
