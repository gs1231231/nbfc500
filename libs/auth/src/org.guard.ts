import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

/**
 * OrgGuard ensures that every request has an organizationId set from the
 * authenticated JWT payload. Use this as a base guard for org-scoped routes.
 * It must be applied after JwtAuthGuard so that request.user is populated.
 */
@Injectable()
export class OrgGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();

    const user = request.user;

    if (!user || !user.orgId) {
      throw new UnauthorizedException(
        'Organization context is missing from the request',
      );
    }

    return true;
  }
}
