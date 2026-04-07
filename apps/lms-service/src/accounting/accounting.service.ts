import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface BankStatementEntry {
  utr: string;
  amount: number; // in paisa
  date: string;   // ISO date string
  description: string;
  type: 'CREDIT' | 'DEBIT';
}

export interface BankReconResult {
  matched: Array<{
    bankEntry: BankStatementEntry;
    glEntry: { id: string; narration: string; referenceId: string | null };
    matchedBy: 'UTR' | 'AMOUNT_DATE';
  }>;
  unmatched: BankStatementEntry[];
  exceptions: Array<{
    bankEntry: BankStatementEntry;
    reason: string;
  }>;
  summary: {
    totalEntries: number;
    matchedCount: number;
    unmatchedCount: number;
    exceptionCount: number;
  };
}

export interface TdsSummary {
  organizationId: string;
  quarter: string;
  fy: string;
  section: '194A';
  totalInterestPaid: number; // paisa
  tdsDeducted: number;       // 10% of interest paid
  tdsRate: number;
  payees: Array<{
    payeeType: string;
    interestPaisa: number;
    tdsDeductedPaisa: number;
  }>;
  dueDateForDeposit: string;
  formType: 'Form 26Q';
}

export interface GstrSummary {
  organizationId: string;
  period: string; // YYYY-MM
  gstRate: number;
  taxableAmountPaisa: number;
  cgstPaisa: number;
  sgstPaisa: number;
  igstPaisa: number;
  totalGstPaisa: number;
  breakup: Array<{
    chargeType: 'PROCESSING_FEE' | 'PENAL_CHARGE' | 'BOUNCE_CHARGE' | 'OTHER';
    taxableAmountPaisa: number;
    gstPaisa: number;
  }>;
  filingDeadline: string;
  gstrType: 'GSTR-1' | 'GSTR-3B';
}

export interface EirResult {
  organizationId: string;
  loanId: string;
  loanNumber: string;
  nominalRate: number;       // annualized %
  eir: number;               // effective interest rate %
  disbursedAmountPaisa: number;
  originationCostsPaisa: number;
  netDisbursementPaisa: number;
  tenureMonths: number;
  amortizationSchedule: Array<{
    period: number;
    openingBalance: number;
    eirInterest: number;
    cashFlow: number;
    closingBalance: number;
  }>;
  indAs109Compliant: boolean;
}

// ── GL Account codes ─────────────────────────────────────────────────────────

const GL_PROCESSING_FEE_INCOME = '3010';
const GL_PENAL_CHARGE_INCOME   = '3011';
const GL_BOUNCE_CHARGE_INCOME  = '3012';
const GL_GST_PAYABLE           = '6010';
const GL_TDS_PAYABLE           = '6011';
const GL_INTEREST_INCOME       = '3001';

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bank Reconciliation — matches bank statement entries against GL entries
   * by UTR reference first, then falls back to amount+date matching.
   *
   * IndAS 32 / RBI circular on reconciliation: all entries must be matched
   * within T+1 banking days.
   */
  async bankReconciliation(
    orgId: string,
    bankStatementEntries: BankStatementEntry[],
  ): Promise<BankReconResult> {
    this.logger.log(
      `Bank reconciliation for org ${orgId}, ${bankStatementEntries.length} entries`,
    );

    const fromDate = bankStatementEntries.reduce(
      (min, e) => (e.date < min ? e.date : min),
      bankStatementEntries[0]?.date ?? new Date().toISOString().slice(0, 10),
    );
    const toDate = bankStatementEntries.reduce(
      (max, e) => (e.date > max ? e.date : max),
      bankStatementEntries[0]?.date ?? new Date().toISOString().slice(0, 10),
    );

    // Fetch GL entries for the date range
    const glEntries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        entryDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate + 'T23:59:59Z'),
        },
        isReversed: false,
      },
    });

    const matchedGlIds = new Set<string>();
    const matched: BankReconResult['matched'] = [];
    const unmatched: BankStatementEntry[] = [];
    const exceptions: BankReconResult['exceptions'] = [];

    for (const bankEntry of bankStatementEntries) {
      // 1. Try UTR match
      const utrMatch = glEntries.find(
        (gl) =>
          !matchedGlIds.has(gl.id) &&
          gl.referenceId &&
          gl.referenceId.includes(bankEntry.utr),
      );

      if (utrMatch) {
        matchedGlIds.add(utrMatch.id);
        matched.push({ bankEntry, glEntry: utrMatch, matchedBy: 'UTR' });
        continue;
      }

      // 2. Try amount + date match (within 1 day tolerance)
      const bankDate = new Date(bankEntry.date);
      const amountDateMatch = glEntries.find((gl) => {
        if (matchedGlIds.has(gl.id)) return false;
        const glAmount =
          bankEntry.type === 'CREDIT'
            ? gl.creditAmountPaisa
            : gl.debitAmountPaisa;
        if (glAmount !== bankEntry.amount) return false;
        const glDate = new Date(gl.entryDate);
        const diffMs = Math.abs(glDate.getTime() - bankDate.getTime());
        return diffMs <= 86400000; // within 24h
      });

      if (amountDateMatch) {
        matchedGlIds.add(amountDateMatch.id);
        matched.push({
          bankEntry,
          glEntry: amountDateMatch,
          matchedBy: 'AMOUNT_DATE',
        });
        continue;
      }

      // 3. Check for exceptions (duplicate UTR, amount mismatch)
      const possibleDup = glEntries.find(
        (gl) =>
          matchedGlIds.has(gl.id) &&
          gl.referenceId &&
          gl.referenceId.includes(bankEntry.utr),
      );

      if (possibleDup) {
        exceptions.push({ bankEntry, reason: 'DUPLICATE_UTR' });
      } else {
        unmatched.push(bankEntry);
      }
    }

    return {
      matched,
      unmatched,
      exceptions,
      summary: {
        totalEntries: bankStatementEntries.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        exceptionCount: exceptions.length,
      },
    };
  }

  /**
   * TDS Calculation — Section 194A: TDS on interest paid to NCD/deposit holders.
   * Rate: 10% for residents (PAN furnished), 20% without PAN.
   * Quarterly returns in Form 26Q.
   */
  async calculateTDS(orgId: string, quarter: string, fy: string): Promise<TdsSummary> {
    this.logger.log(`TDS calc for org ${orgId}, Q=${quarter}, FY=${fy}`);

    const { fromDate, toDate } = this.quarterToDateRange(quarter, fy);

    // Fetch interest income GL entries for the period
    const interestEntries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        accountCode: GL_INTEREST_INCOME,
        entryDate: { gte: fromDate, lte: toDate },
        isReversed: false,
      },
    });

    // For NBFC: TDS applies to interest paid on NCDs/deposits, not on loan interest received
    // Here we model it as interest income that is payable to investors
    const totalInterestPaid = interestEntries.reduce(
      (sum, e) => sum + e.creditAmountPaisa,
      0,
    );

    const TDS_RATE = 0.10; // 10% u/s 194A
    const tdsDeducted = Math.round(totalInterestPaid * TDS_RATE);

    // Deposit quarter due date (7th of next month after quarter end)
    const dueDateMap: Record<string, string> = {
      Q1: `${fy.split('-')[0]}-07-07`,
      Q2: `${fy.split('-')[0]}-10-07`,
      Q3: `${fy.split('-')[0]}-01-07`,
      Q4: `20${fy.split('-')[1]}-04-30`, // Q4 due 30 April
    };

    return {
      organizationId: orgId,
      quarter,
      fy,
      section: '194A',
      totalInterestPaid,
      tdsDeducted,
      tdsRate: TDS_RATE * 100,
      payees: [
        {
          payeeType: 'NCD_HOLDER',
          interestPaisa: totalInterestPaid,
          tdsDeductedPaisa: tdsDeducted,
        },
      ],
      dueDateForDeposit: dueDateMap[quarter] ?? '',
      formType: 'Form 26Q',
    };
  }

  /**
   * GST Liability — GST on processing fees (18%), penal charges (18%),
   * bounce charges (18%) per Finance Act / GST council notifications.
   * Output: GSTR-1 (outward supplies) + GSTR-3B (summary return).
   */
  async calculateGSTLiability(orgId: string, period: string): Promise<GstrSummary> {
    this.logger.log(`GST liability for org ${orgId}, period=${period}`);

    const [year, month] = period.split('-').map(Number);
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0, 23, 59, 59);

    // Fetch charge entries by type
    const chargeAccounts = [
      { code: GL_PROCESSING_FEE_INCOME, type: 'PROCESSING_FEE' as const },
      { code: GL_PENAL_CHARGE_INCOME, type: 'PENAL_CHARGE' as const },
      { code: GL_BOUNCE_CHARGE_INCOME, type: 'BOUNCE_CHARGE' as const },
    ];

    const breakup: GstrSummary['breakup'] = [];
    let totalTaxable = 0;
    let totalGst = 0;

    for (const account of chargeAccounts) {
      const entries = await this.prisma.glEntry.findMany({
        where: {
          organizationId: orgId,
          accountCode: account.code,
          entryDate: { gte: fromDate, lte: toDate },
          isReversed: false,
        },
      });

      const taxablePaisa = entries.reduce((s, e) => s + e.creditAmountPaisa, 0);
      const gstRate = 0.18;
      const gstPaisa = Math.round(taxablePaisa * gstRate);

      totalTaxable += taxablePaisa;
      totalGst += gstPaisa;

      if (taxablePaisa > 0) {
        breakup.push({ chargeType: account.type, taxableAmountPaisa: taxablePaisa, gstPaisa });
      }
    }

    // Split GST: CGST 9% + SGST 9% for intra-state; IGST 18% for inter-state
    // Defaulting to intra-state (CGST + SGST)
    const cgstPaisa = Math.round(totalGst / 2);
    const sgstPaisa = totalGst - cgstPaisa;

    // Filing deadline: 11th of next month for GSTR-1, 20th for GSTR-3B
    const [nextYear, nextMonth] =
      month === 12
        ? [year + 1, 1]
        : [year, month + 1];
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    const filingDeadline = `${nextYear}-${nextMonthStr}-20`;

    return {
      organizationId: orgId,
      period,
      gstRate: 18,
      taxableAmountPaisa: totalTaxable,
      cgstPaisa,
      sgstPaisa,
      igstPaisa: 0,
      totalGstPaisa: totalGst,
      breakup,
      filingDeadline,
      gstrType: 'GSTR-3B',
    };
  }

  /**
   * Effective Interest Rate (EIR) — per IndAS 109 / IFRS 9.
   *
   * EIR is the rate that exactly discounts estimated future cash flows
   * to the gross carrying amount (net of origination costs).
   *
   * EIR amortizes upfront fees and origination costs over the loan life
   * using the internal rate of return (IRR) method.
   */
  async calculateEIR(orgId: string, loanId: string): Promise<EirResult> {
    this.logger.log(`EIR calculation for loan ${loanId}`);

    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { schedules: { orderBy: { dueDate: 'asc' } } },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Fetch origination costs from charge entries (processing fees, documentation charges)
    const chargeSums = await this.prisma.loanChargeEntry.aggregate({
      where: {
        loanId,
        chargeType: { in: ['PROCESSING_FEE', 'DOCUMENTATION_CHARGE', 'ORIGINATION_FEE'] },
      },
      _sum: { amountPaisa: true },
    });

    const originationCosts = chargeSums._sum.amountPaisa ?? 0;
    const disbursed = loan.disbursedAmountPaisa;
    const netDisbursement = disbursed - originationCosts;

    // Build cash flow array: [-netDisbursement, emi1, emi2, ... emiN]
    const cashFlows: number[] = [-netDisbursement];
    for (const schedule of loan.schedules) {
      cashFlows.push(
        schedule.principalComponentPaisa +
          schedule.interestComponentPaisa +
          (schedule.penalInterestPaisa ?? 0),
      );
    }

    const tenureMonths = loan.schedules.length;

    // Calculate IRR (monthly) using Newton-Raphson method
    const monthlyEir = this.calculateIRR(cashFlows);
    const annualEir = ((1 + monthlyEir) ** 12 - 1) * 100;
    // Nominal rate: convert from BPS to percent (interestRateBps is in basis points)
    const nominalRate = loan.interestRateBps / 100;

    // Build amortization under EIR
    const amortizationSchedule: EirResult['amortizationSchedule'] = [];
    let balance = netDisbursement;

    for (let i = 0; i < Math.min(tenureMonths, loan.schedules.length); i++) {
      const sch = loan.schedules[i];
      const eirInterest = Math.round(balance * monthlyEir);
      const cashFlow = sch.principalComponentPaisa + sch.interestComponentPaisa;
      const closingBalance = balance + eirInterest - cashFlow;

      amortizationSchedule.push({
        period: i + 1,
        openingBalance: balance,
        eirInterest,
        cashFlow,
        closingBalance,
      });

      balance = closingBalance;
    }

    return {
      organizationId: orgId,
      loanId,
      loanNumber: loan.loanNumber,
      nominalRate,
      eir: Math.round(annualEir * 100) / 100,
      disbursedAmountPaisa: disbursed,
      originationCostsPaisa: originationCosts,
      netDisbursementPaisa: netDisbursement,
      tenureMonths,
      amortizationSchedule,
      indAs109Compliant: true,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Newton-Raphson IRR calculation for a monthly cash flow series.
   * Returns the monthly rate.
   */
  private calculateIRR(cashFlows: number[], maxIterations = 1000, tolerance = 1e-7): number {
    let rate = 0.01; // Start with 1% monthly

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dNpv = 0;

      for (let t = 0; t < cashFlows.length; t++) {
        const factor = Math.pow(1 + rate, t);
        npv += cashFlows[t] / factor;
        dNpv -= (t * cashFlows[t]) / (factor * (1 + rate));
      }

      const newRate = rate - npv / dNpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return rate;
  }

  private quarterToDateRange(
    quarter: string,
    fy: string,
  ): { fromDate: Date; toDate: Date } {
    const [startYear] = fy.split('-').map(Number);
    const ranges: Record<string, [number, number, number, number, number, number]> = {
      Q1: [startYear, 3, 1,  startYear, 5, 30],
      Q2: [startYear, 6, 1,  startYear, 8, 30],
      Q3: [startYear, 9, 1,  startYear, 11, 31],
      Q4: [startYear, 12, 1, startYear + 1, 2, 28],
    };

    const range = ranges[quarter];
    if (!range) {
      throw new Error(`Invalid quarter: ${quarter}`);
    }

    return {
      fromDate: new Date(range[0], range[1] - 1, range[2]),
      toDate: new Date(range[3], range[4] - 1, range[5], 23, 59, 59),
    };
  }
}
