import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CreateLeadScoreConfigDto } from './dto/create-config.dto';
import { UpdateLeadScoreConfigDto } from './dto/update-config.dto';
import { LeaderboardFilterDto } from './dto/leaderboard-filter.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuleCondition {
  field: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

interface ScoringRule {
  condition: RuleCondition;
  points: number;
  label: string;
}

interface ScoringFactor {
  factorCode: string;
  factorName: string;
  category: string;
  maxPoints: number;
  weight: number;
  rules: ScoringRule[];
}

interface GradeConfig {
  grade: string;
  label: string;
  minScore: number;
  maxScore: number;
  color: string;
  action: string;
}

interface ScoringContext {
  customer: {
    age: number | null;
    gender: string | null;
    employmentType: string | null;
    customerType: string | null;
    monthlyIncomePaisa: number | null;
    kycStatus: string | null;
    riskCategory: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  bureau: {
    score: number | null;
    totalActiveLoans: number | null;
    maxDpdLast12Months: number | null;
    hasWriteOff: boolean | null;
    enquiriesLast3Months: number | null;
    enquiriesLast6Months: number | null;
    hasSettlement: boolean | null;
  };
  application: {
    requestedAmountPaisa: number;
    requestedTenureMonths: number;
    sourceType: string;
  };
  loan: {
    existingLoanCount: number;
    totalOutstandingPaisa: number;
    maxDpd: number;
  };
}

// ── Operator Evaluation ───────────────────────────────────────────────────────

function resolveFieldValue(context: ScoringContext, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  if (parts.length < 2) return undefined;

  const [namespace, ...rest] = parts;
  const key = rest.join('.');

  if (namespace === 'customer') return (context.customer as Record<string, unknown>)[key];
  if (namespace === 'bureau') return (context.bureau as Record<string, unknown>)[key];
  if (namespace === 'application') return (context.application as Record<string, unknown>)[key];
  if (namespace === 'loan') return (context.loan as Record<string, unknown>)[key];
  return undefined;
}

function resolveValue(context: ScoringContext, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Handles expressions like "customer.monthlyIncomePaisa * 36"
  const exprMatch = /^([\w.]+)\s*\*\s*(\d+)$/.exec(value);
  if (exprMatch) {
    const fieldVal = resolveFieldValue(context, exprMatch[1]);
    if (typeof fieldVal === 'number') {
      return fieldVal * Number(exprMatch[2]);
    }
    return null;
  }
  return value;
}

function evaluateCondition(condition: RuleCondition, context: ScoringContext): boolean {
  const actual = resolveFieldValue(context, condition.field);
  const { operator } = condition;
  const value = resolveValue(context, condition.value);
  const value2 = resolveValue(context, condition.value2);

  switch (operator) {
    case 'IS_NULL':
      return actual === null || actual === undefined;
    case 'IS_NOT_NULL':
      return actual !== null && actual !== undefined;
    case 'EQ':
      return actual === value;
    case 'NEQ':
      return actual !== value;
    case 'GT':
      return typeof actual === 'number' && actual > (value as number);
    case 'GTE':
      return typeof actual === 'number' && actual >= (value as number);
    case 'LT':
      return typeof actual === 'number' && actual < (value as number);
    case 'LTE':
      return typeof actual === 'number' && actual <= (value as number);
    case 'IN':
      return Array.isArray(value) && value.includes(actual);
    case 'NOT_IN':
      return Array.isArray(value) && !value.includes(actual);
    case 'BETWEEN':
      return (
        typeof actual === 'number' &&
        actual >= (value as number) &&
        (value2 === null || value2 === undefined || actual <= (value2 as number))
      );
    case 'CONTAINS':
      return (
        typeof actual === 'string' &&
        typeof value === 'string' &&
        actual.toLowerCase().includes(value.toLowerCase())
      );
    case 'STARTS_WITH':
      return (
        typeof actual === 'string' &&
        typeof value === 'string' &&
        actual.startsWith(value)
      );
    default:
      return false;
  }
}

function mapToGrade(score: number, grades: GradeConfig[]): GradeConfig {
  const sorted = [...grades].sort((a, b) => b.minScore - a.minScore);
  for (const g of sorted) {
    if (score >= g.minScore && score <= g.maxScore) return g;
  }
  return sorted[sorted.length - 1]; // fallback to lowest grade
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class LeadScoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Create Config ───────────────────────────────────────────────────────

  async createConfig(orgId: string, userId: string, dto: CreateLeadScoreConfigDto) {
    const existing = await this.prisma.leadScoreConfig.findUnique({
      where: { organizationId_configName: { organizationId: orgId, configName: dto.configName } },
    });
    if (existing) {
      throw new ConflictException(`Config '${dto.configName}' already exists`);
    }

    return this.prisma.leadScoreConfig.create({
      data: {
        organizationId: orgId,
        configName: dto.configName,
        productId: dto.productId ?? null,
        isActive: dto.isActive ?? true,
        totalMaxScore: dto.totalMaxScore ?? 100,
        factors: dto.factors,
        grades: dto.grades,
        autoAssignGrades: dto.autoAssignGrades ?? undefined,
        autoNotifyGrades: dto.autoNotifyGrades ?? undefined,
        createdBy: userId,
      },
    });
  }

  // ── 2. Update Config ───────────────────────────────────────────────────────

  async updateConfig(orgId: string, configId: string, dto: UpdateLeadScoreConfigDto) {
    await this._findConfigOrThrow(orgId, configId);

    return this.prisma.leadScoreConfig.update({
      where: { id: configId },
      data: {
        ...(dto.configName !== undefined && { configName: dto.configName }),
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.totalMaxScore !== undefined && { totalMaxScore: dto.totalMaxScore }),
        ...(dto.factors !== undefined && { factors: dto.factors }),
        ...(dto.grades !== undefined && { grades: dto.grades }),
        ...(dto.autoAssignGrades !== undefined && { autoAssignGrades: dto.autoAssignGrades }),
        ...(dto.autoNotifyGrades !== undefined && { autoNotifyGrades: dto.autoNotifyGrades }),
      },
    });
  }

  // ── 3. List Configs ────────────────────────────────────────────────────────

  async listConfigs(orgId: string) {
    const configs = await this.prisma.leadScoreConfig.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { scores: true } } },
    });

    return {
      count: configs.length,
      data: configs.map((c) => ({
        ...c,
        totalScoresGenerated: c._count.scores,
        _count: undefined,
      })),
    };
  }

  // ── 4. Get Config Detail ───────────────────────────────────────────────────

  async getConfig(orgId: string, configId: string) {
    const config = await this.prisma.leadScoreConfig.findFirst({
      where: { id: configId, organizationId: orgId },
      include: { _count: { select: { scores: true } } },
    });
    if (!config) throw new NotFoundException(`Config ${configId} not found`);

    const gradeStats = await this.prisma.leadScore.groupBy({
      by: ['grade'],
      where: { configId, organizationId: orgId },
      _count: { grade: true },
      _avg: { totalScore: true },
    });

    return {
      ...config,
      totalScoresGenerated: config._count.scores,
      gradeDistribution: gradeStats.map((g) => ({
        grade: g.grade,
        count: g._count.grade,
        avgScore: Math.round(g._avg.totalScore ?? 0),
      })),
      _count: undefined,
    };
  }

  // ── 5. Score Application (THE MAIN METHOD) ────────────────────────────────

  async scoreApplication(orgId: string, applicationId: string) {
    // Fetch application with all related data
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: {
        customer: true,
        product: true,
      },
    });
    if (!application) throw new NotFoundException(`Application ${applicationId} not found`);

    // Find active config for this product or default (null productId)
    const config = await this.prisma.leadScoreConfig.findFirst({
      where: {
        organizationId: orgId,
        isActive: true,
        OR: [
          { productId: application.productId },
          { productId: null },
        ],
      },
      orderBy: [
        // Prefer product-specific config over generic
        { productId: 'desc' },
        { createdAt: 'asc' },
      ],
    });
    if (!config) {
      throw new NotFoundException(
        'No active lead score config found for this organization. Please create one first.',
      );
    }

    // Fetch latest bureau response
    const bureauResponse = await this.prisma.bureauResponse.findFirst({
      where: { bureauRequest: { applicationId, organizationId: orgId } },
      orderBy: { id: 'desc' },
    });

    // Fetch existing active loans
    const existingLoans = await this.prisma.loan.findMany({
      where: { customerId: application.customerId, organizationId: orgId, loanStatus: 'ACTIVE' },
      select: { outstandingPrincipalPaisa: true, dpd: true },
    });

    // Build context
    const customer = application.customer;
    const dob = customer.dateOfBirth;
    const ageMs = Date.now() - dob.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

    const context: ScoringContext = {
      customer: {
        age,
        gender: customer.gender,
        employmentType: customer.employmentType,
        customerType: customer.customerType,
        monthlyIncomePaisa: customer.monthlyIncomePaisa ?? null,
        kycStatus: customer.kycStatus,
        riskCategory: customer.riskCategory ?? null,
        city: customer.currentCity ?? null,
        state: customer.currentState ?? null,
        pincode: customer.currentPincode ?? null,
      },
      bureau: {
        score: bureauResponse?.score ?? null,
        totalActiveLoans: bureauResponse?.totalActiveLoans ?? null,
        maxDpdLast12Months: bureauResponse?.maxDpdLast12Months ?? null,
        hasWriteOff: bureauResponse?.hasWriteOff ?? null,
        enquiriesLast3Months: bureauResponse?.enquiriesLast3Months ?? null,
        enquiriesLast6Months: bureauResponse?.enquiriesLast6Months ?? null,
        hasSettlement: bureauResponse?.hasSettlement ?? null,
      },
      application: {
        requestedAmountPaisa: application.requestedAmountPaisa,
        requestedTenureMonths: application.requestedTenureMonths,
        sourceType: application.sourceType,
      },
      loan: {
        existingLoanCount: existingLoans.length,
        totalOutstandingPaisa: existingLoans.reduce(
          (sum, l) => sum + (l.outstandingPrincipalPaisa ?? 0),
          0,
        ),
        maxDpd: existingLoans.reduce((max, l) => Math.max(max, l.dpd ?? 0), 0),
      },
    };

    // Evaluate each factor
    const factors = config.factors as unknown as ScoringFactor[];
    const grades = config.grades as unknown as GradeConfig[];

    const factorScores: Array<{
      factorCode: string;
      factorName: string;
      category: string;
      maxPoints: number;
      earnedPoints: number;
      matchedRule: string | null;
      rawValue: unknown;
    }> = [];

    let totalScore = 0;

    for (const factor of factors) {
      const rawValue = resolveFieldValue(context, factor.rules[0]?.condition?.field ?? '');
      let earnedPoints = 0;
      let matchedRule: string | null = null;

      for (const rule of factor.rules) {
        if (evaluateCondition(rule.condition, context)) {
          earnedPoints = rule.points;
          matchedRule = rule.label;
          break; // first matching rule wins
        }
      }

      totalScore += earnedPoints;
      factorScores.push({
        factorCode: factor.factorCode,
        factorName: factor.factorName,
        category: factor.category,
        maxPoints: factor.maxPoints,
        earnedPoints,
        matchedRule,
        rawValue,
      });
    }

    // Clamp to 0-100
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Map to grade
    const gradeConfig = mapToGrade(totalScore, grades);

    // Check previous score
    const previousScore = await this.prisma.leadScore.findFirst({
      where: { applicationId, organizationId: orgId },
      orderBy: { version: 'desc' },
    });

    const newVersion = (previousScore?.version ?? 0) + 1;
    const scoreChange = previousScore !== null ? totalScore - (previousScore.totalScore ?? 0) : null;

    // Create or update the score record (one record per application, updated on rescore)
    let upserted;
    if (previousScore) {
      upserted = await this.prisma.leadScore.update({
        where: { id: previousScore.id },
        data: {
          configId: config.id,
          totalScore,
          grade: gradeConfig.grade,
          gradeLabel: gradeConfig.label,
          factorScores: factorScores as object[],
          recommendedAction: gradeConfig.action,
          previousScore: previousScore.totalScore,
          scoreChange,
          version: newVersion,
          scoredAt: new Date(),
        },
      });
    } else {
      upserted = await this.prisma.leadScore.create({
        data: {
          organizationId: orgId,
          applicationId,
          customerId: application.customerId,
          configId: config.id,
          totalScore,
          grade: gradeConfig.grade,
          gradeLabel: gradeConfig.label,
          factorScores: factorScores as object[],
          recommendedAction: gradeConfig.action,
          previousScore: null,
          scoreChange: null,
          version: 1,
        },
      });
    }

    return {
      applicationId,
      applicationNumber: application.applicationNumber,
      customerId: application.customerId,
      customerName: application.customer.fullName,
      configId: config.id,
      configName: config.configName,
      totalScore,
      grade: gradeConfig.grade,
      gradeLabel: gradeConfig.label,
      gradeColor: gradeConfig.color,
      recommendedAction: gradeConfig.action,
      previousScore: previousScore?.totalScore ?? null,
      scoreChange,
      version: newVersion,
      factorScores,
      autoAssignRole: (config.autoAssignGrades as Record<string, string> | null)?.[gradeConfig.grade] ?? null,
      autoNotifyChannels: (config.autoNotifyGrades as Record<string, string[]> | null)?.[gradeConfig.grade] ?? [],
      scoredAt: upserted.scoredAt,
    };
  }

  // ── 6. Bulk Score Applications ─────────────────────────────────────────────

  async bulkScoreApplications(orgId: string, filters?: { status?: string[] }) {
    const statuses = filters?.status ?? ['LEAD', 'APPLICATION', 'DOCUMENT_COLLECTION', 'BUREAU_CHECK', 'UNDERWRITING'];

    const applications = await this.prisma.loanApplication.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        status: { in: statuses as any[] },
      },
      select: { id: true, applicationNumber: true },
    });

    let processed = 0;
    let errors = 0;
    const results: Array<{ applicationId: string; applicationNumber: string; score?: number; grade?: string; error?: string }> = [];

    for (const app of applications) {
      try {
        const result = await this.scoreApplication(orgId, app.id);
        results.push({
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          score: result.totalScore,
          grade: result.grade,
        });
        processed++;
      } catch (err: unknown) {
        errors++;
        results.push({
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      orgId,
      totalApplications: applications.length,
      processed,
      errors,
      completedAt: new Date().toISOString(),
      results,
    };
  }

  // ── 7. Rescore Application ─────────────────────────────────────────────────

  async rescoreApplication(orgId: string, applicationId: string) {
    return this.scoreApplication(orgId, applicationId);
  }

  // ── 8. Get Score ───────────────────────────────────────────────────────────

  async getScore(orgId: string, applicationId: string) {
    const score = await this.prisma.leadScore.findFirst({
      where: { applicationId, organizationId: orgId },
      orderBy: { version: 'desc' },
      include: {
        config: { select: { configName: true, grades: true, totalMaxScore: true } },
        application: { select: { applicationNumber: true, status: true, requestedAmountPaisa: true } },
        customer: { select: { fullName: true, phone: true, employmentType: true } },
      },
    });

    if (!score) throw new NotFoundException(`No score found for application ${applicationId}`);
    return score;
  }

  // ── 9. Get Score History ───────────────────────────────────────────────────

  async getScoreHistory(orgId: string, applicationId: string) {
    const scores = await this.prisma.leadScore.findMany({
      where: { applicationId, organizationId: orgId },
      orderBy: { version: 'asc' },
      include: {
        config: { select: { configName: true } },
      },
    });

    return {
      applicationId,
      totalVersions: scores.length,
      history: scores.map((s) => ({
        version: s.version,
        totalScore: s.totalScore,
        grade: s.grade,
        gradeLabel: s.gradeLabel,
        previousScore: s.previousScore,
        scoreChange: s.scoreChange,
        configName: s.config.configName,
        scoredAt: s.scoredAt,
      })),
    };
  }

  // ── 10. Leaderboard ────────────────────────────────────────────────────────

  async getLeaderboard(orgId: string, filters: LeaderboardFilterDto) {
    const limit = filters.limit ?? 50;

    // Build where for LeadScore
    const scoreWhere: Record<string, unknown> = { organizationId: orgId };
    if (filters.grade) scoreWhere['grade'] = filters.grade;

    // Build where for LoanApplication join
    const appWhere: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    if (filters.productId) appWhere['productId'] = filters.productId;
    if (filters.branchId) appWhere['branchId'] = filters.branchId;
    if (filters.assignedToId) appWhere['assignedToId'] = filters.assignedToId;
    if (filters.fromDate || filters.toDate) {
      appWhere['createdAt'] = {
        ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
      };
    }

    // Get latest score per application using subquery approach
    const scores = await this.prisma.leadScore.findMany({
      where: {
        ...scoreWhere,
        application: appWhere as any,
      },
      orderBy: { totalScore: 'desc' },
      take: limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            requestedAmountPaisa: true,
            sourceType: true,
            createdAt: true,
            assignedTo: { select: { firstName: true, lastName: true, id: true } },
            product: { select: { name: true, productType: true } },
            branch: { select: { name: true, code: true } },
          },
        },
        customer: {
          select: {
            id: true,
            customerNumber: true,
            fullName: true,
            phone: true,
            employmentType: true,
            kycStatus: true,
          },
        },
      },
    });

    const hasMore = scores.length === limit;
    const nextCursor = hasMore ? scores[scores.length - 1].id : null;

    return {
      cursor: filters.cursor ?? null,
      limit,
      hasMore,
      nextCursor,
      data: scores.map((s) => ({
        scoreId: s.id,
        applicationId: s.applicationId,
        applicationNumber: s.application.applicationNumber,
        applicationStatus: s.application.status,
        requestedAmountRupees: (s.application.requestedAmountPaisa / 100).toFixed(2),
        sourceType: s.application.sourceType,
        product: s.application.product,
        branch: s.application.branch,
        customer: s.customer,
        assignedTo: s.application.assignedTo,
        totalScore: s.totalScore,
        grade: s.grade,
        gradeLabel: s.gradeLabel,
        recommendedAction: s.recommendedAction,
        version: s.version,
        scoredAt: s.scoredAt,
        createdAt: s.application.createdAt,
      })),
    };
  }

  // ── 11. Grade Distribution ─────────────────────────────────────────────────

  async getGradeDistribution(orgId: string, filters?: { productId?: string; branchId?: string }) {
    const appWhere: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    if (filters?.productId) appWhere['productId'] = filters.productId;
    if (filters?.branchId) appWhere['branchId'] = filters.branchId;

    const gradeStats = await this.prisma.leadScore.groupBy({
      by: ['grade', 'gradeLabel'],
      where: {
        organizationId: orgId,
        application: appWhere as any,
      },
      _count: { grade: true },
      _avg: { totalScore: true },
      _min: { totalScore: true },
      _max: { totalScore: true },
    });

    const total = gradeStats.reduce((sum, g) => sum + g._count.grade, 0);

    // Fetch grade colors from config
    const config = await this.prisma.leadScoreConfig.findFirst({
      where: { organizationId: orgId, isActive: true },
      select: { grades: true },
    });

    const gradeColorMap: Record<string, string> = {};
    if (config?.grades) {
      for (const g of config.grades as unknown as GradeConfig[]) {
        gradeColorMap[g.grade] = g.color;
      }
    }

    const gradeOrder = ['A', 'B', 'C', 'D', 'F'];

    return {
      total,
      distribution: gradeOrder.map((grade) => {
        const stat = gradeStats.find((g) => g.grade === grade);
        return {
          grade,
          gradeLabel: stat?.gradeLabel ?? grade,
          count: stat?._count.grade ?? 0,
          percentage: total > 0 ? (((stat?._count.grade ?? 0) / total) * 100).toFixed(1) : '0.0',
          avgScore: Math.round(stat?._avg.totalScore ?? 0),
          minScore: stat?._min.totalScore ?? 0,
          maxScore: stat?._max.totalScore ?? 0,
          color: gradeColorMap[grade] ?? '#6b7280',
        };
      }),
    };
  }

  // ── 12. Conversion Rate by Grade ───────────────────────────────────────────

  async getConversionByGrade(orgId: string) {
    const gradeOrder = ['A', 'B', 'C', 'D', 'F'];

    const results = await Promise.all(
      gradeOrder.map(async (grade) => {
        // Total applications scored with this grade
        const totalScored = await this.prisma.leadScore.count({
          where: { organizationId: orgId, grade },
        });

        if (totalScored === 0) {
          return { grade, totalScored: 0, disbursed: 0, conversionRate: '0.0' };
        }

        // Get applicationIds with this grade
        const scored = await this.prisma.leadScore.findMany({
          where: { organizationId: orgId, grade },
          select: { applicationId: true },
        });
        const applicationIds = scored.map((s) => s.applicationId);

        // Count how many reached DISBURSED status
        const disbursed = await this.prisma.loanApplication.count({
          where: {
            id: { in: applicationIds },
            organizationId: orgId,
            status: 'DISBURSED',
          },
        });

        return {
          grade,
          totalScored,
          disbursed,
          conversionRate: ((disbursed / totalScored) * 100).toFixed(1),
        };
      }),
    );

    return { orgId, conversionByGrade: results };
  }

  // ── 13. Factor Analysis ────────────────────────────────────────────────────

  async getFactorAnalysis(orgId: string, configId: string) {
    const config = await this._findConfigOrThrow(orgId, configId);
    const factors = config.factors as unknown as ScoringFactor[];

    // Fetch all scores for this config
    const scores = await this.prisma.leadScore.findMany({
      where: { configId, organizationId: orgId },
      select: { totalScore: true, grade: true, factorScores: true },
    });

    if (scores.length === 0) {
      return { configId, totalSamples: 0, factorAnalysis: [] };
    }

    // Aggregate per factor
    const factorAnalysis = factors.map((factor) => {
      let totalEarned = 0;
      let countWithPoints = 0;
      const ruleMatchCounts: Record<string, number> = {};

      for (const score of scores) {
        const factorData = (score.factorScores as any[]).find(
          (fs: any) => fs.factorCode === factor.factorCode,
        );
        if (!factorData) continue;

        totalEarned += factorData.earnedPoints;
        if (factorData.earnedPoints > 0) countWithPoints++;
        if (factorData.matchedRule) {
          ruleMatchCounts[factorData.matchedRule] = (ruleMatchCounts[factorData.matchedRule] ?? 0) + 1;
        }
      }

      const avgEarned = scores.length > 0 ? totalEarned / scores.length : 0;
      const utilizationRate = factor.maxPoints > 0
        ? ((avgEarned / factor.maxPoints) * 100).toFixed(1)
        : '0.0';

      return {
        factorCode: factor.factorCode,
        factorName: factor.factorName,
        category: factor.category,
        maxPoints: factor.maxPoints,
        avgEarnedPoints: avgEarned.toFixed(1),
        utilizationRate: `${utilizationRate}%`,
        countWithAnyPoints: countWithPoints,
        ruleMatchDistribution: Object.entries(ruleMatchCounts)
          .map(([rule, count]) => ({ rule, count, percentage: ((count / scores.length) * 100).toFixed(1) }))
          .sort((a, b) => b.count - a.count),
      };
    });

    return {
      configId,
      configName: config.configName,
      totalSamples: scores.length,
      factorAnalysis: factorAnalysis.sort((a, b) =>
        parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate)
      ),
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private async _findConfigOrThrow(orgId: string, configId: string) {
    const config = await this.prisma.leadScoreConfig.findFirst({
      where: { id: configId, organizationId: orgId },
    });
    if (!config) throw new NotFoundException(`Config ${configId} not found`);
    return config;
  }
}
