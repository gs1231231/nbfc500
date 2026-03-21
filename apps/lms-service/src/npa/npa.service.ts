import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@bankos/database';
import { NpaClassification as PrismaNpaClassification, LoanStatus } from '@prisma/client';
import {
  classifyNpa,
  calculateProvision,
  calculateDpd,
  NpaClassification,
} from '@bankos/common';

interface NpaChangeSummary {
  loanId: string;
  loanNumber: string;
  previousClassification: PrismaNpaClassification;
  newClassification: PrismaNpaClassification;
  dpd: number;
  provisionPaisa: number;
}

interface NpaRunResult {
  processedCount: number;
  changedCount: number;
  newNpaCount: number;
  upgradedToStandardCount: number;
  changes: NpaChangeSummary[];
  runAt: Date;
}

/**
 * Casts a Prisma NpaClassification string value to the @bankos/common NpaClassification
 * enum. Both enums share identical string members, so this cast is always safe.
 */
function toCommonNpa(value: PrismaNpaClassification): NpaClassification {
  return value as unknown as NpaClassification;
}

@Injectable()
export class NpaService {
  private readonly logger = new Logger(NpaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scheduled NPA classification job — runs daily at 00:30 IST.
   * Cron: 19:00 UTC (IST = UTC+5:30, so 00:30 IST ≈ 19:00 UTC previous day).
   */
  @Cron('0 19 * * *', { name: 'npa-classification', timeZone: 'UTC' })
  async scheduledNpaClassification(): Promise<void> {
    this.logger.log('Starting scheduled NPA classification job');
    const result = await this.runNpaClassification();
    this.logger.log(
      `NPA classification complete: processed=${result.processedCount}, changed=${result.changedCount}, newNpa=${result.newNpaCount}`,
    );
  }

  /**
   * Runs NPA classification for all active loans across all organizations.
   *
   * For each active loan:
   *   1. Finds the oldest unpaid installment.
   *   2. Calculates DPD = daysBetween(installment.dueDate, today).
   *   3. Determines new classification via classifyNpa(dpd).
   *   4. If classification changed, updates loan and creates GL provision entries.
   *
   * @returns Summary of changes made during the run.
   */
  async runNpaClassification(): Promise<NpaRunResult> {
    const today = new Date();
    const runAt = new Date();

    // Normalize today to midnight
    today.setHours(0, 0, 0, 0);

    const activeLoans = await this.prisma.loan.findMany({
      where: { loanStatus: LoanStatus.ACTIVE },
      include: {
        schedules: {
          where: {
            status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
    });

    const changes: NpaChangeSummary[] = [];
    let newNpaCount = 0;
    let upgradedToStandardCount = 0;

    for (const loan of activeLoans) {
      try {
        const oldestUnpaidInstallment = loan.schedules[0];

        let dpd = 0;
        if (oldestUnpaidInstallment) {
          dpd = calculateDpd(oldestUnpaidInstallment.dueDate, null, today);
        }

        // classifyNpa returns @bankos/common NpaClassification
        const newClassificationCommon: NpaClassification = classifyNpa(dpd);
        // Cast to Prisma type for DB write (same string values)
        const newClassification = newClassificationCommon as unknown as PrismaNpaClassification;
        const previousClassification = loan.npaClassification;

        if (newClassification === previousClassification && loan.dpd === dpd) {
          // No change — skip
          continue;
        }

        const provisionPaisa = calculateProvision(
          toCommonNpa(newClassification),
          loan.outstandingPrincipalPaisa,
        );

        const previousProvisionPaisa = calculateProvision(
          toCommonNpa(previousClassification),
          loan.outstandingPrincipalPaisa,
        );

        const isNewlyNpa =
          newClassification === PrismaNpaClassification.NPA_SUBSTANDARD &&
          previousClassification !== PrismaNpaClassification.NPA_SUBSTANDARD;

        const isUpgradedToStandard =
          newClassification === PrismaNpaClassification.STANDARD &&
          previousClassification !== PrismaNpaClassification.STANDARD;

        // Build update payload
        const updateData: Record<string, unknown> = {
          npaClassification: newClassification,
          dpd,
        };

        if (isNewlyNpa) {
          updateData.npaDate = today;
          newNpaCount++;
        }

        if (isUpgradedToStandard) {
          updateData.npaDate = null;
          upgradedToStandardCount++;
        }

        // Persist loan update and GL entries in a transaction
        await this.prisma.$transaction(async (tx) => {
          await tx.loan.update({
            where: { id: loan.id },
            data: updateData,
          });

          // Only create GL provision entries if provision amount changed
          const provisionDelta = provisionPaisa - previousProvisionPaisa;
          if (provisionDelta !== 0) {
            const isIncrease = provisionDelta > 0;
            const absAmount = Math.abs(provisionDelta);

            // Increase: Dr Provision for NPA Expense (5001), Cr Provision Reserve (4001)
            // Decrease: Dr Provision Reserve (4001), Cr Provision for NPA Expense (5001)
            const narration = `NPA Provision ${isIncrease ? 'charge' : 'write-back'} - ${loan.loanNumber} | ${previousClassification} -> ${newClassification} | DPD: ${dpd}`;

            await tx.glEntry.createMany({
              data: [
                {
                  organizationId: loan.organizationId,
                  branchId: loan.branchId,
                  entryDate: today,
                  valueDate: today,
                  accountCode: isIncrease ? '5001' : '4001',
                  accountName: isIncrease
                    ? 'Provision for NPA Expense'
                    : 'Provision Reserve',
                  debitAmountPaisa: absAmount,
                  creditAmountPaisa: 0,
                  narration,
                  referenceType: 'LOAN_NPA_PROVISION',
                  referenceId: loan.id,
                },
                {
                  organizationId: loan.organizationId,
                  branchId: loan.branchId,
                  entryDate: today,
                  valueDate: today,
                  accountCode: isIncrease ? '4001' : '5001',
                  accountName: isIncrease
                    ? 'Provision Reserve'
                    : 'Provision for NPA Expense',
                  debitAmountPaisa: 0,
                  creditAmountPaisa: absAmount,
                  narration,
                  referenceType: 'LOAN_NPA_PROVISION',
                  referenceId: loan.id,
                },
              ],
            });
          }
        });

        changes.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          previousClassification,
          newClassification,
          dpd,
          provisionPaisa,
        });
      } catch (error) {
        this.logger.error(
          `Failed to classify NPA for loan ${loan.loanNumber}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return {
      processedCount: activeLoans.length,
      changedCount: changes.length,
      newNpaCount,
      upgradedToStandardCount,
      changes,
      runAt,
    };
  }
}
