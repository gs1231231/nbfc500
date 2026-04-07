import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CreateFundSourceDto, UpdateFundSourceDto } from './dto/create-fund-source.dto';

// ALM maturity bucket definitions — RBI standard buckets
const ALM_BUCKETS = [
  { name: '1-7 days',    daysFrom: 1,   daysTo: 7   },
  { name: '8-14 days',   daysFrom: 8,   daysTo: 14  },
  { name: '15-30 days',  daysFrom: 15,  daysTo: 30  },
  { name: '1-2 months',  daysFrom: 31,  daysTo: 60  },
  { name: '2-3 months',  daysFrom: 61,  daysTo: 90  },
  { name: '3-6 months',  daysFrom: 91,  daysTo: 180 },
  { name: '6-12 months', daysFrom: 181, daysTo: 365 },
  { name: '1-3 years',   daysFrom: 366, daysTo: 1095 },
  { name: '3-5 years',   daysFrom: 1096, daysTo: 1825 },
  { name: 'Over 5 years',daysFrom: 1826, daysTo: Infinity },
];

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Fund Source CRUD
  // ============================================================

  /**
   * Creates a new fund source (borrowing line) for the organization.
   */
  async createFundSource(orgId: string, dto: CreateFundSourceDto) {
    // Verify org exists
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    return prismaAny.fundSource.create({
      data: {
        organizationId: orgId,
        sourceName: dto.sourceName,
        sourceType: dto.sourceType,
        sanctionedPaisa: dto.sanctionedPaisa,
        costOfFundsBps: dto.costOfFundsBps,
        drawdownDate: dto.drawdownDate ? new Date(dto.drawdownDate) : null,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
        repaymentFrequency: dto.repaymentFrequency ?? null,
        covenants: dto.covenants ?? null,
      },
    });
  }

  /**
   * Lists all fund sources for the organization.
   */
  async listFundSources(orgId: string, status?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };
    if (status) where.status = status;

    return prismaAny.fundSource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetches a single fund source by ID.
   */
  async getFundSource(orgId: string, fundSourceId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const record = await prismaAny.fundSource.findFirst({
      where: { id: fundSourceId, organizationId: orgId },
    });
    if (!record) throw new NotFoundException(`FundSource ${fundSourceId} not found`);
    return record;
  }

  /**
   * Updates an existing fund source.
   */
  async updateFundSource(orgId: string, fundSourceId: string, dto: UpdateFundSourceDto) {
    await this.getFundSource(orgId, fundSourceId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    return prismaAny.fundSource.update({
      where: { id: fundSourceId },
      data: {
        ...(dto.sourceName !== undefined && { sourceName: dto.sourceName }),
        ...(dto.drawnPaisa !== undefined && { drawnPaisa: dto.drawnPaisa }),
        ...(dto.outstandingPaisa !== undefined && { outstandingPaisa: dto.outstandingPaisa }),
        ...(dto.costOfFundsBps !== undefined && { costOfFundsBps: dto.costOfFundsBps }),
        ...(dto.maturityDate !== undefined && { maturityDate: new Date(dto.maturityDate) }),
        ...(dto.repaymentFrequency !== undefined && { repaymentFrequency: dto.repaymentFrequency }),
        ...(dto.covenants !== undefined && { covenants: dto.covenants }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  /**
   * Deletes (closes) a fund source by setting status to CLOSED.
   */
  async deleteFundSource(orgId: string, fundSourceId: string) {
    await this.getFundSource(orgId, fundSourceId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    await prismaAny.fundSource.update({
      where: { id: fundSourceId },
      data: { status: 'CLOSED' },
    });
    return { message: `FundSource ${fundSourceId} closed successfully` };
  }

  // ============================================================
  // Treasury Analytics
  // ============================================================

  /**
   * Calculates the weighted average cost of funds across all ACTIVE fund sources.
   *
   * Formula: Sum(outstandingPaisa_i * costOfFundsBps_i) / Sum(outstandingPaisa_i)
   *
   * Returns 0 if there are no active fund sources with outstanding balance.
   */
  async calculateWeightedCostOfFunds(orgId: string): Promise<{
    weightedCostBps: number;
    weightedCostPercent: number;
    totalOutstandingPaisa: bigint;
    breakdown: Array<{ sourceName: string; outstandingPaisa: bigint; costOfFundsBps: number; weight: number }>;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const sources = await prismaAny.fundSource.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
    });

    if (!sources.length) {
      return {
        weightedCostBps: 0,
        weightedCostPercent: 0,
        totalOutstandingPaisa: BigInt(0),
        breakdown: [],
      };
    }

    let totalOutstanding = BigInt(0);
    let weightedSum = BigInt(0);

    for (const src of sources) {
      totalOutstanding += src.outstandingPaisa;
      weightedSum += src.outstandingPaisa * BigInt(src.costOfFundsBps);
    }

    const weightedCostBps = totalOutstanding > BigInt(0)
      ? Number(weightedSum / totalOutstanding)
      : 0;

    const breakdown = sources.map((src: { sourceName: string; outstandingPaisa: bigint; costOfFundsBps: number }) => ({
      sourceName: src.sourceName,
      outstandingPaisa: src.outstandingPaisa,
      costOfFundsBps: src.costOfFundsBps,
      weight: totalOutstanding > BigInt(0)
        ? Number((src.outstandingPaisa * BigInt(10000)) / totalOutstanding) / 100
        : 0,
    }));

    return {
      weightedCostBps,
      weightedCostPercent: weightedCostBps / 100,
      totalOutstandingPaisa: totalOutstanding,
      breakdown,
    };
  }

  /**
   * Calculates Net Interest Margin (NIM) for the organization.
   *
   * NIM = (Interest Earned - Interest Paid) / Average Earning Assets
   *
   * Interest Earned: sum of interestComponentPaisa from PAID schedules in the last 12 months
   * Interest Paid:   weighted cost of funds * avg outstanding loan book / 10000
   * Avg Earning Assets: average outstanding principal across all active loans
   */
  async calculateNIM(orgId: string): Promise<{
    interestEarnedPaisa: bigint;
    interestPaidPaisa: bigint;
    avgEarningAssetsPaisa: bigint;
    nimBps: number;
    nimPercent: number;
  }> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    // Interest earned: sum of interest received on loans in last 12 months
    const scheduleAgg = await this.prisma.loanSchedule.aggregate({
      _sum: { interestComponentPaisa: true },
      where: {
        loan: { organizationId: orgId },
        status: 'PAID',
        paidDate: { gte: twelveMonthsAgo },
      },
    });

    const interestEarnedPaisa = BigInt(scheduleAgg._sum.interestComponentPaisa ?? 0);

    // Average earning assets: average outstanding principal of active loans
    const loanAgg = await this.prisma.loan.aggregate({
      _avg: { outstandingPrincipalPaisa: true },
      where: { organizationId: orgId, loanStatus: 'ACTIVE' },
    });

    const avgEarningAssetsPaisa = BigInt(Math.round(loanAgg._avg.outstandingPrincipalPaisa ?? 0));

    // Interest paid: derived from weighted cost of funds applied to avg earning assets over 12 months
    const { weightedCostBps } = await this.calculateWeightedCostOfFunds(orgId);
    const interestPaidPaisa = avgEarningAssetsPaisa > BigInt(0)
      ? (avgEarningAssetsPaisa * BigInt(weightedCostBps)) / BigInt(10000)
      : BigInt(0);

    const nimBps = avgEarningAssetsPaisa > BigInt(0)
      ? Number(((interestEarnedPaisa - interestPaidPaisa) * BigInt(10000)) / avgEarningAssetsPaisa)
      : 0;

    return {
      interestEarnedPaisa,
      interestPaidPaisa,
      avgEarningAssetsPaisa,
      nimBps,
      nimPercent: nimBps / 100,
    };
  }

  /**
   * Generates an Asset-Liability Management (ALM) report for the given date.
   *
   * Matches loan repayment inflows against borrowing maturity outflows across
   * RBI-standard time buckets.
   *
   * Persists ALMBucket rows and returns the liquidity gap analysis.
   */
  async generateALM(orgId: string, reportDate: string) {
    const refDate = new Date(reportDate);

    // Fetch pending loan schedule payments (inflows)
    const pendingSchedules = await this.prisma.loanSchedule.findMany({
      where: {
        loan: { organizationId: orgId },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: refDate },
      },
      select: { dueDate: true, emiAmountPaisa: true },
    });

    // Fetch active borrowings (outflows on maturity/repayment dates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const fundSources = await prismaAny.fundSource.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { maturityDate: true, outstandingPaisa: true },
    });

    // Bucket inflows from loan EMIs
    const inflows: Record<string, bigint> = {};
    for (const bucket of ALM_BUCKETS) inflows[bucket.name] = BigInt(0);

    for (const sched of pendingSchedules) {
      const daysToMaturity = Math.ceil(
        (sched.dueDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const bucket = ALM_BUCKETS.find(
        (b) => daysToMaturity >= b.daysFrom && daysToMaturity <= b.daysTo,
      );
      if (bucket) {
        inflows[bucket.name] += BigInt(sched.emiAmountPaisa);
      }
    }

    // Bucket outflows from fund source maturities
    const outflows: Record<string, bigint> = {};
    for (const bucket of ALM_BUCKETS) outflows[bucket.name] = BigInt(0);

    for (const src of fundSources) {
      if (!src.maturityDate) continue;
      const matDate = new Date(src.maturityDate);
      if (matDate < refDate) continue;
      const daysToMaturity = Math.ceil(
        (matDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const bucket = ALM_BUCKETS.find(
        (b) => daysToMaturity >= b.daysFrom && daysToMaturity <= b.daysTo,
      );
      if (bucket) {
        outflows[bucket.name] += src.outstandingPaisa;
      }
    }

    // Delete existing ALM buckets for this org+date and re-insert
    await prismaAny.aLMBucket.deleteMany({
      where: { organizationId: orgId, reportDate: refDate },
    });

    // Build bucket rows with cumulative gap
    const bucketRows: Array<{
      bucketName: string;
      inflowPaisa: bigint;
      outflowPaisa: bigint;
      gapPaisa: bigint;
      cumulativeGapPaisa: bigint;
    }> = [];

    let cumulativeGap = BigInt(0);
    for (const bucket of ALM_BUCKETS) {
      const inflow = inflows[bucket.name];
      const outflow = outflows[bucket.name];
      const gap = inflow - outflow;
      cumulativeGap += gap;
      bucketRows.push({
        bucketName: bucket.name,
        inflowPaisa: inflow,
        outflowPaisa: outflow,
        gapPaisa: gap,
        cumulativeGapPaisa: cumulativeGap,
      });
    }

    // Persist
    await prismaAny.aLMBucket.createMany({
      data: bucketRows.map((r) => ({
        organizationId: orgId,
        reportDate: refDate,
        ...r,
      })),
    });

    return {
      reportDate,
      buckets: bucketRows,
      summary: {
        totalInflows: bucketRows.reduce((s, b) => s + b.inflowPaisa, BigInt(0)),
        totalOutflows: bucketRows.reduce((s, b) => s + b.outflowPaisa, BigInt(0)),
        overallGap: bucketRows.reduce((s, b) => s + b.gapPaisa, BigInt(0)),
        liquidityAdequate: cumulativeGap >= BigInt(0),
      },
    };
  }

  /**
   * Checks covenant compliance for all ACTIVE fund sources.
   *
   * Compares current org metrics against covenants stored in each fund source.
   * Returns per-source compliance status.
   */
  async getCovenantCompliance(orgId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const sources = await prismaAny.fundSource.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', covenants: { not: null } },
    });

    // Get current NPA ratio (NPA loans / total active loans)
    const [npaCount, totalCount] = await Promise.all([
      this.prisma.loan.count({
        where: {
          organizationId: orgId,
          npaClassification: { not: 'STANDARD' },
        },
      }),
      this.prisma.loan.count({ where: { organizationId: orgId, loanStatus: 'ACTIVE' } }),
    ]);

    const currentNpaRatio = totalCount > 0 ? (npaCount / totalCount) * 100 : 0;

    const complianceResults = sources.map((src: {
      id: string;
      sourceName: string;
      covenants: { minCrar?: number; maxNpa?: number; minNetWorth?: number } | null;
    }) => {
      const covenants = src.covenants;
      if (!covenants) return { fundSourceId: src.id, sourceName: src.sourceName, compliant: true, breaches: [] };

      const breaches: string[] = [];

      if (covenants.maxNpa !== undefined && currentNpaRatio > covenants.maxNpa) {
        breaches.push(
          `NPA ratio ${currentNpaRatio.toFixed(2)}% exceeds covenant max ${covenants.maxNpa}%`,
        );
      }
      // CRAR and NetWorth checks would require balance sheet data; flagged as NOT_EVALUATED
      if (covenants.minCrar !== undefined) {
        breaches.push(`CRAR covenant (min ${covenants.minCrar}%) requires manual balance sheet verification`);
      }
      if (covenants.minNetWorth !== undefined) {
        breaches.push(`Net Worth covenant (min ₹${(Number(covenants.minNetWorth) / 100).toFixed(0)}) requires manual balance sheet verification`);
      }

      return {
        fundSourceId: src.id,
        sourceName: src.sourceName,
        compliant: breaches.length === 0,
        breaches,
        currentMetrics: { npaRatioPercent: currentNpaRatio },
      };
    });

    const overallCompliant = complianceResults.every((r: { compliant: boolean }) => r.compliant);

    return {
      organizationId: orgId,
      overallCompliant,
      checkedAt: new Date(),
      sources: complianceResults,
    };
  }
}
