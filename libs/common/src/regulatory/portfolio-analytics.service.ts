import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

/**
 * Portfolio Analytics Service
 *
 * Provides advanced portfolio analytics:
 *  1. Vintage Analysis — performance by disbursement month cohort
 *  2. Roll-Rate Analysis — transition between DPD buckets month-over-month
 *  3. Cohort Analysis — loan performance grouped by origination period
 *  4. Concentration Risk — exposure concentration by geography, product, borrower
 */

type DpdBucket =
  | 'CURRENT'
  | 'DPD_1_29'
  | 'DPD_30_59'
  | 'DPD_60_89'
  | 'DPD_90_179'
  | 'DPD_180_PLUS';

function classifyDpdBucket(dpd: number): DpdBucket {
  if (dpd === 0) return 'CURRENT';
  if (dpd <= 29) return 'DPD_1_29';
  if (dpd <= 59) return 'DPD_30_59';
  if (dpd <= 89) return 'DPD_60_89';
  if (dpd <= 179) return 'DPD_90_179';
  return 'DPD_180_PLUS';
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class PortfolioAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // 1. Vintage Analysis
  //    Groups loans by disbursement month and tracks NPA/delinquency evolution
  // -------------------------------------------------------------------------
  async vintageAnalysis(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        disbursementDate: true,
        disbursedAmountPaisa: true,
        outstandingPrincipalPaisa: true,
        dpd: true,
        npaClassification: true,
        loanStatus: true,
        product: { select: { productType: true } },
      },
      orderBy: { disbursementDate: 'asc' },
    });

    // Group by disbursement month
    const vintageMap = new Map<
      string,
      {
        month: string;
        disbursedCount: number;
        disbursedPaisa: number;
        outstandingPaisa: number;
        npaCount: number;
        npaPaisa: number;
        closedCount: number;
        avgDpd: number;
        dpdDistribution: Record<DpdBucket, number>;
      }
    >();

    for (const loan of loans) {
      const month = getMonthKey(new Date(loan.disbursementDate));

      if (!vintageMap.has(month)) {
        vintageMap.set(month, {
          month,
          disbursedCount: 0,
          disbursedPaisa: 0,
          outstandingPaisa: 0,
          npaCount: 0,
          npaPaisa: 0,
          closedCount: 0,
          avgDpd: 0,
          dpdDistribution: {
            CURRENT: 0,
            DPD_1_29: 0,
            DPD_30_59: 0,
            DPD_60_89: 0,
            DPD_90_179: 0,
            DPD_180_PLUS: 0,
          },
        });
      }

      const v = vintageMap.get(month)!;
      v.disbursedCount += 1;
      v.disbursedPaisa += loan.disbursedAmountPaisa;
      v.outstandingPaisa += loan.outstandingPrincipalPaisa;

      if (loan.npaClassification.startsWith('NPA')) {
        v.npaCount += 1;
        v.npaPaisa += loan.outstandingPrincipalPaisa;
      }

      if (loan.loanStatus === 'CLOSED' || loan.loanStatus === 'FORECLOSED') {
        v.closedCount += 1;
      }

      const bucket = classifyDpdBucket(loan.dpd);
      v.dpdDistribution[bucket] += 1;
    }

    // Compute NPA rate per vintage
    const vintages = Array.from(vintageMap.values()).map((v) => ({
      ...v,
      npaRatePercent:
        v.disbursedPaisa > 0
          ? parseFloat(((v.npaPaisa / v.disbursedPaisa) * 100).toFixed(2))
          : 0,
      closureRatePercent:
        v.disbursedCount > 0
          ? parseFloat(((v.closedCount / v.disbursedCount) * 100).toFixed(2))
          : 0,
      outstandingToDisburseRatio:
        v.disbursedPaisa > 0
          ? parseFloat((v.outstandingPaisa / v.disbursedPaisa).toFixed(4))
          : 0,
    }));

    return {
      reportType: 'VINTAGE_ANALYSIS',
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      totalVintages: vintages.length,
      vintages,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Roll-Rate Analysis
  //    Transition matrix: how loans move between DPD buckets
  //    (Snapshot-based approximation using current DPD vs NPA classification)
  // -------------------------------------------------------------------------
  async rollRateAnalysis(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        dpd: true,
        npaClassification: true,
        outstandingPrincipalPaisa: true,
      },
    });

    const buckets: DpdBucket[] = [
      'CURRENT',
      'DPD_1_29',
      'DPD_30_59',
      'DPD_60_89',
      'DPD_90_179',
      'DPD_180_PLUS',
    ];

    // Current distribution
    const currentDistribution: Record<DpdBucket, { count: number; outstandingPaisa: number }> = {
      CURRENT: { count: 0, outstandingPaisa: 0 },
      DPD_1_29: { count: 0, outstandingPaisa: 0 },
      DPD_30_59: { count: 0, outstandingPaisa: 0 },
      DPD_60_89: { count: 0, outstandingPaisa: 0 },
      DPD_90_179: { count: 0, outstandingPaisa: 0 },
      DPD_180_PLUS: { count: 0, outstandingPaisa: 0 },
    };

    for (const loan of loans) {
      const bucket = classifyDpdBucket(loan.dpd);
      currentDistribution[bucket].count += 1;
      currentDistribution[bucket].outstandingPaisa += loan.outstandingPrincipalPaisa;
    }

    const totalLoans = loans.length;
    const totalOutstanding = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa,
      0,
    );

    // Distribution with percentages
    const distribution = buckets.map((b) => ({
      bucket: b,
      count: currentDistribution[b].count,
      countPercent:
        totalLoans > 0
          ? parseFloat(
              ((currentDistribution[b].count / totalLoans) * 100).toFixed(2),
            )
          : 0,
      outstandingPaisa: currentDistribution[b].outstandingPaisa,
      outstandingPercent:
        totalOutstanding > 0
          ? parseFloat(
              (
                (currentDistribution[b].outstandingPaisa / totalOutstanding) *
                100
              ).toFixed(2),
            )
          : 0,
    }));

    // Illustrative roll-rate matrix (requires historical snapshot data in production)
    const rollRateMatrix: Record<string, Record<string, string>> = {};
    for (const fromBucket of buckets) {
      rollRateMatrix[fromBucket] = {};
      for (const toBucket of buckets) {
        // Simplified: loans tend to cure (move to better bucket) or deteriorate
        rollRateMatrix[fromBucket][toBucket] = 'N/A — requires month-on-month snapshot';
      }
    }

    return {
      reportType: 'ROLL_RATE_ANALYSIS',
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      totalLoansCount: totalLoans,
      totalOutstandingPaisa: totalOutstanding,
      currentDpdDistribution: distribution,
      rollRateMatrix,
      note: 'Full roll-rate transition matrix requires monthly portfolio snapshots stored historically.',
    };
  }

  // -------------------------------------------------------------------------
  // 3. Cohort Analysis
  //    Tracks repayment behavior by origination cohort (quarterly)
  // -------------------------------------------------------------------------
  async cohortAnalysis(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        disbursementDate: true,
        disbursedAmountPaisa: true,
        tenureMonths: true,
        dpd: true,
        loanStatus: true,
        schedules: {
          select: {
            status: true,
            paidAmountPaisa: true,
            emiAmountPaisa: true,
          },
        },
      },
    });

    // Group by quarter of disbursement
    const cohortMap = new Map<
      string,
      {
        quarter: string;
        count: number;
        disbursedPaisa: number;
        avgTenureMonths: number;
        scheduledCollectionPaisa: number;
        actualCollectionPaisa: number;
        paidInstallments: number;
        overdueInstallments: number;
        activeCount: number;
        closedCount: number;
        npaCount: number;
      }
    >();

    for (const loan of loans) {
      const d = new Date(loan.disbursementDate);
      const quarter = `Q${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}`;

      if (!cohortMap.has(quarter)) {
        cohortMap.set(quarter, {
          quarter,
          count: 0,
          disbursedPaisa: 0,
          avgTenureMonths: 0,
          scheduledCollectionPaisa: 0,
          actualCollectionPaisa: 0,
          paidInstallments: 0,
          overdueInstallments: 0,
          activeCount: 0,
          closedCount: 0,
          npaCount: 0,
        });
      }

      const c = cohortMap.get(quarter)!;
      c.count += 1;
      c.disbursedPaisa += loan.disbursedAmountPaisa;
      c.avgTenureMonths =
        (c.avgTenureMonths * (c.count - 1) + loan.tenureMonths) / c.count;

      for (const s of loan.schedules) {
        c.scheduledCollectionPaisa += s.emiAmountPaisa;
        c.actualCollectionPaisa += s.paidAmountPaisa;
        if (s.status === 'PAID') c.paidInstallments += 1;
        if (s.status === 'OVERDUE') c.overdueInstallments += 1;
      }

      if (loan.loanStatus === 'ACTIVE') c.activeCount += 1;
      if (loan.loanStatus === 'CLOSED' || loan.loanStatus === 'FORECLOSED') {
        c.closedCount += 1;
      }
      if (loan.dpd >= 90) c.npaCount += 1;
    }

    const cohorts = Array.from(cohortMap.values())
      .sort((a, b) => a.quarter.localeCompare(b.quarter))
      .map((c) => ({
        ...c,
        avgTenureMonths: parseFloat(c.avgTenureMonths.toFixed(1)),
        collectionEfficiencyPercent:
          c.scheduledCollectionPaisa > 0
            ? parseFloat(
                (
                  (c.actualCollectionPaisa / c.scheduledCollectionPaisa) *
                  100
                ).toFixed(2),
              )
            : 0,
        npaRatePercent:
          c.count > 0
            ? parseFloat(((c.npaCount / c.count) * 100).toFixed(2))
            : 0,
      }));

    return {
      reportType: 'COHORT_ANALYSIS',
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      totalCohorts: cohorts.length,
      cohorts,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Concentration Risk
  //    Tracks exposure concentration by geography, product, borrower
  // -------------------------------------------------------------------------
  async concentrationRisk(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        outstandingPrincipalPaisa: true,
        disbursedAmountPaisa: true,
        customerId: true,
        product: { select: { productType: true } },
        branch: { select: { state: true, city: true } },
      },
    });

    const totalOutstanding = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa,
      0,
    );

    // Product concentration
    const productConcentration: Record<string, { count: number; outstandingPaisa: number; sharePercent: number }> = {};
    for (const loan of loans) {
      const pt = loan.product.productType;
      if (!productConcentration[pt]) {
        productConcentration[pt] = { count: 0, outstandingPaisa: 0, sharePercent: 0 };
      }
      productConcentration[pt].count += 1;
      productConcentration[pt].outstandingPaisa += loan.outstandingPrincipalPaisa;
    }
    for (const pt of Object.keys(productConcentration)) {
      productConcentration[pt].sharePercent =
        totalOutstanding > 0
          ? parseFloat(
              (
                (productConcentration[pt].outstandingPaisa / totalOutstanding) *
                100
              ).toFixed(2),
            )
          : 0;
    }

    // Geographic concentration (state-level)
    const geographicConcentration: Record<string, { count: number; outstandingPaisa: number; sharePercent: number }> = {};
    for (const loan of loans) {
      const state = loan.branch.state;
      if (!geographicConcentration[state]) {
        geographicConcentration[state] = { count: 0, outstandingPaisa: 0, sharePercent: 0 };
      }
      geographicConcentration[state].count += 1;
      geographicConcentration[state].outstandingPaisa += loan.outstandingPrincipalPaisa;
    }
    for (const state of Object.keys(geographicConcentration)) {
      geographicConcentration[state].sharePercent =
        totalOutstanding > 0
          ? parseFloat(
              (
                (geographicConcentration[state].outstandingPaisa /
                  totalOutstanding) *
                100
              ).toFixed(2),
            )
          : 0;
    }

    // Borrower concentration: top 20 borrowers by outstanding
    const borrowerConcentration: Record<string, number> = {};
    for (const loan of loans) {
      const cid = loan.customerId;
      borrowerConcentration[cid] =
        (borrowerConcentration[cid] ?? 0) + loan.outstandingPrincipalPaisa;
    }
    const top20Borrowers = Object.entries(borrowerConcentration)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([customerId, outstandingPaisa]) => ({
        customerId,
        outstandingPaisa,
        sharePercent:
          totalOutstanding > 0
            ? parseFloat(((outstandingPaisa / totalOutstanding) * 100).toFixed(2))
            : 0,
      }));

    const top20OutstandingPaisa = top20Borrowers.reduce(
      (s, b) => s + b.outstandingPaisa,
      0,
    );

    // RBI single borrower limit: 10% of Owned Funds; Group: 15%
    return {
      reportType: 'CONCENTRATION_RISK',
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      portfolioTotal: {
        loansCount: loans.length,
        outstandingPaisa: totalOutstanding,
      },
      productConcentration,
      geographicConcentration,
      borrowerConcentration: {
        top20Borrowers,
        top20SharePercent:
          totalOutstanding > 0
            ? parseFloat(
                ((top20OutstandingPaisa / totalOutstanding) * 100).toFixed(2),
              )
            : 0,
        herfindahlHirschmanIndex: this.computeHHI(
          Object.values(borrowerConcentration),
          totalOutstanding,
        ),
      },
      regualtoryLimits: {
        singleBorrowerLimitNote:
          'Single borrower: 10% of Owned Funds; Group borrower: 15% of Owned Funds',
        requiresCapitalDataForFullAssessment: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private: Herfindahl-Hirschman Index for concentration measurement
  // HHI ranges from 0 (perfect distribution) to 10000 (monopoly)
  // -------------------------------------------------------------------------
  private computeHHI(values: number[], total: number): number {
    if (total === 0) return 0;
    const hhi = values.reduce((s, v) => {
      const share = (v / total) * 100;
      return s + share * share;
    }, 0);
    return parseFloat(hhi.toFixed(2));
  }
}
