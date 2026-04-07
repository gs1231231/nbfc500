import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuditService, PaginatedAuditLogs, AuditLogEntry } from './audit.service';
import { ApiEndpoint } from '@bankos/common';

@ApiTags('Audit')
@Controller('api/v1/audit-logs')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/audit-logs
   * Returns paginated audit logs with optional filters.
   */
  @Get()
  @ApiEndpoint('Get paginated audit logs')
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getAuditLogs(
    @Headers('x-org-id') orgId: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PaginatedAuditLogs> {
    return this.auditService.getAuditLogs(orgId ?? 'default', {
      entityType,
      action,
      userId,
      entityId,
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * GET /api/v1/audit-logs/entity/:entityType/:entityId
   * Returns full change history for a specific entity.
   */
  @Get('entity/:entityType/:entityId')
  @ApiEndpoint('Get entity change history')
  async getEntityHistory(
    @Headers('x-org-id') orgId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<AuditLogEntry[]> {
    return this.auditService.getEntityHistory(
      orgId ?? 'default',
      entityType,
      entityId,
    );
  }
}
