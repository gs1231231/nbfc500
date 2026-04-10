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
import { VasService } from './vas.service';
import { CreateFeeTemplateDto } from './dto/create-fee-template.dto';
import { UpdateFeeTemplateDto } from './dto/update-fee-template.dto';
import { FilterFeeTemplateDto } from './dto/filter-fee-template.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { WaiveFeeDto } from './dto/waive-fee.dto';

@Controller('api/v1/vas')
export class VasController {
  constructor(private readonly vasService: VasService) {}

  // ── Fee Templates ──────────────────────────────────────────────────────────

  /**
   * POST /api/v1/vas/templates
   * Create a new fee template.
   */
  @Post('templates')
  createFeeTemplate(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateFeeTemplateDto,
  ) {
    return this.vasService.createFeeTemplate(orgId, userId, dto);
  }

  /**
   * GET /api/v1/vas/templates
   * List fee templates with optional filters.
   */
  @Get('templates')
  listFeeTemplates(
    @Headers('x-org-id') orgId: string,
    @Query() filters: FilterFeeTemplateDto,
  ) {
    return this.vasService.listFeeTemplates(orgId, filters);
  }

  /**
   * GET /api/v1/vas/templates/:id
   * Get a specific fee template with usage stats.
   */
  @Get('templates/:id')
  getFeeTemplate(
    @Headers('x-org-id') orgId: string,
    @Param('id') templateId: string,
  ) {
    return this.vasService.getFeeTemplate(orgId, templateId);
  }

  /**
   * PATCH /api/v1/vas/templates/:id
   * Update a fee template.
   */
  @Patch('templates/:id')
  updateFeeTemplate(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Param('id') templateId: string,
    @Body() dto: UpdateFeeTemplateDto,
  ) {
    return this.vasService.updateFeeTemplate(orgId, templateId, userId, dto);
  }

  /**
   * DELETE /api/v1/vas/templates/:id
   * Deactivate a fee template (soft delete).
   */
  @Delete('templates/:id')
  deactivateFeeTemplate(
    @Headers('x-org-id') orgId: string,
    @Param('id') templateId: string,
  ) {
    return this.vasService.deactivateFeeTemplate(orgId, templateId);
  }

  // ── Fee Calculation ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/vas/calculate/:applicationId
   * Auto-calculate all applicable fees for a loan application.
   */
  @Post('calculate/:applicationId')
  calculateFees(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.vasService.calculateFeesForApplication(orgId, applicationId);
  }

  /**
   * POST /api/v1/vas/recalculate/:applicationId
   * Delete existing CALCULATED fees and recalculate.
   */
  @Post('recalculate/:applicationId')
  recalculateFees(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.vasService.recalculateFeesForApplication(orgId, applicationId);
  }

  /**
   * GET /api/v1/vas/fees/:applicationId
   * Get all calculated fees for an application.
   */
  @Get('fees/:applicationId')
  getFeesForApplication(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.vasService.getFeesForApplication(orgId, applicationId);
  }

  /**
   * POST /api/v1/vas/fees/:feeId/discount
   * Apply a negotiated discount to a fee.
   */
  @Post('fees/:feeId/discount')
  applyDiscount(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Param('feeId') feeId: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.vasService.applyDiscount(orgId, feeId, dto, userId);
  }

  /**
   * POST /api/v1/vas/fees/:feeId/waive
   * Waive a fee entirely.
   */
  @Post('fees/:feeId/waive')
  waiveFee(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Param('feeId') feeId: string,
    @Body() dto: WaiveFeeDto,
  ) {
    return this.vasService.waiveFee(orgId, feeId, dto, userId);
  }

  /**
   * GET /api/v1/vas/deductions/:applicationId
   * Get fees to be deducted from disbursement.
   */
  @Get('deductions/:applicationId')
  getDisbursementDeductions(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.vasService.getDisbursementDeductions(orgId, applicationId);
  }

  /**
   * POST /api/v1/vas/fees/:feeId/collect
   * Mark a fee as collected.
   */
  @Post('fees/:feeId/collect')
  collectFee(
    @Headers('x-org-id') orgId: string,
    @Param('feeId') feeId: string,
  ) {
    return this.vasService.collectFee(orgId, feeId);
  }

  /**
   * GET /api/v1/vas/sanction-summary/:applicationId
   * Fee summary formatted for sanction letter / MITC / KFS.
   */
  @Get('sanction-summary/:applicationId')
  getFeeSummaryForSanctionLetter(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.vasService.getFeeSummaryForSanctionLetter(orgId, applicationId);
  }

  /**
   * GET /api/v1/vas/report
   * Fee collection report with GST breakup, waivers, discounts.
   */
  @Get('report')
  getFeeReport(
    @Headers('x-org-id') orgId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('feeCode') feeCode?: string,
    @Query('status') status?: string,
  ) {
    return this.vasService.getFeeReport(orgId, { fromDate, toDate, feeCode, status });
  }
}
