import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { SchemeService } from './scheme.service';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { UpdateSchemeDto } from './dto/update-scheme.dto';
import { FilterSchemeDto } from './dto/filter-scheme.dto';
import { ApplySchemeDto } from './dto/apply-scheme.dto';

@Controller('api/v1/schemes')
export class SchemeController {
  constructor(private readonly schemeService: SchemeService) {}

  /**
   * POST /api/v1/schemes
   * Create a new promotional scheme.
   */
  @Post()
  createScheme(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateSchemeDto,
  ) {
    return this.schemeService.createScheme(orgId, userId, dto);
  }

  /**
   * GET /api/v1/schemes
   * List all schemes with optional filters.
   */
  @Get()
  listSchemes(
    @Headers('x-org-id') orgId: string,
    @Query() filters: FilterSchemeDto,
  ) {
    return this.schemeService.listSchemes(orgId, filters);
  }

  /**
   * GET /api/v1/schemes/report
   * Scheme-wise MIS report with utilization and cashback stats.
   */
  @Get('report')
  getSchemeReport(
    @Headers('x-org-id') orgId: string,
    @Query('schemeType') schemeType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.schemeService.getSchemeReport(orgId, { schemeType, from, to });
  }

  /**
   * GET /api/v1/schemes/eligible/:applicationId
   * Find all eligible schemes for a given loan application.
   */
  @Get('eligible/:applicationId')
  findEligibleSchemes(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.schemeService.findEligibleSchemes(orgId, applicationId);
  }

  /**
   * GET /api/v1/schemes/:id
   * Get a single scheme with full details.
   */
  @Get(':id')
  getScheme(
    @Headers('x-org-id') orgId: string,
    @Param('id') schemeId: string,
  ) {
    return this.schemeService.getScheme(orgId, schemeId);
  }

  /**
   * PATCH /api/v1/schemes/:id
   * Update an existing scheme.
   */
  @Patch(':id')
  updateScheme(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Param('id') schemeId: string,
    @Body() dto: UpdateSchemeDto,
  ) {
    return this.schemeService.updateScheme(orgId, userId, schemeId, dto);
  }

  /**
   * DELETE /api/v1/schemes/:id
   * Deactivate a scheme (soft delete via isActive = false).
   */
  @Delete(':id')
  deactivateScheme(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Param('id') schemeId: string,
  ) {
    return this.schemeService.deactivateScheme(orgId, userId, schemeId);
  }

  /**
   * POST /api/v1/schemes/apply/:applicationId
   * Apply a scheme to a loan application.
   */
  @Post('apply/:applicationId')
  applyScheme(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
    @Body() dto: ApplySchemeDto,
  ) {
    return this.schemeService.applyScheme(orgId, applicationId, dto);
  }

  /**
   * DELETE /api/v1/schemes/remove/:applicationId
   * Remove all schemes from a loan application.
   */
  @Delete('remove/:applicationId')
  removeScheme(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.schemeService.removeScheme(orgId, applicationId);
  }

  /**
   * POST /api/v1/schemes/process-cashbacks
   * Trigger cashback eligibility processing for the organization.
   */
  @Post('process-cashbacks')
  processCashbacks(@Headers('x-org-id') orgId: string) {
    return this.schemeService.processCashbacks(orgId);
  }
}
