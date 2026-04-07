import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

export interface AuditLogFilters {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// In-memory audit store (production: persist to DB via Prisma)
const auditStore: AuditLogEntry[] = [];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an audit event. Called from other services.
   */
  record(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): AuditLogEntry {
    const log: AuditLogEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    auditStore.push(log);
    this.logger.debug(
      `AUDIT [${log.action}] ${log.entityType}:${log.entityId} by ${log.userId}`,
    );
    return log;
  }

  /**
   * Get paginated audit logs for an org, with optional filters.
   */
  async getAuditLogs(
    orgId: string,
    filters: AuditLogFilters,
  ): Promise<PaginatedAuditLogs> {
    const {
      userId,
      entityType,
      entityId,
      action,
      from,
      to,
      page = 1,
      pageSize = 20,
    } = filters;

    let results = auditStore.filter((log) => log.orgId === orgId);

    if (userId) results = results.filter((l) => l.userId === userId);
    if (entityType) results = results.filter((l) => l.entityType === entityType);
    if (entityId) results = results.filter((l) => l.entityId === entityId);
    if (action) results = results.filter((l) => l.action === action);
    if (from) results = results.filter((l) => l.createdAt >= from);
    if (to) results = results.filter((l) => l.createdAt <= to);

    // Sort newest first
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * pageSize;
    const data = results.slice(start, start + pageSize);

    return { data, total, page, pageSize };
  }

  /**
   * Get full change history for a specific entity.
   */
  async getEntityHistory(
    orgId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLogEntry[]> {
    return auditStore
      .filter(
        (l) =>
          l.orgId === orgId &&
          l.entityType === entityType &&
          l.entityId === entityId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
