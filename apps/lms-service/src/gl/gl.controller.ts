import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GlService } from './gl.service';

/**
 * GL (General Ledger) Controller
 *
 * Provides Trial Balance, Profit & Loss, Balance Sheet, and Reconciliation
 * reports derived from the gl_entries table.
 *
 * All monetary amounts in responses are in paisa unless otherwise noted.
 * orgId is passed as a query parameter until JWT auth middleware is wired.
 */
@ApiTags('General Ledger')
@Controller('api/v1/gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  // ============================================================
  // GET /api/v1/gl/trial-balance
  // ============================================================

  @Get('trial-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trial Balance',
    description:
      'Groups all non-reversed GL entries by account code up to asOfDate. ' +
      'Returns total debits, total credits, and running balance per account.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiQuery({
    name: 'asOfDate',
    required: true,
    description: 'Cut-off date (ISO 8601, e.g. 2026-03-31)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Trial balance lines' })
  async trialBalance(
    @Query('orgId') orgId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    return this.glService.getTrialBalance(orgId, new Date(asOfDate));
  }

  // ============================================================
  // GET /api/v1/gl/profit-and-loss
  // ============================================================

  @Get('profit-and-loss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Profit & Loss Statement',
    description:
      'Summarises Income accounts (3xxx) minus Expense accounts (4xxx, 5xxx) ' +
      'for the specified period. Returns totalIncome, totalExpenses, netProfit, and line items.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiQuery({ name: 'from', required: true, description: 'Period start (ISO 8601, e.g. 2026-01-01)' })
  @ApiQuery({ name: 'to', required: true, description: 'Period end (ISO 8601, e.g. 2026-03-31)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profit and Loss statement' })
  async profitAndLoss(
    @Query('orgId') orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.glService.getProfitAndLoss(orgId, new Date(from), new Date(to));
  }

  // ============================================================
  // GET /api/v1/gl/balance-sheet
  // ============================================================

  @Get('balance-sheet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Balance Sheet',
    description:
      'Returns Assets (1xxx, 2xxx), Liabilities (6xxx), and Equity (7xxx+) ' +
      'as of the specified date. Validates Assets = Liabilities + Equity.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiQuery({
    name: 'asOfDate',
    required: true,
    description: 'Cut-off date (ISO 8601, e.g. 2026-03-31)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Balance sheet' })
  async balanceSheet(
    @Query('orgId') orgId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    return this.glService.getBalanceSheet(orgId, new Date(asOfDate));
  }

  // ============================================================
  // GET /api/v1/gl/reconcile
  // ============================================================

  @Get('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'GL Reconciliation',
    description:
      'Verifies that total debits equal total credits for the given period. ' +
      'Returns isBalanced, totalDebits, totalCredits, and their difference.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiQuery({ name: 'from', required: true, description: 'Period start (ISO 8601, e.g. 2026-01-01)' })
  @ApiQuery({ name: 'to', required: true, description: 'Period end (ISO 8601, e.g. 2026-03-31)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reconciliation result' })
  async reconcile(
    @Query('orgId') orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.glService.reconcile(orgId, new Date(from), new Date(to));
  }
}
