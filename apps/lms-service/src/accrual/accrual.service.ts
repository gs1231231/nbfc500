import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@bankos/database';
import { LoanStatus } from '@prisma/client';

// Configure Decimal.js for high-precision financial calculations
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** GL account codes for interest accrual */
const GL_ACCRUED_INTEREST = '2001';
const GL_INTEREST_INCOME = '3001';

interface AccrualEntry {
  loanId: string;
  loanNumber: string;
  dailyInterestPaisa: number;
}

interface AccrualRunResult {
  processedCount: number;
  accruedCount: number;
  skippedCount: number;
  totalAccruedPaisa: number;
  entries: AccrualEntry[];
  accrualDate: Date;
}

@Injectable()
export class AccrualService {
  private readonly logger = new Logger(AccrualService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scheduled interest accrual job — runs daily at 00:15 IST.
   * Cron: 18:45 UTC (IST = UTC+5:30, so 00:15 IST = 18:45 UTC previous day).
   */
  @Cron('45 18 * * *', { name: 'daily-interest-accrual', timeZone: 'UTC' })
  async scheduledDailyAccrual(): Promise<void> {
    this.logger.log('Starting scheduled daily interest accrual job');
    const result = await this.runDailyAccrual();
    this.logger.log(
      `Interest accrual complete: processed=${result.processedCount}, accrued=${result.accruedCount}, skipped=${result.skippedCount}, totalAccruedPaisa=${result.totalAccruedPaisa}`,
    );
  }

  /**
   * Runs daily interest accrual for all active loans across all organizations.
   *
   * For each active loan:
   *   1. Check idempotency — skip if GL entry for today already exists.
   *   2. Calculate daily interest = outstandingPrincipalPaisa * annualRateBps / 10000 / 365.
   *   3. Round to nearest paisa.
   *   4. Create GL entries: Dr Accrued Interest (2001), Cr Interest Income (3001).
   *   5. Update loan.outstandingInterestPaisa += dailyInterest.
   *
   * Idempotency: checks for existing GL entry with referenceType='DAILY_INTEREST_ACCRUAL'
   * and referenceId=loanId for today's entryDate before processing.
   *
   * @param accrualDate - Date to run accrual for (defaults to today).
   * @returns Summary of accrual run.
   */
  async runDailyAccrual(accrualDate?: Date): Promise<AccrualRunResult> {
    const today = accrualDate ? new Date(accrualDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const activeLoans = await this.prisma.loan.findMany({
      where: { loanStatus: LoanStatus.ACTIVE },
    });

    const entries: AccrualEntry[] = [];
    let skippedCount = 0;
    let totalAccruedPaisa = 0;

    for (const loan of activeLoans) {
      try {
        // Idempotency check: look for existing accrual GL entry for this loan today
        const existingEntry = await this.prisma.glEntry.findFirst({
          where: {
            referenceType: 'DAILY_INTEREST_ACCRUAL',
            referenceId: loan.id,
            entryDate: {
              gte: today,
              lt: tomorrowStart,
            },
          },
        });

        if (existingEntry) {
          this.logger.debug(
            `Accrual already done for loan ${loan.loanNumber} on ${today.toISOString().split('T')[0]} — skipping`,
          );
          skippedCount++;
          continue;
        }

        // Calculate daily interest using Decimal.js to avoid floating-point errors.
        // Formula: dailyInterest = outstandingPrincipalPaisa * annualRateBps / 10000 / 365
        const dailyInterestPaisa = new Decimal(loan.outstandingPrincipalPaisa)
          .mul(new Decimal(loan.interestRateBps))
          .div(10000)
          .div(365)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();

        if (dailyInterestPaisa <= 0) {
          // Zero-interest loans or fully paid down — skip GL but still idempotent
          skippedCount++;
          continue;
        }

        const narration = `Daily interest accrual - ${loan.loanNumber} | Principal: ${loan.outstandingPrincipalPaisa} paisa | Rate: ${loan.interestRateBps} bps | Date: ${today.toISOString().split('T')[0]}`;

        await this.prisma.$transaction(async (tx) => {
          // Create GL entries: Dr Accrued Interest (2001), Cr Interest Income (3001)
          await tx.glEntry.createMany({
            data: [
              {
                organizationId: loan.organizationId,
                branchId: loan.branchId,
                entryDate: today,
                valueDate: today,
                accountCode: GL_ACCRUED_INTEREST,
                accountName: 'Accrued Interest Receivable',
                debitAmountPaisa: dailyInterestPaisa,
                creditAmountPaisa: 0,
                narration,
                referenceType: 'DAILY_INTEREST_ACCRUAL',
                referenceId: loan.id,
              },
              {
                organizationId: loan.organizationId,
                branchId: loan.branchId,
                entryDate: today,
                valueDate: today,
                accountCode: GL_INTEREST_INCOME,
                accountName: 'Interest Income',
                debitAmountPaisa: 0,
                creditAmountPaisa: dailyInterestPaisa,
                narration,
                referenceType: 'DAILY_INTEREST_ACCRUAL',
                referenceId: loan.id,
              },
            ],
          });

          // Update outstanding interest on the loan
          await tx.loan.update({
            where: { id: loan.id },
            data: {
              outstandingInterestPaisa: {
                increment: dailyInterestPaisa,
              },
            },
          });
        });

        entries.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          dailyInterestPaisa,
        });

        totalAccruedPaisa += dailyInterestPaisa;
      } catch (error) {
        this.logger.error(
          `Failed to accrue interest for loan ${loan.loanNumber}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return {
      processedCount: activeLoans.length,
      accruedCount: entries.length,
      skippedCount,
      totalAccruedPaisa,
      entries,
      accrualDate: today,
    };
  }
}
