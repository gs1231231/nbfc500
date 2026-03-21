import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { LoanService } from './loan.service';
import { ListLoansDto } from './dto/list-loans.dto';
import { PrepayLoanDto } from './dto/prepay-loan.dto';
import { ForeCloseLoanDto } from './dto/foreclose-loan.dto';

@Controller('api/v1/loans')
@UseGuards(JwtAuthGuard, OrgGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  /**
   * GET /api/v1/loans
   * Lists loans with optional filters: status, product, branch, customer.
   * Supports cursor-based pagination.
   */
  @Get()
  async listLoans(
    @Query() query: ListLoansDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanService.listLoans(user.orgId, query);
  }

  /**
   * GET /api/v1/loans/:id/schedule
   * Returns the full EMI schedule for a loan.
   */
  @Get(':id/schedule')
  async getSchedule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanService.getSchedule(user.orgId, id);
  }

  /**
   * POST /api/v1/loans/:id/prepay
   * Calculates the prepayment amount for a loan.
   */
  @Post(':id/prepay')
  @HttpCode(HttpStatus.OK)
  async prepay(
    @Param('id') id: string,
    @Body() dto: PrepayLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanService.calculatePrepayment(user.orgId, id, dto);
  }

  /**
   * POST /api/v1/loans/:id/foreclose
   * Forecloses a loan: marks FORECLOSED and zeroes out balances.
   */
  @Post(':id/foreclose')
  @HttpCode(HttpStatus.OK)
  async foreclose(
    @Param('id') id: string,
    @Body() dto: ForeCloseLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanService.foreclose(user.orgId, id, dto);
  }
}
