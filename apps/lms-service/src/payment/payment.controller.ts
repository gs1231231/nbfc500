import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { PaymentService } from './payment.service';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Controller('api/v1/loans/:loanId')
@UseGuards(JwtAuthGuard, OrgGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /api/v1/loans/:loanId/payments
   * Records a new payment against a loan and applies it to outstanding installments.
   * Allocation order: penal interest → interest → principal.
   * Overpayments cascade to subsequent installments automatically.
   */
  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.paymentService.recordPayment(user.orgId, loanId, dto);
  }

  /**
   * GET /api/v1/loans/:loanId/payments
   * Returns all payments recorded against a loan, ordered by payment date descending.
   */
  @Get('payments')
  async getPayments(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.getPayments(user.orgId, loanId);
  }

  /**
   * GET /api/v1/loans/:loanId/statement
   * Returns a detailed Statement of Account: loan summary, repayment schedule,
   * and full payment history with per-payment allocation breakdown.
   */
  @Get('statement')
  async getStatement(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentService.getStatement(user.orgId, loanId);
  }
}
