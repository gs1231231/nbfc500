import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { BtService } from './bt.service';
import {
  InitiateBalanceTransferDto,
  CalculateSavingsDto,
  TopUpLoanDto,
} from './dto/bt.dto';

@Controller()
@UseGuards(JwtAuthGuard, OrgGuard)
export class BtController {
  constructor(private readonly btService: BtService) {}

  /**
   * POST /api/v1/balance-transfer/initiate
   * Initiates a Balance Transfer loan application.
   *
   * Creates a LoanApplication capturing source lender details,
   * outstanding, foreclosure amount, and proposed terms.
   */
  @Post('api/v1/balance-transfer/initiate')
  async initiateBalanceTransfer(
    @Body() dto: InitiateBalanceTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.btService.initiateBalanceTransfer(user.orgId, dto);
  }

  /**
   * POST /api/v1/balance-transfer/calculate-savings
   * Compares old vs new EMI and calculates total interest saved.
   * Stateless — does not persist anything.
   */
  @Post('api/v1/balance-transfer/calculate-savings')
  @HttpCode(HttpStatus.OK)
  async calculateSavings(@Body() dto: CalculateSavingsDto) {
    return this.btService.calculateSavings(dto);
  }

  /**
   * POST /api/v1/loans/:id/top-up
   * Disburses an additional amount on an existing ACTIVE loan.
   *
   * Performs eligibility checks (payment track, LTV headroom) and
   * regenerates the amortization schedule on the combined outstanding.
   */
  @Post('api/v1/loans/:id/top-up')
  @HttpCode(HttpStatus.OK)
  async processTopUp(
    @Param('id') id: string,
    @Body() dto: TopUpLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.btService.processTopUp(user.orgId, id, dto);
  }
}
