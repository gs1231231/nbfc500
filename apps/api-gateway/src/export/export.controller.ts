import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ApiEndpoint } from '@bankos/common';

@ApiTags('Export')
@Controller('api/v1/export')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  /**
   * GET /api/v1/export/:reportType?format=csv&from=&to=
   * Generate and download a named report as CSV.
   */
  @Get(':reportType')
  @ApiEndpoint('Export report as CSV')
  @ApiQuery({ name: 'format', required: false, example: 'csv' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  async exportReport(
    @Headers('x-org-id') orgId: string,
    @Param('reportType') reportType: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const resolvedOrgId = orgId ?? 'default';
    const csv = await this.exportService.exportReport(resolvedOrgId, reportType, {
      from,
      to,
      productId,
      branchId,
    });

    const filename = `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    this.logger.log(`Exporting ${reportType} for org ${resolvedOrgId} → ${filename}`);

    res!
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  }
}
