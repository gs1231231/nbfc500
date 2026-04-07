/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// Use `any` casts for complex Prisma queries to avoid strict type issues
// with include/select combinations across 20 report types

// ── Common filter ─────────────────────────────────────────────────────────────

export interface ReportFilter {
  from?: string;
  to?: string;
  productId?: string;
  branchId?: string;
  dsaId?: string;
  orgId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert interest rate in BPS (basis points) to annual percentage. */
function bpsToPercent(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Portfolio Summary ─────────────────────────────────────────────────

  async portfolioSummary(filter: ReportFilter): Promise<object> {
    this.logger.log(`Portfolio summary for org ${filter.orgId}`);

    const where: any = {
      organizationId: filter.orgId,
      loanStatus: { notIn: ['CLOSED', 'CANCELLED', 'REJECTED'] },
    };
    if (filter.productId) where.productId = filter.productId;
    if (filter.branchId) where.branchId = filter.branchId;

    const loans = await this.prisma.loan.findMany({
      where,
      include: { product: { select: { name: true, productType: true } } },
    });

    const byProduct = new Map<
      string,
      { count: number; aum: number; rateBpsList: number[]; tenures: number[] }
    >();

    for (const loan of loans) {
      const key = loan.product?.name ?? 'UNKNOWN';
      const existing = byProduct.get(key) ?? { count: 0, aum: 0, rateBpsList: [], tenures: [] };
      existing.count++;
      existing.aum += loan.outstandingPrincipalPaisa;
      existing.rateBpsList.push(loan.interestRateBps);
      existing.tenures.push(loan.tenureMonths);
      byProduct.set(key, existing);
    }

    const productRows = Array.from(byProduct.entries()).map(([product, d]) => ({
      product,
      count: d.count,
      aumPaisa: d.aum,
      avgTicketPaisa: d.count > 0 ? Math.round(d.aum / d.count) : 0,
      avgRatePercent:
        d.rateBpsList.length > 0
          ? bpsToPercent(Math.round(d.rateBpsList.reduce((a, b) => a + b, 0) / d.rateBpsList.length))
          : 0,
      avgTenureMonths:
        d.tenures.length > 0
          ? Math.round(d.tenures.reduce((a, b) => a + b, 0) / d.tenures.length)
          : 0,
    }));

    return {
      reportType: 'PORTFOLIO_SUMMARY',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      totalLoans: loans.length,
      totalAumPaisa: loans.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0),
      byProduct: productRows,
    };
  }

  // ── 2. Disbursement Report ───────────────────────────────────────────────

  async disbursementReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const where: any = {
      organizationId: filter.orgId,
      disbursementDate: { gte: fromDate, lte: toDate },
    };
    if (filter.productId) where.productId = filter.productId;
    if (filter.branchId) where.branchId = filter.branchId;

    const loans = await this.prisma.loan.findMany({ where });

    const totalCount = loans.length;
    const totalAmountPaisa = loans.reduce((s, l) => s + l.disbursedAmountPaisa, 0);

    // Daily grouping
    const dailyMap = new Map<string, { count: number; amountPaisa: number }>();
    for (const loan of loans) {
      const day = loan.disbursementDate.toISOString().slice(0, 10);
      const existing = dailyMap.get(day) ?? { count: 0, amountPaisa: 0 };
      existing.count++;
      existing.amountPaisa += loan.disbursedAmountPaisa;
      dailyMap.set(day, existing);
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }));

    return {
      reportType: 'DISBURSEMENT_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      totalDisbursedCount: totalCount,
      totalDisbursedAmountPaisa: totalAmountPaisa,
      avgTicketPaisa: totalCount > 0 ? Math.round(totalAmountPaisa / totalCount) : 0,
      daily,
    };
  }

  // ── 3. Collection Report ─────────────────────────────────────────────────

  async collectionReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const schedules = await this.prisma.loanSchedule.findMany({
      where: {
        loan: { organizationId: filter.orgId },
        dueDate: { gte: fromDate, lte: toDate },
      },
    });

    const duePaisa = schedules.reduce(
      (s, sc) => s + sc.principalComponentPaisa + sc.interestComponentPaisa,
      0,
    );
    const collectedPaisa = schedules.reduce(
      (s, sc) => s + (sc.paidAmountPaisa ?? 0),
      0,
    );
    const cePercent =
      duePaisa > 0 ? Math.round((collectedPaisa / duePaisa) * 10000) / 100 : 0;

    return {
      reportType: 'COLLECTION_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      totalDuePaisa: duePaisa,
      totalCollectedPaisa: collectedPaisa,
      pendingPaisa: duePaisa - collectedPaisa,
      collectionEfficiencyPercent: cePercent,
    };
  }

  // ── 4. DPD Aging Report ──────────────────────────────────────────────────

  async dpdAgingReport(filter: ReportFilter): Promise<object> {
    const where: any = {
      organizationId: filter.orgId,
      loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
    };
    if (filter.branchId) where.branchId = filter.branchId;

    const loans = await this.prisma.loan.findMany({ where });

    const buckets = {
      current:   { label: '0 DPD',    count: 0, principalPaisa: 0 },
      dpd1_30:   { label: '1-30 DPD', count: 0, principalPaisa: 0 },
      dpd31_60:  { label: '31-60 DPD', count: 0, principalPaisa: 0 },
      dpd61_90:  { label: '61-90 DPD', count: 0, principalPaisa: 0 },
      dpd90plus: { label: '90+ DPD',  count: 0, principalPaisa: 0 },
    };

    for (const loan of loans) {
      const dpd = loan.dpd ?? 0;
      const bucket =
        dpd === 0 ? buckets.current :
        dpd <= 30 ? buckets.dpd1_30 :
        dpd <= 60 ? buckets.dpd31_60 :
        dpd <= 90 ? buckets.dpd61_90 :
                    buckets.dpd90plus;
      bucket.count++;
      bucket.principalPaisa += loan.outstandingPrincipalPaisa;
    }

    return {
      reportType: 'DPD_AGING_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      asOfDate: new Date().toISOString().slice(0, 10),
      totalLoans: loans.length,
      buckets: Object.values(buckets),
    };
  }

  // ── 5. NPA Report ────────────────────────────────────────────────────────

  async npaReport(filter: ReportFilter): Promise<object> {
    const where: any = {
      organizationId: filter.orgId,
      npaClassification: { not: 'STANDARD' },
    };
    if (filter.branchId) where.branchId = filter.branchId;

    const loans = await this.prisma.loan.findMany({ where });

    const byClassification: Record<string, { count: number; principalPaisa: number }> = {};

    for (const loan of loans) {
      const cls = loan.npaClassification;
      byClassification[cls] = byClassification[cls] ?? { count: 0, principalPaisa: 0 };
      byClassification[cls].count++;
      byClassification[cls].principalPaisa += loan.outstandingPrincipalPaisa;
    }

    return {
      reportType: 'NPA_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      asOfDate: new Date().toISOString().slice(0, 10),
      totalNpaAccounts: loans.length,
      totalNpaPaisa: loans.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0),
      byClassification: Object.entries(byClassification).map(([cls, d]) => ({
        classification: cls,
        ...d,
      })),
    };
  }

  // ── 6. Provision Report ──────────────────────────────────────────────────

  async provisionReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const glEntries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: filter.orgId,
        referenceType: 'LOAN_NPA_PROVISION',
        entryDate: { gte: fromDate, lte: toDate },
        isReversed: false,
      },
    });

    const totalProvisionCharge = glEntries
      .filter((e) => e.accountCode === '5001')
      .reduce((s, e) => s + e.debitAmountPaisa, 0);

    const totalProvisionWriteback = glEntries
      .filter((e) => e.accountCode === '4001')
      .reduce((s, e) => s + e.creditAmountPaisa, 0);

    return {
      reportType: 'PROVISION_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      provisionChargedPaisa: totalProvisionCharge,
      provisionWritebackPaisa: totalProvisionWriteback,
      netProvisionMovementPaisa: totalProvisionCharge - totalProvisionWriteback,
      entryCount: glEntries.length,
    };
  }

  // ── 7. Bounce Report ─────────────────────────────────────────────────────

  async bounceReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const bounces = await this.prisma.bounceRegister.findMany({
      where: {
        organizationId: filter.orgId,
        bounceDate: { gte: fromDate, lte: toDate },
      },
    });

    const byReason: Record<string, number> = {};
    for (const bounce of bounces) {
      byReason[bounce.returnReason] = (byReason[bounce.returnReason] ?? 0) + 1;
    }

    return {
      reportType: 'BOUNCE_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      totalBounces: bounces.length,
      totalBouncePaisa: bounces.reduce((s, b) => s + b.amountPaisa, 0),
      byReason: Object.entries(byReason).map(([reason, count]) => ({ reason, count })),
    };
  }

  // ── 8. DSA Performance ───────────────────────────────────────────────────

  async dsaPerformanceReport(filter: ReportFilter): Promise<object> {
    // DSA linkage is on LoanApplication, not Loan. We query LoanApplication.
    const where: any = { organizationId: filter.orgId, dsaId: { not: null } };
    if (filter.dsaId) where.dsaId = filter.dsaId;
    if (filter.branchId) where.branchId = filter.branchId;

    const applications = await this.prisma.loanApplication.findMany({
      where,
      include: {
        dsa: { select: { id: true, name: true } },
        loans: {
          select: {
            disbursedAmountPaisa: true,
            npaClassification: true,
          },
        },
      },
    });

    const byDsa = new Map<string, {
      dsaName: string;
      sourcedCount: number;
      disbursedCount: number;
      disbursedAmountPaisa: number;
      npaCount: number;
    }>();

    for (const app of applications) {
      if (!app.dsaId || !app.dsa) continue;
      const existing = byDsa.get(app.dsaId) ?? {
        dsaName: app.dsa.name,
        sourcedCount: 0,
        disbursedCount: 0,
        disbursedAmountPaisa: 0,
        npaCount: 0,
      };
      existing.sourcedCount++;
      for (const loan of app.loans) {
        existing.disbursedCount++;
        existing.disbursedAmountPaisa += loan.disbursedAmountPaisa;
        if (loan.npaClassification !== 'STANDARD') existing.npaCount++;
      }
      byDsa.set(app.dsaId, existing);
    }

    return {
      reportType: 'DSA_PERFORMANCE',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      dsas: Array.from(byDsa.entries()).map(([dsaId, d]) => ({
        dsaId,
        ...d,
        npaPercentage:
          d.disbursedCount > 0
            ? Math.round((d.npaCount / d.disbursedCount) * 10000) / 100
            : 0,
      })),
    };
  }

  // ── 9. Branch Performance ────────────────────────────────────────────────

  async branchPerformanceReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    const byBranch = new Map<string, {
      branchName: string;
      aumPaisa: number;
      disbursedAmountPaisa: number;
      loanCount: number;
      npaCount: number;
    }>();

    for (const loan of loans) {
      const branchId = loan.branchId ?? 'UNKNOWN';
      const existing = byBranch.get(branchId) ?? {
        branchName: loan.branch?.name ?? 'UNKNOWN',
        aumPaisa: 0,
        disbursedAmountPaisa: 0,
        loanCount: 0,
        npaCount: 0,
      };
      existing.loanCount++;
      existing.aumPaisa += loan.outstandingPrincipalPaisa;
      existing.disbursedAmountPaisa += loan.disbursedAmountPaisa;
      if (loan.npaClassification !== 'STANDARD') existing.npaCount++;
      byBranch.set(branchId, existing);
    }

    return {
      reportType: 'BRANCH_PERFORMANCE',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      branches: Array.from(byBranch.entries()).map(([branchId, d]) => ({
        branchId,
        ...d,
        npaPercent:
          d.loanCount > 0
            ? Math.round((d.npaCount / d.loanCount) * 10000) / 100
            : 0,
      })),
    };
  }

  // ── 10. Product-wise P&L ─────────────────────────────────────────────────

  async productPnlReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const loans = await this.prisma.loan.findMany({
      where: { organizationId: filter.orgId },
      include: { product: { select: { id: true, name: true } } },
    });

    const products = new Map<string, {
      name: string;
      interestIncomePaisa: number;
      aumPaisa: number;
      count: number;
    }>();

    for (const loan of loans) {
      const pid = loan.productId ?? 'UNKNOWN';
      const existing = products.get(pid) ?? {
        name: loan.product?.name ?? 'UNKNOWN',
        interestIncomePaisa: 0,
        aumPaisa: 0,
        count: 0,
      };
      existing.count++;
      existing.aumPaisa += loan.outstandingPrincipalPaisa;
      // Approximate monthly interest income from BPS
      const monthlyRateFraction = loan.interestRateBps / 10000 / 12;
      existing.interestIncomePaisa += Math.round(
        loan.outstandingPrincipalPaisa * monthlyRateFraction,
      );
      products.set(pid, existing);
    }

    // Provision expense from GL
    const provisionAgg = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: filter.orgId,
        accountCode: '5001',
        entryDate: { gte: fromDate, lte: toDate },
        isReversed: false,
      },
      _sum: { debitAmountPaisa: true },
    });

    const totalProvision = provisionAgg._sum.debitAmountPaisa ?? 0;

    return {
      reportType: 'PRODUCT_WISE_PNL',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      products: Array.from(products.entries()).map(([productId, d]) => ({
        productId,
        ...d,
      })),
      totalProvisionExpensePaisa: totalProvision,
    };
  }

  // ── 11. Top Borrower Exposure ─────────────────────────────────────────────

  async topBorrowerExposureReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
      },
      include: { customer: { select: { id: true, fullName: true } } },
      orderBy: { outstandingPrincipalPaisa: 'desc' },
      take: 200,
    });

    const byCustomer = new Map<string, { name: string; totalPaisa: number; loanCount: number }>();
    for (const loan of loans) {
      const cid = loan.customerId;
      const ex = byCustomer.get(cid) ?? {
        name: loan?.customer?.fullName,
        totalPaisa: 0,
        loanCount: 0,
      };
      ex.totalPaisa += loan.outstandingPrincipalPaisa;
      ex.loanCount++;
      byCustomer.set(cid, ex);
    }

    const sorted = Array.from(byCustomer.entries())
      .map(([customerId, d]) => ({ customerId, ...d }))
      .sort((a, b) => b.totalPaisa - a.totalPaisa)
      .slice(0, 20);

    return {
      reportType: 'TOP_BORROWER_EXPOSURE',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      top20Borrowers: sorted,
    };
  }

  // ── 12. Sector Concentration ──────────────────────────────────────────────

  async sectorConcentrationReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
      },
      include: { product: { select: { productType: true } } },
    });

    const bySector: Record<string, { count: number; aumPaisa: number }> = {};
    for (const loan of loans) {
      const sector = loan.product?.productType ?? 'OTHER';
      bySector[sector] = bySector[sector] ?? { count: 0, aumPaisa: 0 };
      bySector[sector].count++;
      bySector[sector].aumPaisa += loan.outstandingPrincipalPaisa;
    }

    const totalAum = loans.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0);

    return {
      reportType: 'SECTOR_CONCENTRATION',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      totalAumPaisa: totalAum,
      sectors: Object.entries(bySector).map(([sector, d]) => ({
        sector,
        ...d,
        concentrationPercent:
          totalAum > 0 ? Math.round((d.aumPaisa / totalAum) * 10000) / 100 : 0,
      })),
    };
  }

  // ── 13. Geographic Concentration ─────────────────────────────────────────

  async geographicConcentrationReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
      },
      include: { branch: { select: { state: true } } },
    });

    const byState: Record<string, { count: number; aumPaisa: number }> = {};
    for (const loan of loans) {
      const state = loan.branch?.state ?? 'UNKNOWN';
      byState[state] = byState[state] ?? { count: 0, aumPaisa: 0 };
      byState[state].count++;
      byState[state].aumPaisa += loan.outstandingPrincipalPaisa;
    }

    const totalAum = loans.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0);

    return {
      reportType: 'GEOGRAPHIC_CONCENTRATION',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      totalAumPaisa: totalAum,
      states: Object.entries(byState)
        .map(([state, d]) => ({
          state,
          ...d,
          concentrationPercent:
            totalAum > 0 ? Math.round((d.aumPaisa / totalAum) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.aumPaisa - a.aumPaisa),
    };
  }

  // ── 14. Yield Analysis ────────────────────────────────────────────────────

  async yieldAnalysisReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
        outstandingPrincipalPaisa: { gt: 0 },
      },
    });

    const totalAum = loans.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0);
    // Weighted average yield in BPS
    const weightedBpsSum = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa * l.interestRateBps,
      0,
    );
    const portfolioYieldBps = totalAum > 0 ? weightedBpsSum / totalAum : 0;
    const portfolioYieldPercent = bpsToPercent(portfolioYieldBps);

    // Cost of funds from fund sources (costOfFundsBps)
    const fundSources = await this.prisma.fundSource.findMany({
      where: { organizationId: filter.orgId, status: 'ACTIVE' },
    });

    const totalBorrowed = fundSources.reduce(
      (s, f) => s + Number(f.outstandingPaisa),
      0,
    );
    const weightedCostBpsSum = fundSources.reduce(
      (s, f) => s + Number(f.outstandingPaisa) * f.costOfFundsBps,
      0,
    );
    const costOfFundsBps = totalBorrowed > 0 ? weightedCostBpsSum / totalBorrowed : 0;
    const costOfFundsPercent = bpsToPercent(costOfFundsBps);
    const nimPercent = Math.round((portfolioYieldPercent - costOfFundsPercent) * 100) / 100;

    return {
      reportType: 'YIELD_ANALYSIS',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      totalAumPaisa: totalAum,
      portfolioYieldPercent,
      costOfFundsPercent,
      netInterestMarginPercent: nimPercent,
      totalBorrowedPaisa: totalBorrowed,
    };
  }

  // ── 15. Restructured Book Report ──────────────────────────────────────────

  async restructuredBookReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from ? new Date(filter.from) : undefined;
    const toDate = filter.to ? new Date(filter.to) : undefined;

    const restructures = await this.prisma.loanRestructure.findMany({
      where: {
        organizationId: filter.orgId,
        ...(fromDate || toDate
          ? { effectiveDate: { gte: fromDate, lte: toDate } }
          : {}),
      },
      include: {
        loan: {
          select: {
            loanNumber: true,
            outstandingPrincipalPaisa: true,
            npaClassification: true,
          },
        },
      },
    });

    return {
      reportType: 'RESTRUCTURED_BOOK',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      totalRestructures: restructures.length,
      totalOutstandingPaisa: restructures.reduce(
        (s, r) => s + (r.loan?.outstandingPrincipalPaisa ?? 0),
        0,
      ),
      accounts: restructures.map((r) => ({
        loanId: r.loanId,
        loanNumber: r.loan?.loanNumber,
        effectiveDate: r.effectiveDate,
        restructureType: r.restructureType,
        outstandingPaisa: r.loan?.outstandingPrincipalPaisa,
        npaClassification: r.loan?.npaClassification,
      })),
    };
  }

  // ── 16. Write-Off Recovery Report ─────────────────────────────────────────

  async writeOffRecoveryReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from ? new Date(filter.from) : undefined;
    const toDate = filter.to ? new Date(filter.to) : undefined;

    const writtenOff = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: filter.orgId,
        referenceType: { in: ['WRITEOFF', 'TECHNICAL_WRITEOFF'] },
        accountCode: '5001',
        ...(fromDate || toDate ? { entryDate: { gte: fromDate, lte: toDate } } : {}),
      },
      _sum: { debitAmountPaisa: true },
      _count: true,
    });

    const recovered = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: filter.orgId,
        referenceType: { in: ['WRITEOFF_RECOVERY', 'POST_WRITEOFF_RECOVERY'] },
        accountCode: '1000',
        ...(fromDate || toDate ? { entryDate: { gte: fromDate, lte: toDate } } : {}),
      },
      _sum: { debitAmountPaisa: true },
    });

    const totalWrittenOff = writtenOff._sum.debitAmountPaisa ?? 0;
    const totalRecovered = recovered._sum.debitAmountPaisa ?? 0;

    return {
      reportType: 'WRITE_OFF_RECOVERY',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      totalWrittenOffPaisa: totalWrittenOff,
      writeOffCount: writtenOff._count,
      totalRecoveredPaisa: totalRecovered,
      netWrittenOffPaisa: totalWrittenOff - totalRecovered,
      recoveryRatePercent:
        totalWrittenOff > 0
          ? Math.round((totalRecovered / totalWrittenOff) * 10000) / 100
          : 0,
    };
  }

  // ── 17. Insurance Renewal Report ──────────────────────────────────────────

  async insuranceRenewalReport(filter: ReportFilter): Promise<object> {
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    const renewalDue = await this.prisma.insurancePolicy.findMany({
      where: {
        organizationId: filter.orgId,
        status: 'ACTIVE',
        renewalDueDate: { lte: next30Days },
      },
      include: { loan: { select: { loanNumber: true } } },
    });

    return {
      reportType: 'INSURANCE_RENEWAL',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      renewalsDueIn30Days: renewalDue.length,
      policies: renewalDue.map((p) => ({
        policyId: p.id,
        loanNumber: p.loan?.loanNumber,
        policyType: p.policyType,
        providerName: p.providerName,
        renewalDueDate: p.renewalDueDate,
        premiumPaisa: p.premiumPaisa,
      })),
    };
  }

  // ── 18. NACH Bounce Trend ─────────────────────────────────────────────────

  async nachBounceTrendReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const bounces = await this.prisma.bounceRegister.findMany({
      where: {
        organizationId: filter.orgId,
        bounceDate: { gte: fromDate, lte: toDate },
      },
      orderBy: { bounceDate: 'asc' },
    });

    // Monthly trend
    const monthlyMap = new Map<string, { count: number; amountPaisa: number }>();
    for (const b of bounces) {
      const month = b.bounceDate.toISOString().slice(0, 7);
      const ex = monthlyMap.get(month) ?? { count: 0, amountPaisa: 0 };
      ex.count++;
      ex.amountPaisa += b.amountPaisa;
      monthlyMap.set(month, ex);
    }

    return {
      reportType: 'NACH_BOUNCE_TREND',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      totalBounces: bounces.length,
      monthlyTrend: Array.from(monthlyMap.entries()).map(([month, d]) => ({
        month,
        ...d,
      })),
    };
  }

  // ── 19. SMA Report (for CRILC) ────────────────────────────────────────────

  async smaReport(filter: ReportFilter): Promise<object> {
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: filter.orgId,
        dpd: { gte: 1, lte: 90 },
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] as any },
      },
      include: { customer: { select: { fullName: true, panNumber: true } } },
    });

    const sma0 = loans.filter((l) => (l.dpd ?? 0) >= 1 && (l.dpd ?? 0) <= 30);
    const sma1 = loans.filter((l) => (l.dpd ?? 0) >= 31 && (l.dpd ?? 0) <= 60);
    const sma2 = loans.filter((l) => (l.dpd ?? 0) >= 61 && (l.dpd ?? 0) <= 90);

    const summarize = (list: typeof loans) => ({
      count: list.length,
      outstandingPaisa: list.reduce((s, l) => s + l.outstandingPrincipalPaisa, 0),
      accounts: list.map((l) => ({
        loanId: l.id,
        loanNumber: l.loanNumber,
        customerId: l.customerId,
        customerName: l?.customer?.fullName,
        panNumber: l?.customer?.panNumber,
        dpd: l.dpd,
        outstandingPaisa: l.outstandingPrincipalPaisa,
      })),
    });

    return {
      reportType: 'SMA_REPORT_CRILC',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      asOfDate: new Date().toISOString().slice(0, 10),
      SMA0: { label: '1-30 DPD', ...summarize(sma0) },
      SMA1: { label: '31-60 DPD', ...summarize(sma1) },
      SMA2: { label: '61-90 DPD', ...summarize(sma2) },
    };
  }

  // ── 20. TAT Report ────────────────────────────────────────────────────────

  async tatReport(filter: ReportFilter): Promise<object> {
    const fromDate = filter.from
      ? new Date(filter.from)
      : new Date(new Date().getFullYear(), 3, 1);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const applications = await this.prisma.loanApplication.findMany({
      where: {
        organizationId: filter.orgId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: {
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    const tatByStage: Record<string, { totalMs: number; count: number }> = {};

    for (const app of applications) {
      const history = app.statusHistory;
      for (let i = 1; i < history.length; i++) {
        const stage = history[i - 1].fromStatus;
        const durationMs =
          history[i].createdAt.getTime() - history[i - 1].createdAt.getTime();
        tatByStage[stage] = tatByStage[stage] ?? { totalMs: 0, count: 0 };
        tatByStage[stage].totalMs += durationMs;
        tatByStage[stage].count++;
      }
    }

    return {
      reportType: 'TAT_REPORT',
      generatedAt: new Date().toISOString(),
      organizationId: filter.orgId,
      from: filter.from,
      to: filter.to,
      applicationCount: applications.length,
      avgTatByStage: Object.entries(tatByStage).map(([stage, d]) => ({
        stage,
        avgDaysFloat:
          d.count > 0
            ? Math.round((d.totalMs / d.count / 86400000) * 100) / 100
            : 0,
        sampleCount: d.count,
      })),
    };
  }
}
