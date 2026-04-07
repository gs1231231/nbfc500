import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { AccountingService, BankStatementEntry } from './accounting.service';

class BankReconDto {
  entries!: BankStatementEntry[];
}

@Controller('api/v1/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  /**
   * POST /api/v1/accounting/bank-recon
   * Match bank statement entries against GL entries.
   */
  @Post('bank-recon')
  bankReconciliation(
    @Headers('x-org-id') orgId: string,
    @Body() dto: BankReconDto,
  ) {
    return this.accountingService.bankReconciliation(orgId, dto.entries);
  }

  /**
   * GET /api/v1/accounting/tds?quarter=Q4&fy=2025-26
   * TDS liability on interest paid (Section 194A).
   */
  @Get('tds')
  calculateTDS(
    @Headers('x-org-id') orgId: string,
    @Query('quarter') quarter: string,
    @Query('fy') fy: string,
  ) {
    return this.accountingService.calculateTDS(orgId, quarter, fy);
  }

  /**
   * GET /api/v1/accounting/gst?month=2026-03
   * GST on processing fees, penal charges, bounce charges.
   */
  @Get('gst')
  calculateGSTLiability(
    @Headers('x-org-id') orgId: string,
    @Query('month') month: string,
  ) {
    return this.accountingService.calculateGSTLiability(orgId, month);
  }

  /**
   * GET /api/v1/accounting/eir/:loanId
   * Effective Interest Rate per IndAS 109.
   */
  @Get('eir/:loanId')
  calculateEIR(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
  ) {
    return this.accountingService.calculateEIR(orgId, loanId);
  }
}
