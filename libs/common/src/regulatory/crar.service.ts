import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

/**
 * CRAR (Capital to Risk-Weighted Assets Ratio) Computation Service
 *
 * Formula: CRAR = (Tier 1 Capital + Tier 2 Capital) / Risk-Weighted Assets * 100
 * Minimum CRAR for Middle-Layer NBFCs: 15% (per RBI Scale-Based Regulation)
 * Minimum CRAR for Upper-Layer NBFCs: 15%
 * Minimum CRAR for Base-Layer NBFCs: No mandatory requirement but 10% recommended
 *
 * Risk Weight Categories (RBI Prescribed):
 *   - Cash & Bank Balances: 0%
 *   - Government Securities: 0%
 *   - Loans to Individuals (Standard): 100%
 *   - Loans against Gold: 75%
 *   - Housing Loans (LTV < 75%): 50%
 *   - NPA (Substandard): 150%
 *   - NPA (Doubtful/Loss): 200%
 */

// Risk weight multipliers by asset classification
const RISK_WEIGHTS: Record<string, number> = {
  STANDARD: 1.00,         // 100%
  SMA_0: 1.00,
  SMA_1: 1.00,
  SMA_2: 1.00,
  NPA_SUBSTANDARD: 1.50,  // 150%
  NPA_DOUBTFUL_1: 2.00,   // 200%
  NPA_DOUBTFUL_2: 2.00,
  NPA_DOUBTFUL_3: 2.00,
  NPA_LOSS: 2.00,
};

// Product-specific risk weight overrides
const PRODUCT_RISK_WEIGHTS: Record<string, number> = {
  GOLD_LOAN: 0.75,          // 75%
  HOME_LOAN: 0.50,          // 50% for eligible housing loans
  MICROFINANCE: 0.75,       // 75%
  PERSONAL_LOAN: 1.00,
  BUSINESS_LOAN: 1.00,
  VEHICLE_FINANCE: 1.00,
  LAP: 1.00,
  EDUCATION_LOAN: 1.00,
  MSME_LOAN: 0.75,          // 75% for MSME (reduced risk weight under Priority Sector)
  SUPPLY_CHAIN_FINANCE: 1.00,
};

interface CrarInput {
  tier1CapitalPaisa: number;
  tier2CapitalPaisa: number;
}

@Injectable()
export class CrarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute CRAR for an organization.
   * Capital amounts must be provided (from audited balance sheet).
   * RWA is computed from loan portfolio.
   */
  async computeCrar(orgId: string, capitalInput: CrarInput): Promise<object> {
    const { tier1CapitalPaisa, tier2CapitalPaisa } = capitalInput;

    // Fetch all active loans with their product types
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        outstandingPrincipalPaisa: true,
        npaClassification: true,
        product: {
          select: { productType: true },
        },
      },
    });

    // Compute Risk-Weighted Assets
    let totalRwa = 0;
    const rwaBreakdown: Array<{
      loanId: string;
      outstandingPaisa: number;
      classification: string;
      productType: string;
      creditRiskWeight: number;
      riskWeightedAmountPaisa: number;
    }> = [];

    for (const loan of loans) {
      const classificationWeight = RISK_WEIGHTS[loan.npaClassification] ?? 1.0;
      const productWeight =
        PRODUCT_RISK_WEIGHTS[loan.product.productType] ?? 1.0;

      // Use the higher of classification weight or product weight for NPAs,
      // product weight for standard assets
      const effectiveWeight =
        loan.npaClassification === 'STANDARD' ||
        loan.npaClassification.startsWith('SMA')
          ? productWeight
          : Math.max(classificationWeight, productWeight);

      const rwa = Math.round(loan.outstandingPrincipalPaisa * effectiveWeight);
      totalRwa += rwa;

      rwaBreakdown.push({
        loanId: loan.id,
        outstandingPaisa: loan.outstandingPrincipalPaisa,
        classification: loan.npaClassification,
        productType: loan.product.productType,
        creditRiskWeight: effectiveWeight,
        riskWeightedAmountPaisa: rwa,
      });
    }

    // Tier 2 capital is capped at 100% of Tier 1
    const admissibleTier2 = Math.min(tier2CapitalPaisa, tier1CapitalPaisa);
    const totalCapital = tier1CapitalPaisa + admissibleTier2;

    // CRAR Calculation
    const crarPercent =
      totalRwa > 0 ? (totalCapital / totalRwa) * 100 : 0;

    const tier1CrarPercent =
      totalRwa > 0 ? (tier1CapitalPaisa / totalRwa) * 100 : 0;

    const MINIMUM_CRAR = 15; // % for Middle-Layer NBFCs
    const isCompliant = crarPercent >= MINIMUM_CRAR;

    // Classify loans for summary
    const classificationSummary = loans.reduce<Record<string, { count: number; outstandingPaisa: number; rwaContributionPaisa: number }>>(
      (acc, loan) => {
        const cls = loan.npaClassification;
        if (!acc[cls]) {
          acc[cls] = { count: 0, outstandingPaisa: 0, rwaContributionPaisa: 0 };
        }
        acc[cls].count += 1;
        acc[cls].outstandingPaisa += loan.outstandingPrincipalPaisa;
        const rwaEntry = rwaBreakdown.find((r) => r.loanId === loan.id);
        acc[cls].rwaContributionPaisa += rwaEntry?.riskWeightedAmountPaisa ?? 0;
        return acc;
      },
      {},
    );

    return {
      reportType: 'CRAR_COMPUTATION',
      organizationId: orgId,
      computedAt: new Date().toISOString(),
      capitalStructure: {
        tier1CapitalPaisa,
        tier2CapitalPaisa,
        admissibleTier2CapitalPaisa: admissibleTier2,
        totalEligibleCapitalPaisa: totalCapital,
        note: 'Tier 2 is capped at 100% of Tier 1 per RBI guidelines.',
      },
      riskWeightedAssets: {
        totalRwaPaisa: totalRwa,
        loanPortfolioRwaPaisa: totalRwa,
        operationalRiskRwaPaisa: 0,
        marketRiskRwaPaisa: 0,
        note: 'Operational and market risk RWA require additional inputs.',
      },
      crarRatios: {
        crarPercent: parseFloat(crarPercent.toFixed(2)),
        tier1CrarPercent: parseFloat(tier1CrarPercent.toFixed(2)),
        minimumRequiredPercent: MINIMUM_CRAR,
        isCompliant,
        surplus: isCompliant
          ? parseFloat((crarPercent - MINIMUM_CRAR).toFixed(2))
          : null,
        shortfall: !isCompliant
          ? parseFloat((MINIMUM_CRAR - crarPercent).toFixed(2))
          : null,
        complianceStatus: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
      },
      portfolioSummary: {
        totalLoansCount: loans.length,
        totalOutstandingPaisa: loans.reduce(
          (s, l) => s + l.outstandingPrincipalPaisa,
          0,
        ),
        classificationBreakdown: classificationSummary,
      },
      rwaBreakdownSample: rwaBreakdown.slice(0, 10), // Return first 10 for review
    };
  }

  /**
   * Compute the additional capital required to achieve target CRAR.
   */
  async computeCapitalRequirement(
    orgId: string,
    currentCapitalInput: CrarInput,
    targetCrarPercent = 15,
  ): Promise<object> {
    const crarResult = (await this.computeCrar(
      orgId,
      currentCapitalInput,
    )) as Record<string, any>;

    const currentCrar = crarResult['crarRatios']['crarPercent'] as number;
    const totalRwa = crarResult['riskWeightedAssets']['totalRwaPaisa'] as number;
    const currentCapital =
      crarResult['capitalStructure']['totalEligibleCapitalPaisa'] as number;

    const requiredCapital = Math.round((targetCrarPercent / 100) * totalRwa);
    const additionalCapitalRequired = Math.max(0, requiredCapital - currentCapital);

    return {
      reportType: 'CAPITAL_REQUIREMENT_ANALYSIS',
      organizationId: orgId,
      currentCrarPercent: currentCrar,
      targetCrarPercent,
      totalRwaPaisa: totalRwa,
      currentCapitalPaisa: currentCapital,
      requiredCapitalPaisa: requiredCapital,
      additionalCapitalRequiredPaisa: additionalCapitalRequired,
      isAdditionalCapitalNeeded: additionalCapitalRequired > 0,
    };
  }
}
