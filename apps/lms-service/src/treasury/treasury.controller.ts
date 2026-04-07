import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { TreasuryService } from './treasury.service';
import { CreateFundSourceDto, UpdateFundSourceDto } from './dto/create-fund-source.dto';

@Controller('api/v1/treasury')
@UseGuards(JwtAuthGuard, OrgGuard)
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  // ----------------------------------------------------------------
  // Fund Source CRUD
  // ----------------------------------------------------------------

  /**
   * POST /api/v1/treasury/funds
   * Creates a new borrowing / fund source.
   */
  @Post('funds')
  async createFundSource(
    @Body() dto: CreateFundSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasuryService.createFundSource(user.orgId, dto);
  }

  /**
   * GET /api/v1/treasury/funds
   * Lists all fund sources. Optional ?status=ACTIVE|CLOSED|DEFAULTED
   */
  @Get('funds')
  async listFundSources(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasuryService.listFundSources(user.orgId, status);
  }

  /**
   * GET /api/v1/treasury/funds/:id
   * Returns a single fund source.
   */
  @Get('funds/:id')
  async getFundSource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasuryService.getFundSource(user.orgId, id);
  }

  /**
   * PATCH /api/v1/treasury/funds/:id
   * Updates a fund source (drawn amount, outstanding, status, covenants, etc.).
   */
  @Patch('funds/:id')
  async updateFundSource(
    @Param('id') id: string,
    @Body() dto: UpdateFundSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasuryService.updateFundSource(user.orgId, id, dto);
  }

  /**
   * DELETE /api/v1/treasury/funds/:id
   * Soft-closes a fund source (status → CLOSED).
   */
  @Delete('funds/:id')
  @HttpCode(HttpStatus.OK)
  async deleteFundSource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasuryService.deleteFundSource(user.orgId, id);
  }

  // ----------------------------------------------------------------
  // Analytics Endpoints
  // ----------------------------------------------------------------

  /**
   * GET /api/v1/treasury/cost-of-funds
   * Returns weighted average cost of funds across all active borrowings.
   */
  @Get('cost-of-funds')
  async getCostOfFunds(@CurrentUser() user: AuthenticatedUser) {
    return this.treasuryService.calculateWeightedCostOfFunds(user.orgId);
  }

  /**
   * GET /api/v1/treasury/nim
   * Returns Net Interest Margin for the organization.
   */
  @Get('nim')
  async getNIM(@CurrentUser() user: AuthenticatedUser) {
    return this.treasuryService.calculateNIM(user.orgId);
  }

  /**
   * GET /api/v1/treasury/alm?date=2024-01-31
   * Generates (or retrieves) the ALM bucket report for the given date.
   */
  @Get('alm')
  async getALM(
    @Query('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reportDate = date ?? new Date().toISOString().split('T')[0];
    return this.treasuryService.generateALM(user.orgId, reportDate);
  }

  /**
   * GET /api/v1/treasury/covenants
   * Checks covenant compliance for all active fund sources.
   */
  @Get('covenants')
  async getCovenants(@CurrentUser() user: AuthenticatedUser) {
    return this.treasuryService.getCovenantCompliance(user.orgId);
  }
}
