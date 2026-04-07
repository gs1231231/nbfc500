import {
  Body,
  Controller,
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
import { NachService, RegisterMandateDto, ActivateMandateDto, HandleBounceDto } from './nach.service';

@Controller('api/v1/nach')
@UseGuards(JwtAuthGuard, OrgGuard)
export class NachController {
  constructor(private readonly nachService: NachService) {}

  /**
   * POST /api/v1/nach/register
   * Registers a new NACH mandate for a loan.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerMandate(
    @Body() dto: RegisterMandateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.registerMandate(user.orgId, dto.loanId, dto);
  }

  /**
   * PATCH /api/v1/nach/:id/activate
   * Activates a mandate with the provided UMRN.
   */
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activateMandate(
    @Param('id') id: string,
    @Body() dto: ActivateMandateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.activateMandate(user.orgId, id, dto);
  }

  /**
   * POST /api/v1/nach/present/:loanId
   * Creates a debit presentation for the upcoming EMI.
   */
  @Post('present/:loanId')
  @HttpCode(HttpStatus.CREATED)
  async presentDebit(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.presentDebit(user.orgId, loanId);
  }

  /**
   * POST /api/v1/nach/bounce
   * Records a bounce event and auto-levies charges.
   */
  @Post('bounce')
  @HttpCode(HttpStatus.OK)
  async handleBounce(
    @Body() dto: HandleBounceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.handleBounce(user.orgId, dto);
  }

  /**
   * POST /api/v1/nach/clearance/:loanId/:presentationId
   * Marks a presentation as cleared and applies payment.
   */
  @Post('clearance/:loanId/:presentationId')
  @HttpCode(HttpStatus.OK)
  async handleClearance(
    @Param('loanId') loanId: string,
    @Param('presentationId') presentationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.handleClearance(user.orgId, loanId, presentationId);
  }

  /**
   * PATCH /api/v1/nach/:id/cancel
   * Cancels a mandate.
   */
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelMandate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.cancelMandate(user.orgId, id);
  }

  /**
   * GET /api/v1/nach/mandate/:loanId
   * Returns mandate status and recent presentations for a loan.
   */
  @Get('mandate/:loanId')
  async getMandateStatus(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nachService.getMandateStatus(user.orgId, loanId);
  }

  /**
   * GET /api/v1/nach/cash-position?date=2026-04-07
   * Returns daily cash position: collections + UPI + cash - bounces - disbursements.
   */
  @Get('cash-position')
  async getDailyCashPosition(
    @Query('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    return this.nachService.getDailyCashPosition(user.orgId, targetDate);
  }
}
