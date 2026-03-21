import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CoLendingService } from './colending.service';
import {
  AllocateDto,
  CreatePartnerDto,
  UpdatePartnerDto,
} from './dto/colending.dto';

/**
 * CoLendingController — HTTP interface for the co-lending module.
 *
 * All endpoints require X-Organization-Id to identify the tenant.
 *
 * Base path: /api/v1/colending
 */
@ApiTags('Co-Lending')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Tenant organization UUID (injected by API Gateway)',
  required: true,
  example: '550e8400-e29b-41d4-a716-446655440001',
})
@Controller('api/v1/colending')
export class CoLendingController {
  constructor(private readonly coLendingService: CoLendingService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Partners
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/colending/partners
   * Create a new co-lending bank partner.
   */
  @Post('partners')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create co-lending partner',
    description:
      'Register a new bank as a co-lending partner. ' +
      'bankShare + nbfcShare must equal 100.',
  })
  @ApiOkResponse({ description: 'Partner created successfully' })
  async createPartner(
    @Headers('x-organization-id') orgId: string,
    @Body() dto: CreatePartnerDto,
  ) {
    const data = await this.coLendingService.createPartner(orgId, dto);
    return { success: true, data };
  }

  /**
   * GET /api/v1/colending/partners
   * List all co-lending partners for the organization.
   */
  @Get('partners')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List co-lending partners',
    description: 'Returns all registered co-lending bank partners for the organization.',
  })
  @ApiOkResponse({ description: 'List of co-lending partners' })
  async listPartners(@Headers('x-organization-id') orgId: string) {
    const data = await this.coLendingService.listPartners(orgId);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/colending/partners/:partnerId
   * Update a co-lending partner.
   */
  @Patch('partners/:partnerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update co-lending partner',
    description: 'Update the configuration of an existing co-lending partner.',
  })
  @ApiParam({ name: 'partnerId', description: 'Co-lending partner UUID' })
  @ApiOkResponse({ description: 'Partner updated successfully' })
  async updatePartner(
    @Headers('x-organization-id') orgId: string,
    @Param('partnerId') partnerId: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    const data = await this.coLendingService.updatePartner(orgId, partnerId, dto);
    return { success: true, data };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Allocation & Disbursement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/colending/allocate
   * Allocate a loan application to the best-fit co-lending partner.
   */
  @Post('allocate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Allocate loan to co-lending partner',
    description:
      'Selects an eligible bank partner for the loan, validates MRR >= 10% (RBI requirement), ' +
      'calculates blended interest rate, and creates a CoLendingAllocation.',
  })
  @ApiOkResponse({ description: 'Loan allocated to co-lending partner' })
  async allocate(
    @Headers('x-organization-id') orgId: string,
    @Body() dto: AllocateDto,
  ) {
    const data = await this.coLendingService.allocate(orgId, dto.applicationId);
    return { success: true, data };
  }

  /**
   * POST /api/v1/colending/disburse/:allocationId
   * Mark an allocation as disbursed and log the bank/NBFC split.
   */
  @Post('disburse/:allocationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disburse co-lending allocation',
    description:
      'Marks the co-lending allocation as DISBURSED and logs the amount split ' +
      'between the bank and NBFC per their share percentages.',
  })
  @ApiParam({ name: 'allocationId', description: 'CoLendingAllocation UUID' })
  @ApiOkResponse({ description: 'Allocation disbursed successfully' })
  async disburse(
    @Headers('x-organization-id') orgId: string,
    @Param('allocationId') allocationId: string,
  ) {
    const data = await this.coLendingService.disburse(orgId, allocationId);
    return { success: true, data };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portfolio & Settlement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/colending/portfolio
   * Get partner-wise AUM, NPA count, and DLG utilization.
   */
  @Get('portfolio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get co-lending portfolio',
    description:
      'Returns per-partner portfolio metrics: AUM, NPA count, exposure utilization, ' +
      'and DLG (Default Loss Guarantee) utilization percentage.',
  })
  @ApiOkResponse({ description: 'Portfolio summary by partner' })
  async getPortfolio(@Headers('x-organization-id') orgId: string) {
    const data = await this.coLendingService.getPortfolio(orgId);
    return { success: true, data };
  }

  /**
   * POST /api/v1/colending/settlement/run
   * Trigger the daily settlement run for all active co-lending loans.
   */
  @Post('settlement/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run daily settlement',
    description:
      'Splits payments collected today across bank and NBFC per their share percentages. ' +
      'Logs the split to console for each loan.',
  })
  @ApiOkResponse({ description: 'Daily settlement completed' })
  async runDailySettlement(@Headers('x-organization-id') orgId: string) {
    const data = await this.coLendingService.runDailySettlement(orgId);
    return { success: true, data };
  }
}
