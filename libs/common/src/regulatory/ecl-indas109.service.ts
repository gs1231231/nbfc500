import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

/**
 * ECL (Expected Credit Loss) Computation — Ind AS 109 / IFRS 9
 *
 * Stage Classification:
 *   Stage 1 — Performing assets (DPD 0-29 days): 12-month ECL
 *   Stage 2 — Significant Increase in Credit Risk (DPD 30-89 days or SMA): Lifetime ECL
 *   Stage 3 — Credit-Impaired / NPA (DPD 90+ days): Lifetime ECL
 *
 * ECL Formula: ECL = PD × LGD × EAD
 *   PD  = Probability of Default
 *   LGD = Loss Given Default
 *   EAD = Exposure at Default (outstanding principal + interest)
 *
 * PD/LGD matrices below are illustrative — production systems use
 * statistically derived matrices from historical loss data.
 */

// PD (Probability of Default) by stage — annualized
const PD_MATRIX: Record<string, number> = {
  STAGE_1: 0.01,   // 1% — 12-month PD
  STAGE_2: 0.12,   // 12% — Lifetime PD
  STAGE_3: 0.75,   // 75% — Lifetime PD (already impaired)
};

// LGD (Loss Given Default) by product type
const LGD_MATRIX: Record<string, number> = {
  PERSONAL_LOAN: 0.65,        // 65% — unsecured
  BUSINESS_LOAN: 0.55,        // 55%
  VEHICLE_FINANCE: 0.35,      // 35% — secured by vehicle
  LAP: 0.25,                  // 25% — secured by property
  HOME_LOAN: 0.20,            // 20% — secured by property, priority recovery
  GOLD_LOAN: 0.15,            // 15% — liquid collateral
  EDUCATION_LOAN: 0.60,       // 60%
  MSME_LOAN: 0.55,            // 55%
  SUPPLY_CHAIN_FINANCE: 0.45, // 45%
  MICROFINANCE: 0.70,         // 70% — unsecured group lending
};

// EIR (Effective Interest Rate) factor for present-value discounting (simplified)
const DISCOUNT_RATE = 0.12; // 12% per annum

interface EclLoan {
  id: string;
  loanNumber: string;
  dpd: number;
  npaClassification: string;
  productType: string;
  outstandingPrincipalPaisa: number;
  outstandingInterestPaisa: number;
  tenureMonths: number;
}

interface EclResult {
  loanId: string;
  loanNumber: string;
  stage: string;
  dpd: number;
  npaClassification: string;
  productType: string;
  eadPaisa: number;
  pd: number;
  lgd: number;
  eclPaisa: number;
  discountFactor: number;
  discountedEclPaisa: number;
  stagingReason: string;
}

@Injectable()
export class EclIndas109Service {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute ECL provision for entire loan portfolio of an organization.
   */
  async computeEcl(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        loanNumber: true,
        dpd: true,
        npaClassification: true,
        outstandingPrincipalPaisa: true,
        outstandingInterestPaisa: true,
        tenureMonths: true,
        product: { select: { productType: true } },
      },
    });

    const eclResults: EclResult[] = [];

    for (const loan of loans) {
      const result = this.computeLoanEcl({
        id: loan.id,
        loanNumber: loan.loanNumber,
        dpd: loan.dpd,
        npaClassification: loan.npaClassification,
        productType: loan.product.productType,
        outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
        outstandingInterestPaisa: loan.outstandingInterestPaisa,
        tenureMonths: loan.tenureMonths,
      });
      eclResults.push(result);
    }

    // Aggregate by stage
    const stageSummary = this.aggregateByStage(eclResults);

    const totalEcl = eclResults.reduce((s, r) => s + r.discountedEclPaisa, 0);
    const totalEad = eclResults.reduce((s, r) => s + r.eadPaisa, 0);

    return {
      reportType: 'ECL_COMPUTATION_IND_AS_109',
      organizationId: orgId,
      computedAt: new Date().toISOString(),
      methodology: {
        standard: 'Ind AS 109 / IFRS 9',
        approach: 'Simplified Approach — PD/LGD Matrix',
        stageDefinition: {
          stage1: 'DPD 0-29: Performing (12-month ECL)',
          stage2: 'DPD 30-89 or SMA: Significant Credit Risk Increase (Lifetime ECL)',
          stage3: 'DPD 90+ or NPA: Credit-Impaired (Lifetime ECL)',
        },
        discountRate: `${DISCOUNT_RATE * 100}% (approximated from portfolio average EIR)`,
        note: 'PD/LGD matrices are illustrative. Production use requires statistically calibrated models.',
      },
      portfolioSummary: {
        totalLoansCount: loans.length,
        totalEadPaisa: totalEad,
        totalEclProvisionPaisa: totalEcl,
        eclAsCoveragePercent:
          totalEad > 0
            ? parseFloat(((totalEcl / totalEad) * 100).toFixed(2))
            : 0,
      },
      stagingSummary: stageSummary,
      loanLevelResults: eclResults,
    };
  }

  /**
   * Stage a single loan based on DPD and NPA classification.
   */
  private classifyStage(dpd: number, npaClassification: string): { stage: string; reason: string } {
    if (
      npaClassification.startsWith('NPA') ||
      dpd >= 90
    ) {
      return { stage: 'STAGE_3', reason: 'Credit-impaired: NPA classification or DPD >= 90' };
    }

    if (
      npaClassification.startsWith('SMA') ||
      dpd >= 30
    ) {
      return { stage: 'STAGE_2', reason: 'Significant increase in credit risk: SMA or DPD 30-89' };
    }

    return { stage: 'STAGE_1', reason: 'Performing: DPD < 30 and Standard classification' };
  }

  /**
   * Compute ECL for a single loan.
   */
  private computeLoanEcl(loan: EclLoan): EclResult {
    const { stage, reason } = this.classifyStage(loan.dpd, loan.npaClassification);

    const ead = loan.outstandingPrincipalPaisa + loan.outstandingInterestPaisa;
    const pd = PD_MATRIX[stage] ?? 0.01;
    const lgd = LGD_MATRIX[loan.productType] ?? 0.65;

    const eclPaisa = Math.round(pd * lgd * ead);

    // Discount factor: approximate remaining tenor-based discounting
    const remainingTenorYears = Math.max(1, loan.tenureMonths / 12);
    const discountFactor =
      stage === 'STAGE_1'
        ? 1 / (1 + DISCOUNT_RATE) // 1-year for Stage 1
        : 1 / Math.pow(1 + DISCOUNT_RATE, remainingTenorYears); // Lifetime for Stage 2/3

    const discountedEclPaisa = Math.round(eclPaisa * discountFactor);

    return {
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      stage,
      dpd: loan.dpd,
      npaClassification: loan.npaClassification,
      productType: loan.productType,
      eadPaisa: ead,
      pd,
      lgd,
      eclPaisa,
      discountFactor: parseFloat(discountFactor.toFixed(4)),
      discountedEclPaisa,
      stagingReason: reason,
    };
  }

  /**
   * Aggregate ECL results by stage for summary reporting.
   */
  private aggregateByStage(results: EclResult[]): Record<string, object> {
    const stageSummary: Record<string, { count: number; eadPaisa: number; eclPaisa: number; coveragePercent: number }> = {
      STAGE_1: { count: 0, eadPaisa: 0, eclPaisa: 0, coveragePercent: 0 },
      STAGE_2: { count: 0, eadPaisa: 0, eclPaisa: 0, coveragePercent: 0 },
      STAGE_3: { count: 0, eadPaisa: 0, eclPaisa: 0, coveragePercent: 0 },
    };

    for (const r of results) {
      const s = stageSummary[r.stage];
      if (s) {
        s.count += 1;
        s.eadPaisa += r.eadPaisa;
        s.eclPaisa += r.discountedEclPaisa;
      }
    }

    // Compute coverage % per stage
    for (const stage of Object.keys(stageSummary)) {
      const s = stageSummary[stage];
      s.coveragePercent =
        s.eadPaisa > 0
          ? parseFloat(((s.eclPaisa / s.eadPaisa) * 100).toFixed(2))
          : 0;
    }

    return stageSummary;
  }
}
