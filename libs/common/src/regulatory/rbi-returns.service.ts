import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

/**
 * RBI Returns Service
 *
 * Generates NBS-1 through NBS-9 return data for submission to RBI.
 * All monetary values are in paisa unless stated.
 * NBS = Non-Banking Financial Supervision returns.
 */
@Injectable()
export class RbiReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // NBS-1: Statement of Capital Funds, Risk Assets and Risk-Adjusted Assets
  // -------------------------------------------------------------------------
  async generateNbs1(orgId: string, asOfDate: Date): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        outstandingPrincipalPaisa: true,
        npaClassification: true,
        loanStatus: true,
      },
    });

    const totalLoanAssets = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa,
      0,
    );

    const standardLoans = loans.filter(
      (l) => l.npaClassification === 'STANDARD',
    );
    const npaLoans = loans.filter((l) =>
      l.npaClassification.startsWith('NPA'),
    );
    const smaLoans = loans.filter((l) =>
      l.npaClassification.startsWith('SMA'),
    );

    return {
      returnType: 'NBS-1',
      period: asOfDate.toISOString().split('T')[0],
      organizationId: orgId,
      reportDate: new Date().toISOString(),
      assetClassification: {
        standardAssets: {
          count: standardLoans.length,
          outstandingPaisa: standardLoans.reduce(
            (s, l) => s + l.outstandingPrincipalPaisa,
            0,
          ),
        },
        smaAssets: {
          count: smaLoans.length,
          outstandingPaisa: smaLoans.reduce(
            (s, l) => s + l.outstandingPrincipalPaisa,
            0,
          ),
        },
        npaAssets: {
          count: npaLoans.length,
          outstandingPaisa: npaLoans.reduce(
            (s, l) => s + l.outstandingPrincipalPaisa,
            0,
          ),
        },
        totalAssets: {
          count: loans.length,
          outstandingPaisa: totalLoanAssets,
        },
      },
      note: 'Capital Funds data requires manual input from Balance Sheet.',
    };
  }

  // -------------------------------------------------------------------------
  // NBS-2: Profitability
  // -------------------------------------------------------------------------
  async generateNbs2(orgId: string, fromDate: Date, toDate: Date): Promise<object> {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: orgId,
        paymentDate: { gte: fromDate, lte: toDate },
        status: 'SUCCESS',
      },
      select: {
        allocatedToInterestPaisa: true,
        allocatedToPenalPaisa: true,
        amountPaisa: true,
      },
    });

    const totalInterestIncome = payments.reduce(
      (s, p) => s + p.allocatedToInterestPaisa + p.allocatedToPenalPaisa,
      0,
    );
    const totalCollections = payments.reduce((s, p) => s + p.amountPaisa, 0);

    return {
      returnType: 'NBS-2',
      period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      organizationId: orgId,
      profitability: {
        interestIncomePaisa: totalInterestIncome,
        totalCollectionsPaisa: totalCollections,
        note: 'Operating expenses, provisioning, and tax data require manual GL input.',
      },
    };
  }

  // -------------------------------------------------------------------------
  // NBS-3: Asset Liability Management (Maturity Profile)
  // -------------------------------------------------------------------------
  async generateNbs3(orgId: string, asOfDate: Date): Promise<object> {
    const schedules = await this.prisma.loanSchedule.findMany({
      where: {
        loan: { organizationId: orgId },
        dueDate: { gte: asOfDate },
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: {
        dueDate: true,
        emiAmountPaisa: true,
        principalComponentPaisa: true,
        interestComponentPaisa: true,
      },
    });

    // Bucket by maturity bands
    const now = asOfDate.getTime();
    const buckets = {
      upto1Month: { principal: 0, interest: 0, count: 0 },
      '1to3Months': { principal: 0, interest: 0, count: 0 },
      '3to6Months': { principal: 0, interest: 0, count: 0 },
      '6to12Months': { principal: 0, interest: 0, count: 0 },
      '1to3Years': { principal: 0, interest: 0, count: 0 },
      above3Years: { principal: 0, interest: 0, count: 0 },
    };

    for (const s of schedules) {
      const daysToMaturity =
        (new Date(s.dueDate).getTime() - now) / (1000 * 60 * 60 * 24);

      let bucket: keyof typeof buckets;
      if (daysToMaturity <= 30) bucket = 'upto1Month';
      else if (daysToMaturity <= 90) bucket = '1to3Months';
      else if (daysToMaturity <= 180) bucket = '3to6Months';
      else if (daysToMaturity <= 365) bucket = '6to12Months';
      else if (daysToMaturity <= 1095) bucket = '1to3Years';
      else bucket = 'above3Years';

      buckets[bucket].principal += s.principalComponentPaisa;
      buckets[bucket].interest += s.interestComponentPaisa;
      buckets[bucket].count += 1;
    }

    return {
      returnType: 'NBS-3',
      asOfDate: asOfDate.toISOString().split('T')[0],
      organizationId: orgId,
      maturityProfile: buckets,
    };
  }

  // -------------------------------------------------------------------------
  // NBS-4: Exposure to Sensitive Sectors
  // -------------------------------------------------------------------------
  async generateNbs4(orgId: string): Promise<object> {
    const products = await this.prisma.loanProduct.findMany({
      where: { organizationId: orgId },
      select: { id: true, productType: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.productType]));

    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        productId: true,
        outstandingPrincipalPaisa: true,
        disbursedAmountPaisa: true,
      },
    });

    const sectorExposure: Record<string, { count: number; outstandingPaisa: number; disbursedPaisa: number }> = {};

    for (const loan of loans) {
      const sector = productMap.get(loan.productId) ?? 'OTHER';
      if (!sectorExposure[sector]) {
        sectorExposure[sector] = { count: 0, outstandingPaisa: 0, disbursedPaisa: 0 };
      }
      sectorExposure[sector].count += 1;
      sectorExposure[sector].outstandingPaisa += loan.outstandingPrincipalPaisa;
      sectorExposure[sector].disbursedPaisa += loan.disbursedAmountPaisa;
    }

    return {
      returnType: 'NBS-4',
      organizationId: orgId,
      reportDate: new Date().toISOString().split('T')[0],
      sectorWiseExposure: sectorExposure,
    };
  }

  // -------------------------------------------------------------------------
  // NBS-5: Half-Yearly Return on Deposits
  // -------------------------------------------------------------------------
  async generateNbs5(orgId: string): Promise<object> {
    return {
      returnType: 'NBS-5',
      organizationId: orgId,
      note: 'NBS-5 applies to deposit-accepting NBFCs. This entity does not accept public deposits.',
      depositData: {
        totalDepositsAccepted: 0,
        depositorsCount: 0,
        interestPayablePaisa: 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // NBS-6: Monthly Return on Liquid Assets
  // -------------------------------------------------------------------------
  async generateNbs6(orgId: string, month: string): Promise<object> {
    return {
      returnType: 'NBS-6',
      organizationId: orgId,
      month,
      liquidAssets: {
        note: 'SLR/liquid asset data requires integration with treasury/investment module.',
        bankBalancePaisa: 0,
        governmentSecuritiesPaisa: 0,
        totalLiquidAssetsPaisa: 0,
        requiredLiquidAssetPercent: 15,
        actualLiquidAssetPercent: 0,
        isCompliant: false,
      },
    };
  }

  // -------------------------------------------------------------------------
  // NBS-7: Quarterly Statement of Capital Funds
  // -------------------------------------------------------------------------
  async generateNbs7(orgId: string, quarter: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: { outstandingPrincipalPaisa: true, npaClassification: true },
    });

    const totalOutstanding = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa,
      0,
    );

    return {
      returnType: 'NBS-7',
      organizationId: orgId,
      quarter,
      capitalFunds: {
        note: 'Tier 1 and Tier 2 capital data require manual input from audited accounts.',
        totalLoanPortfolioPaisa: totalOutstanding,
        totalLoansCount: loans.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // NBS-8: Annual Return on CRAR
  // -------------------------------------------------------------------------
  async generateNbs8(orgId: string, financialYear: string): Promise<object> {
    return {
      returnType: 'NBS-8',
      organizationId: orgId,
      financialYear,
      crarData: {
        note: 'Full CRAR computation available via CrarService.computeCrar()',
        requiredCrarPercent: 15,
      },
    };
  }

  // -------------------------------------------------------------------------
  // NBS-9: Annual Return on Frauds
  // -------------------------------------------------------------------------
  async generateNbs9(orgId: string, financialYear: string): Promise<object> {
    return {
      returnType: 'NBS-9',
      organizationId: orgId,
      financialYear,
      fraudData: {
        fraudCasesReported: 0,
        fraudAmountInvolvedPaisa: 0,
        recoveredAmountPaisa: 0,
        pendingCases: 0,
        note: 'Fraud cases should be recorded in the fraud incident management system.',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Connected Lending (RBI Master Direction requirement)
  // -------------------------------------------------------------------------
  async generateConnectedLendingReport(orgId: string): Promise<object> {
    // Connected parties: loans to directors, relatives, group companies
    return {
      reportType: 'CONNECTED_LENDING',
      organizationId: orgId,
      reportDate: new Date().toISOString().split('T')[0],
      connectedParties: [],
      totalExposurePaisa: 0,
      maxAllowedPercentOfCapital: 15,
      note: 'Connected party data requires manual configuration of related party registry.',
    };
  }

  // -------------------------------------------------------------------------
  // Provisioning Summary
  // -------------------------------------------------------------------------
  async generateProvisioningSummary(orgId: string): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: { organizationId: orgId },
      select: {
        npaClassification: true,
        outstandingPrincipalPaisa: true,
      },
    });

    // RBI prescribed provisioning rates
    const PROVISION_RATES: Record<string, number> = {
      STANDARD: 0.004,           // 0.4% on standard assets
      SMA_0: 0.004,
      SMA_1: 0.004,
      SMA_2: 0.004,
      NPA_SUBSTANDARD: 0.15,     // 15%
      NPA_DOUBTFUL_1: 0.25,      // 25%
      NPA_DOUBTFUL_2: 0.40,      // 40%
      NPA_DOUBTFUL_3: 1.00,      // 100%
      NPA_LOSS: 1.00,            // 100%
    };

    const summary: Record<string, { count: number; outstandingPaisa: number; provisionPaisa: number; provisionRate: number }> = {};

    for (const loan of loans) {
      const cls = loan.npaClassification;
      const rate = PROVISION_RATES[cls] ?? 0;

      if (!summary[cls]) {
        summary[cls] = { count: 0, outstandingPaisa: 0, provisionPaisa: 0, provisionRate: rate };
      }
      summary[cls].count += 1;
      summary[cls].outstandingPaisa += loan.outstandingPrincipalPaisa;
      summary[cls].provisionPaisa += Math.round(
        loan.outstandingPrincipalPaisa * rate,
      );
    }

    const totalProvision = Object.values(summary).reduce(
      (s, v) => s + v.provisionPaisa,
      0,
    );

    return {
      reportType: 'PROVISIONING_SUMMARY',
      organizationId: orgId,
      reportDate: new Date().toISOString().split('T')[0],
      classificationSummary: summary,
      totalProvisionRequiredPaisa: totalProvision,
    };
  }
}
