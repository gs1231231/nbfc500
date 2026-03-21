import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '@bankos/database';
import { AuditAction } from '@prisma/client';
import { AuthenticatedUser } from './jwt.strategy';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const method = request.method.toUpperCase();
    const auditAction = METHOD_TO_ACTION[method];

    // Only intercept mutating methods
    if (!auditAction) {
      return next.handle();
    }

    const user = request.user;

    // Skip if no authenticated user (e.g. login endpoint)
    if (!user) {
      return next.handle();
    }

    const urlPath = request.path;
    const entityType = this.extractEntityType(urlPath);
    const entityIdFromParams = request.params?.['id'] ?? '';
    const ipAddress =
      (request.headers['x-forwarded-for'] as string) ??
      request.socket.remoteAddress ??
      '';
    const userAgent = request.headers['user-agent'] ?? '';
    const requestBody = request.body as Record<string, unknown>;

    return next.handle().pipe(
      tap({
        next: async (responseData: unknown) => {
          try {
            const entityId = this.extractEntityId(
              responseData,
              entityIdFromParams,
            );

            await this.prisma.auditLog.create({
              data: {
                organizationId: user.orgId,
                userId: user.userId,
                action: auditAction,
                entityType,
                entityId,
                changes: (requestBody ?? {}) as Record<string, never>,
                ipAddress,
                userAgent,
              },
            });
          } catch (err) {
            this.logger.error('Failed to write audit log', err);
          }
        },
        error: () => {
          // Don't log failed requests
        },
      }),
    );
  }

  /**
   * Extracts entity type from URL path.
   * e.g. /api/v1/loan-applications/123 -> loan-applications
   */
  private extractEntityType(urlPath: string): string {
    const segments = urlPath
      .split('/')
      .filter((s) => s && s !== 'api' && s !== 'v1');
    // Return the first meaningful segment (the resource name)
    return segments[0] ?? 'unknown';
  }

  /**
   * Extracts entity ID from response body (id field) or falls back to route param.
   */
  private extractEntityId(
    responseData: unknown,
    fallbackId: string,
  ): string {
    if (
      responseData &&
      typeof responseData === 'object' &&
      'id' in responseData
    ) {
      const id = (responseData as Record<string, unknown>)['id'];
      if (typeof id === 'string') return id;
    }
    return fallbackId || 'unknown';
  }
}
