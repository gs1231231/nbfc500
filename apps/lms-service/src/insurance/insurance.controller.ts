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
import { InsuranceService } from './insurance.service';
import { AddPolicyDto, UpdatePolicyDto, InitiateClaimDto } from './dto/insurance.dto';

@Controller('api/v1/insurance')
@UseGuards(JwtAuthGuard, OrgGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  // ----------------------------------------------------------------
  // Policy CRUD
  // ----------------------------------------------------------------

  /**
   * POST /api/v1/insurance/policies/:loanId
   * Adds an insurance policy linked to a specific loan.
   */
  @Post('policies/:loanId')
  async addPolicy(
    @Param('loanId') loanId: string,
    @Body() dto: AddPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.addPolicy(user.orgId, loanId, dto);
  }

  /**
   * GET /api/v1/insurance/policies
   * Lists all insurance policies. Optional ?loanId=xxx filter.
   */
  @Get('policies')
  async listPolicies(
    @Query('loanId') loanId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.listPolicies(user.orgId, loanId);
  }

  /**
   * GET /api/v1/insurance/policies/:id
   * Returns a single insurance policy.
   */
  @Get('policies/:id')
  async getPolicy(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.getPolicy(user.orgId, id);
  }

  /**
   * PATCH /api/v1/insurance/policies/:id
   * Updates an insurance policy.
   */
  @Patch('policies/:id')
  async updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.updatePolicy(user.orgId, id, dto);
  }

  /**
   * DELETE /api/v1/insurance/policies/:id
   * Cancels an insurance policy (status → CANCELLED).
   */
  @Delete('policies/:id')
  @HttpCode(HttpStatus.OK)
  async deletePolicy(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.deletePolicy(user.orgId, id);
  }

  // ----------------------------------------------------------------
  // Renewal & Claims
  // ----------------------------------------------------------------

  /**
   * GET /api/v1/insurance/renewals-due?daysAhead=30
   * Returns policies expiring within N days.
   */
  @Get('renewals-due')
  async getRenewalsDue(
    @Query('daysAhead') daysAhead: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.getRenewalsDue(
      user.orgId,
      daysAhead ? parseInt(daysAhead, 10) : 30,
    );
  }

  /**
   * POST /api/v1/insurance/policies/:id/renew
   * Renews an insurance policy and charges the premium to the loan.
   */
  @Post('policies/:id/renew')
  @HttpCode(HttpStatus.OK)
  async processRenewal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.processRenewal(user.orgId, id);
  }

  /**
   * POST /api/v1/insurance/policies/:id/claim
   * Initiates a claim for an active policy.
   */
  @Post('policies/:id/claim')
  @HttpCode(HttpStatus.OK)
  async initiateClaim(
    @Param('id') id: string,
    @Body() dto: InitiateClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insuranceService.initiateClaim(user.orgId, id, dto);
  }
}
