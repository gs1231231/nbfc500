import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBody } from '@nestjs/swagger';
import { BulkService, BulkResult } from './bulk.service';
import { ApiEndpoint } from '@bankos/common';

@ApiTags('Bulk Operations')
@Controller('api/v1/bulk')
export class BulkController {
  private readonly logger = new Logger(BulkController.name);

  constructor(private readonly bulkService: BulkService) {}

  /**
   * POST /api/v1/bulk/approve
   * Approve multiple applications at once.
   */
  @Post('approve')
  @ApiEndpoint('Bulk approve applications', 200)
  @ApiBody({ schema: { example: { applicationIds: ['app-1', 'app-2'], userId: 'usr-1' } } })
  async bulkApprove(
    @Headers('x-org-id') orgId: string,
    @Body() body: { applicationIds: string[]; userId: string },
  ): Promise<BulkResult> {
    return this.bulkService.bulkApprove(
      orgId ?? 'default',
      body.applicationIds,
      body.userId,
    );
  }

  /**
   * POST /api/v1/bulk/disburse
   * Create disbursement requests for multiple applications.
   */
  @Post('disburse')
  @ApiEndpoint('Bulk disburse applications', 200)
  @ApiBody({ schema: { example: { applicationIds: ['app-1', 'app-2'] } } })
  async bulkDisburse(
    @Headers('x-org-id') orgId: string,
    @Body() body: { applicationIds: string[] },
  ): Promise<BulkResult> {
    return this.bulkService.bulkDisburse(orgId ?? 'default', body.applicationIds);
  }

  /**
   * POST /api/v1/bulk/nach-present
   * Present NACH for all upcoming EMIs on a given date.
   */
  @Post('nach-present')
  @ApiEndpoint('Bulk NACH presentation', 200)
  @ApiBody({ schema: { example: { date: '2026-04-10' } } })
  async bulkNachPresent(
    @Headers('x-org-id') orgId: string,
    @Body() body: { date: string },
  ): Promise<{ presented: number; date: string }> {
    return this.bulkService.bulkNachPresent(orgId ?? 'default', body.date);
  }

  /**
   * POST /api/v1/bulk/assign
   * Assign multiple applications to one officer.
   */
  @Post('assign')
  @ApiEndpoint('Bulk assign applications', 200)
  @ApiBody({ schema: { example: { applicationIds: ['app-1', 'app-2'], assigneeId: 'usr-5' } } })
  async bulkAssign(
    @Headers('x-org-id') orgId: string,
    @Body() body: { applicationIds: string[]; assigneeId: string },
  ): Promise<BulkResult> {
    return this.bulkService.bulkAssign(
      orgId ?? 'default',
      body.applicationIds,
      body.assigneeId,
    );
  }
}
