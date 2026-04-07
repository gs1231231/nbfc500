import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { generateSchedule } from '@bankos/common';
import { UpdateBenchmarkRateDto, RateImpactAnalysisDto } from './dto/rate.dto';

// Number of days ahead to look for upcoming rate resets
const UPCOMING_RESET_DAYS = 30;

@Injectable()
export class RateService {
  private readonly logger = new Logger(RateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Benchmark Rate Management
  // ============================================================

  /**
   * Updates the benchmark rate (REPO / MCLR) stored in the organization's
   * InterestRateCard for floating-rate products.
   *
   * Creates a new rate card entry with the updated rate effective from today
   * (or the supplied effectiveDate). The existing card is soft-closed by
   * setting effectiveTo.
   */
  async updateBenchmarkRate(orgId: string, dto: UpdateBenchmarkRateDto) {
    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();

    // Find currently active rate cards for this benchmark
    const activeCards = await this.prisma.interestRateCard.findMany({
      where: {
        organizationId: orgId,
        benchmark: dto.benchmark,
        rateType: 'FLOATING',
        effectiveTo: null,
      },
    });

    // Close existing cards
    if (activeCards.length > 0) {
      await this.prisma.interestRateCard.updateMany({
        where: { id: { in: activeCards.map((c) => c.id) } },
        data: { effectiveTo: effectiveDate },
      });
    }

    // Create new rate card entries at the new benchmark rate for each closed card
    const created = [];
    for (const card of activeCards) {
      const newRate = dto.newRateBps + (card.spreadBps ?? 0);
      const newCard = await this.prisma.interestRateCard.create({
        data: {
          organizationId: orgId,
          productId: card.productId,
          riskGrade: card.riskGrade,
          cibilMin: card.cibilMin,
          cibilMax: card.cibilMax,
          rateBps: newRate,
          rateType: 'FLOATING',
          benchmark: dto.benchmark,
          spreadBps: card.spreadBps,
          effectiveFrom: effectiveDate,
        },
      });
      created.push(newCard);
    }

    this.logger.log(
      `Benchmark ${dto.benchmark} updated to ${dto.newRateBps} bps. ` +
        `${created.length} rate card(s) updated for org ${orgId}.`,
    );

    return {
      benchmark: dto.benchmark,
      newRateBps: dto.newRateBps,
      effectiveDate: effectiveDate.toISOString(),
      updatedRateCards: created.length,
      cards: created,
    };
  }

  /**
   * Identifies all floating-rate loans due for a rate reset and applies
   * the new effective rate = benchmark + spread, then regenerates remaining schedule.
   *
   * A loan is eligible for reset when:
   *   - its product has rateType=FLOATING
   *   - its nextRateReset date is on or before today
   *
   * Since the Loan model doesn't have a dedicated nextRateReset field, we
   * use the product's InterestRateCard reset logic: loans where the last
   * schedule installment was created before the latest rate card change.
   */
  async applyRateReset(orgId: string) {
    // Find all floating-rate active loans with their rate card details
    const floatingLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        loanStatus: 'ACTIVE',
        product: { rateCards: { some: { rateType: 'FLOATING', effectiveTo: null } } },
      },
      include: {
        product: {
          include: { rateCards: { where: { rateType: 'FLOATING', effectiveTo: null } } },
        },
        schedules: {
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    const results = [];
    let resetCount = 0;

    for (const loan of floatingLoans) {
      const latestCard = loan.product.rateCards[0];
      if (!latestCard) continue;

      // Skip if rate hasn't changed
      if (loan.interestRateBps === latestCard.rateBps) continue;

      const pendingInstallments = loan.schedules;
      if (pendingInstallments.length === 0) continue;

      const newRateBps = latestCard.rateBps;
      const remainingTenure = pendingInstallments.length;
      const firstResetDate = pendingInstallments[0].dueDate;

      // Regenerate schedule from today with new rate
      const newSchedule = generateSchedule({
        principalPaisa: loan.outstandingPrincipalPaisa,
        annualRateBps: newRateBps,
        tenureMonths: remainingTenure,
        disbursementDate: new Date(),
        firstEmiDate: firstResetDate,
      });

      const nextInstallmentNumber =
        loan.schedules.filter((s: { status: string }) => s.status === 'PAID').length + 1;

      // Bulk-delete old pending installments and create new ones in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete old pending schedules
        await tx.loanSchedule.deleteMany({
          where: {
            loanId: loan.id,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        });

        // Create new schedule at reset rate
        await tx.loanSchedule.createMany({
          data: newSchedule.map((entry, i) => ({
            loanId: loan.id,
            installmentNumber: nextInstallmentNumber + i,
            dueDate: entry.dueDate,
            emiAmountPaisa: entry.emiAmountPaisa,
            principalComponentPaisa: entry.principalPaisa,
            interestComponentPaisa: entry.interestPaisa,
            openingBalancePaisa: entry.openingBalancePaisa,
            closingBalancePaisa: entry.closingBalancePaisa,
            status: 'PENDING',
          })),
        });

        // Update loan rate and maturity
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            interestRateBps: newRateBps,
            emiAmountPaisa: newSchedule[0]?.emiAmountPaisa ?? loan.emiAmountPaisa,
            maturityDate: newSchedule[newSchedule.length - 1]?.dueDate ?? loan.maturityDate,
          },
        });
      });

      results.push({
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        oldRateBps: loan.interestRateBps,
        newRateBps,
        rateChangeBps: newRateBps - loan.interestRateBps,
        remainingInstallments: remainingTenure,
      });

      resetCount++;
      this.logger.log(
        `Rate reset applied for loan ${loan.loanNumber}: ${loan.interestRateBps} → ${newRateBps} bps`,
      );
    }

    return {
      message: `Rate reset complete. ${resetCount} loan(s) updated.`,
      resetCount,
      loans: results,
    };
  }

  /**
   * Returns loans with a floating rate whose rate reset is due within
   * the next UPCOMING_RESET_DAYS days.
   *
   * Since the schema doesn't have a nextRateReset field on Loan, we identify
   * candidates as active floating-rate loans whose current interestRateBps
   * differs from the latest rate card for their product.
   */
  async getUpcomingResets(orgId: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + UPCOMING_RESET_DAYS);

    // Find active floating-rate loans where current rate != latest rate card rate
    const floatingLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        loanStatus: 'ACTIVE',
        product: { rateCards: { some: { rateType: 'FLOATING', effectiveTo: null } } },
      },
      include: {
        product: {
          include: {
            rateCards: {
              where: { rateType: 'FLOATING', effectiveTo: null },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
        },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    const upcoming = floatingLoans
      .filter((loan) => {
        const latestCard = loan.product.rateCards[0];
        if (!latestCard) return false;
        return loan.interestRateBps !== latestCard.rateBps;
      })
      .map((loan) => {
        const latestCard = loan.product.rateCards[0];
        return {
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          customerId: loan.customerId,
          customerName: loan.customer.fullName,
          currentRateBps: loan.interestRateBps,
          newRateBps: latestCard?.rateBps,
          rateChangeBps: (latestCard?.rateBps ?? loan.interestRateBps) - loan.interestRateBps,
          productName: loan.product.name,
          maturityDate: loan.maturityDate,
        };
      });

    return {
      upcomingResetCount: upcoming.length,
      windowDays: UPCOMING_RESET_DAYS,
      loans: upcoming,
    };
  }

  /**
   * Simulates the impact on NIM if a benchmark rate changes by X basis points.
   *
   * For each active floating-rate loan, calculates the change in interest income
   * over the remaining tenure. Returns aggregate impact.
   */
  async rateChangeImpact(orgId: string, dto: RateImpactAnalysisDto) {
    const { benchmarkChangeBps, benchmark } = dto;

    // Find active floating-rate loans
    const where: Record<string, unknown> = {
      organizationId: orgId,
      loanStatus: 'ACTIVE',
    };

    if (benchmark) {
      where.product = { rateCards: { some: { rateType: 'FLOATING', benchmark, effectiveTo: null } } };
    } else {
      where.product = { rateCards: { some: { rateType: 'FLOATING', effectiveTo: null } } };
    }

    const floatingLoans = await this.prisma.loan.findMany({
      where,
      include: {
        schedules: { where: { status: 'PENDING' }, orderBy: { installmentNumber: 'asc' } },
      },
    });

    if (floatingLoans.length === 0) {
      return {
        benchmark: benchmark ?? 'ALL',
        benchmarkChangeBps,
        affectedLoans: 0,
        totalOutstandingPaisa: 0,
        annualInterestImpactPaisa: 0,
        annualInterestImpactRupees: 0,
        nimImpactBps: 0,
      };
    }

    let totalOutstanding = 0;
    let annualInterestImpact = 0;

    for (const loan of floatingLoans) {
      totalOutstanding += loan.outstandingPrincipalPaisa;
      // Annual interest impact = outstanding * rate change / 10000
      annualInterestImpact +=
        (loan.outstandingPrincipalPaisa * benchmarkChangeBps) / 10000;
    }

    // NIM impact = annualInterestImpact / totalOutstanding * 10000 (in bps)
    const nimImpactBps = totalOutstanding > 0
      ? (annualInterestImpact / totalOutstanding) * 10000
      : 0;

    return {
      benchmark: benchmark ?? 'ALL',
      benchmarkChangeBps,
      affectedLoans: floatingLoans.length,
      totalOutstandingPaisa: totalOutstanding,
      annualInterestImpactPaisa: Math.round(annualInterestImpact),
      annualInterestImpactRupees: Math.round(annualInterestImpact) / 100,
      nimImpactBps: Math.round(nimImpactBps * 100) / 100,
      direction: benchmarkChangeBps > 0 ? 'INCREASE' : 'DECREASE',
    };
  }
}
