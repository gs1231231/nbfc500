import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { FilterSegmentDto } from './dto/filter-segment.dto';

// ── Types ────────────────────────────────────────────────────────────────────

interface SegmentRule {
  field: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

interface EvaluationContext {
  customer: {
    age: number | null;
    gender: string | null;
    employmentType: string | null;
    customerType: string | null;
    monthlyIncomePaisa: number | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    kycStatus: string | null;
    riskCategory: string | null;
  };
  bureau: {
    score: number | null;
    totalActiveLoans: number | null;
    maxDpdLast12Months: number | null;
    hasWriteOff: boolean | null;
    enquiriesLast3Months: number | null;
  };
  loan: {
    existingLoanCount: number;
    totalOutstandingPaisa: number;
    maxDpd: number;
  };
  custom: Record<string, unknown>;
}

// ── Operator Evaluation ───────────────────────────────────────────────────────

function getNestedValue(context: EvaluationContext, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  if (parts.length < 2) return undefined;

  const [namespace, ...rest] = parts;
  const key = rest.join('.');

  if (namespace === 'customer') return (context.customer as Record<string, unknown>)[key];
  if (namespace === 'bureau') return (context.bureau as Record<string, unknown>)[key];
  if (namespace === 'loan') return (context.loan as Record<string, unknown>)[key];
  if (namespace === 'custom') return context.custom[key];
  return undefined;
}

function evaluateRule(rule: SegmentRule, context: EvaluationContext): boolean {
  const actual = getNestedValue(context, rule.field);
  const { operator, value, value2 } = rule;

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
        actual <= (value2 as number)
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

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SegmentationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Create Segment ──────────────────────────────────────────────────────

  async createSegment(orgId: string, userId: string, dto: CreateSegmentDto) {
    const existing = await this.prisma.customerSegment.findUnique({
      where: {
        organizationId_segmentCode: {
          organizationId: orgId,
          segmentCode: dto.segmentCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Segment with code '${dto.segmentCode}' already exists`,
      );
    }

    return this.prisma.customerSegment.create({
      data: {
        organizationId: orgId,
        segmentCode: dto.segmentCode,
        segmentName: dto.segmentName,
        description: dto.description ?? null,
        segmentType: dto.segmentType,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
        isAutoAssign: dto.isAutoAssign ?? true,
        rules: dto.rules as object[],
        mappedSchemeIds: dto.mappedSchemeIds ?? undefined,
        mappedProductIds: dto.mappedProductIds ?? undefined,
        defaultLanguage: dto.defaultLanguage ?? null,
        preferredChannel: dto.preferredChannel ?? null,
        communicationFrequency: dto.communicationFrequency ?? null,
        maxOffersToShow: dto.maxOffersToShow ?? 3,
        offerPriority: dto.offerPriority ?? 'BEST_RATE',
        createdBy: userId,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  // ── 2. Update Segment ──────────────────────────────────────────────────────

  async updateSegment(orgId: string, segmentId: string, userId: string, dto: UpdateSegmentDto) {
    await this._findSegmentOrThrow(orgId, segmentId);

    return this.prisma.customerSegment.update({
      where: { id: segmentId },
      data: {
        ...(dto.segmentName !== undefined && { segmentName: dto.segmentName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.segmentType !== undefined && { segmentType: dto.segmentType }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isAutoAssign !== undefined && { isAutoAssign: dto.isAutoAssign }),
        ...(dto.rules !== undefined && { rules: dto.rules as object[] }),
        ...(dto.mappedSchemeIds !== undefined && { mappedSchemeIds: dto.mappedSchemeIds }),
        ...(dto.mappedProductIds !== undefined && { mappedProductIds: dto.mappedProductIds }),
        ...(dto.defaultLanguage !== undefined && { defaultLanguage: dto.defaultLanguage }),
        ...(dto.preferredChannel !== undefined && { preferredChannel: dto.preferredChannel }),
        ...(dto.communicationFrequency !== undefined && { communicationFrequency: dto.communicationFrequency }),
        ...(dto.maxOffersToShow !== undefined && { maxOffersToShow: dto.maxOffersToShow }),
        ...(dto.offerPriority !== undefined && { offerPriority: dto.offerPriority }),
        updatedBy: userId,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  // ── 3. List Segments ───────────────────────────────────────────────────────

  async listSegments(orgId: string, filters: FilterSegmentDto) {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (filters.segmentType) where['segmentType'] = filters.segmentType;
    if (filters.isActive !== undefined)
      where['isActive'] = filters.isActive === 'true';
    if (filters.search) {
      where['OR'] = [
        { segmentName: { contains: filters.search, mode: 'insensitive' } },
        { segmentCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const segments = await this.prisma.customerSegment.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { members: { where: { isActive: true } } } } },
    });

    return {
      count: segments.length,
      data: segments.map((s) => ({
        ...s,
        memberCount: s._count.members,
        _count: undefined,
      })),
    };
  }

  // ── 4. Get Segment Detail ─────────────────────────────────────────────────

  async getSegment(orgId: string, segmentId: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, organizationId: orgId },
      include: {
        _count: { select: { members: { where: { isActive: true } } } },
        members: {
          where: { isActive: true },
          orderBy: { assignedAt: 'desc' },
          take: 20,
          include: {
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
        },
      },
    });

    if (!segment) throw new NotFoundException(`Segment ${segmentId} not found`);

    // Fetch mapped schemes if any
    const mappedSchemes = segment.mappedSchemeIds
      ? await this.prisma.scheme.findMany({
          where: {
            id: { in: segment.mappedSchemeIds as string[] },
            organizationId: orgId,
          },
          select: { id: true, schemeCode: true, schemeName: true, schemeType: true, isActive: true, validFrom: true, validTo: true },
        })
      : [];

    return {
      ...segment,
      memberCount: segment._count.members,
      _count: undefined,
      mappedSchemes,
    };
  }

  // ── 5. Deactivate Segment ─────────────────────────────────────────────────

  async deactivateSegment(orgId: string, segmentId: string, userId: string) {
    await this._findSegmentOrThrow(orgId, segmentId);

    return this.prisma.customerSegment.update({
      where: { id: segmentId },
      data: { isActive: false, updatedBy: userId },
    });
  }

  // ── 6. Evaluate Customer Against All Segments (core method) ──────────────

  async evaluateCustomer(
    orgId: string,
    customerId: string,
    applicationId?: string,
  ) {
    // Fetch customer with all relevant data
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    // Fetch latest bureau response for this customer
    const latestBureauResponse = await this.prisma.bureauResponse.findFirst({
      where: { bureauRequest: { customerId, organizationId: orgId } },
      orderBy: { id: 'desc' },
    });

    // Fetch existing active loans for this customer
    const existingLoans = await this.prisma.loan.findMany({
      where: { customerId, organizationId: orgId, loanStatus: 'ACTIVE' },
      select: { outstandingPrincipalPaisa: true, dpd: true },
    });

    // Build evaluation context
    const dob = customer.dateOfBirth;
    const ageMs = Date.now() - dob.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

    const context: EvaluationContext = {
      customer: {
        age,
        gender: customer.gender,
        employmentType: customer.employmentType,
        customerType: customer.customerType,
        monthlyIncomePaisa: customer.monthlyIncomePaisa ?? null,
        city: customer.currentCity ?? null,
        state: customer.currentState ?? null,
        pincode: customer.currentPincode ?? null,
        kycStatus: customer.kycStatus,
        riskCategory: customer.riskCategory ?? null,
      },
      bureau: {
        score: latestBureauResponse?.score ?? null,
        totalActiveLoans: latestBureauResponse?.totalActiveLoans ?? null,
        maxDpdLast12Months: latestBureauResponse?.maxDpdLast12Months ?? null,
        hasWriteOff: latestBureauResponse?.hasWriteOff ?? null,
        enquiriesLast3Months: latestBureauResponse?.enquiriesLast3Months ?? null,
      },
      loan: {
        existingLoanCount: existingLoans.length,
        totalOutstandingPaisa: existingLoans.reduce(
          (sum, l) => sum + (l.outstandingPrincipalPaisa ?? 0),
          0,
        ),
        maxDpd: existingLoans.reduce((max, l) => Math.max(max, l.dpd ?? 0), 0),
      },
      custom: (customer.customFields as Record<string, unknown>) ?? {},
    };

    // Fetch all active segments ordered by priority desc
    const segments = await this.prisma.customerSegment.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    const matchedSegments: {
      segmentId: string;
      segmentCode: string;
      segmentName: string;
      segmentType: string;
      priority: number;
      score: number;
      mappedSchemeIds: string[] | null;
      offerPriority: string;
      maxOffersToShow: number;
    }[] = [];

    for (const segment of segments) {
      const rules = (segment.rules as unknown as SegmentRule[]) ?? [];
      if (rules.length === 0) continue;

      let matchedCount = 0;
      for (const rule of rules) {
        if (evaluateRule(rule, context)) matchedCount++;
      }

      const score = (matchedCount / rules.length) * 100;
      const allMatch = matchedCount === rules.length;

      if (allMatch) {
        // Upsert membership
        await this.prisma.customerSegmentMember.upsert({
          where: { segmentId_customerId: { segmentId: segment.id, customerId } },
          create: {
            segmentId: segment.id,
            customerId,
            applicationId: applicationId ?? null,
            assignedBy: 'SYSTEM',
            isActive: true,
            score: score.toFixed(2),
            metadata: {
              contextSnapshot: {
                age: context.customer.age,
                employmentType: context.customer.employmentType,
                monthlyIncomePaisa: context.customer.monthlyIncomePaisa,
                bureauScore: context.bureau.score,
                existingLoanCount: context.loan.existingLoanCount,
                maxDpd: context.loan.maxDpd,
              },
            },
          },
          update: {
            isActive: true,
            score: score.toFixed(2),
            applicationId: applicationId ?? undefined,
            metadata: {
              contextSnapshot: {
                age: context.customer.age,
                employmentType: context.customer.employmentType,
                monthlyIncomePaisa: context.customer.monthlyIncomePaisa,
                bureauScore: context.bureau.score,
                existingLoanCount: context.loan.existingLoanCount,
                maxDpd: context.loan.maxDpd,
              },
            },
          },
        });

        matchedSegments.push({
          segmentId: segment.id,
          segmentCode: segment.segmentCode,
          segmentName: segment.segmentName,
          segmentType: segment.segmentType,
          priority: segment.priority,
          score,
          mappedSchemeIds: (segment.mappedSchemeIds as string[] | null) ?? null,
          offerPriority: segment.offerPriority,
          maxOffersToShow: segment.maxOffersToShow,
        });
      }
    }

    return {
      customerId,
      matchedSegmentCount: matchedSegments.length,
      matchedSegments,
      evaluationContext: context,
    };
  }

  // ── 7. Get Customer Segments ──────────────────────────────────────────────

  async getCustomerSegments(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const memberships = await this.prisma.customerSegmentMember.findMany({
      where: { customerId, isActive: true },
      include: {
        segment: {
          select: {
            id: true,
            segmentCode: true,
            segmentName: true,
            segmentType: true,
            priority: true,
            mappedSchemeIds: true,
            offerPriority: true,
            maxOffersToShow: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return {
      customerId,
      segmentCount: memberships.length,
      segments: memberships.map((m) => ({
        ...m.segment,
        assignedAt: m.assignedAt,
        score: m.score,
        assignedBy: m.assignedBy,
      })),
    };
  }

  // ── 8. Get Eligible Offers For Application (LOS Integration) ─────────────

  async getEligibleOffersForApplication(orgId: string, applicationId: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: { customer: true },
    });
    if (!application) throw new NotFoundException(`Application ${applicationId} not found`);

    const { matchedSegments } = await this.evaluateCustomer(
      orgId,
      application.customerId,
      applicationId,
    );

    if (matchedSegments.length === 0) {
      return {
        applicationId,
        customerId: application.customerId,
        segments: [],
        eligibleSchemes: [],
        recommendedScheme: null,
      };
    }

    // Gather all mapped scheme IDs from matched segments
    const schemeIdSet = new Set<string>();
    for (const seg of matchedSegments) {
      if (seg.mappedSchemeIds) {
        for (const id of seg.mappedSchemeIds) schemeIdSet.add(id);
      }
    }

    if (schemeIdSet.size === 0) {
      return {
        applicationId,
        customerId: application.customerId,
        segments: matchedSegments,
        eligibleSchemes: [],
        recommendedScheme: null,
      };
    }

    const now = new Date();
    const schemes = await this.prisma.scheme.findMany({
      where: {
        id: { in: Array.from(schemeIdSet) },
        organizationId: orgId,
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
        OR: [
          { maxDisbursementCount: null },
          // Use raw comparison: currentDisbursementCount < maxDisbursementCount
        ],
      },
    });

    // Filter out exhausted budget
    const validSchemes = schemes.filter((s) => {
      if (s.maxDisbursementCount !== null && s.currentDisbursementCount >= s.maxDisbursementCount) {
        return false;
      }
      return true;
    });

    // Sort based on top segment's offerPriority
    const topSegment = matchedSegments[0];
    const sorted = this._sortSchemes(validSchemes, topSegment.offerPriority);

    // Limit by maxOffersToShow of the top segment
    const limited = sorted.slice(0, topSegment.maxOffersToShow);

    return {
      applicationId,
      customerId: application.customerId,
      segments: matchedSegments.map((s) => ({
        segmentId: s.segmentId,
        segmentCode: s.segmentCode,
        segmentName: s.segmentName,
        segmentType: s.segmentType,
        priority: s.priority,
        score: s.score,
      })),
      eligibleSchemes: limited.map((s) => ({
        id: s.id,
        schemeCode: s.schemeCode,
        schemeName: s.schemeName,
        schemeType: s.schemeType,
        description: s.description,
        interestRateDiscountBps: s.interestRateDiscountBps,
        fixedInterestRateBps: s.fixedInterestRateBps,
        processingFeeWaiver: s.processingFeeWaiver,
        processingFeeDiscountPercent: s.processingFeeDiscountPercent,
        cashbackAmountPaisa: s.cashbackAmountPaisa,
        cashbackCondition: s.cashbackCondition,
        validFrom: s.validFrom,
        validTo: s.validTo,
        budgetRemaining:
          s.maxDisbursementCount !== null
            ? s.maxDisbursementCount - s.currentDisbursementCount
            : null,
      })),
      recommendedScheme: limited.length > 0
        ? {
            id: limited[0].id,
            schemeCode: limited[0].schemeCode,
            schemeName: limited[0].schemeName,
            schemeType: limited[0].schemeType,
          }
        : null,
    };
  }

  // ── 9. Bulk Segment All Customers (Batch Job) ─────────────────────────────

  async bulkSegmentCustomers(orgId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    let processed = 0;
    let matched = 0;
    let errors = 0;

    for (const customer of customers) {
      try {
        const result = await this.evaluateCustomer(orgId, customer.id);
        matched += result.matchedSegmentCount;
        processed++;
      } catch {
        errors++;
      }
    }

    return {
      orgId,
      totalCustomers: customers.length,
      processed,
      totalNewAssignments: matched,
      errors,
      completedAt: new Date().toISOString(),
    };
  }

  // ── 10. Segment Report ────────────────────────────────────────────────────

  async getSegmentReport(orgId: string) {
    const segments = await this.prisma.customerSegment.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: { where: { isActive: true } } } },
      },
      orderBy: { priority: 'desc' },
    });

    // Count segmented customers who have taken loans (conversion)
    const segmentStats = await Promise.all(
      segments.map(async (seg) => {
        const memberCustomerIds = await this.prisma.customerSegmentMember.findMany({
          where: { segmentId: seg.id, isActive: true },
          select: { customerId: true },
        });
        const ids = memberCustomerIds.map((m) => m.customerId);

        const loanCount = ids.length > 0
          ? await this.prisma.loan.count({ where: { customerId: { in: ids }, organizationId: orgId } })
          : 0;

        const disbursedSum = ids.length > 0
          ? await this.prisma.loan.aggregate({
              where: { customerId: { in: ids }, organizationId: orgId },
              _sum: { disbursedAmountPaisa: true },
            })
          : { _sum: { disbursedAmountPaisa: 0 } };

        const memberCount = seg._count.members;
        return {
          segmentId: seg.id,
          segmentCode: seg.segmentCode,
          segmentName: seg.segmentName,
          segmentType: seg.segmentType,
          priority: seg.priority,
          isActive: seg.isActive,
          memberCount,
          loanCount,
          conversionRate: memberCount > 0 ? ((loanCount / memberCount) * 100).toFixed(1) : '0.0',
          totalDisbursedPaisa: disbursedSum._sum.disbursedAmountPaisa ?? 0,
          totalDisbursedRupees:
            ((disbursedSum._sum.disbursedAmountPaisa ?? 0) / 100).toFixed(2),
        };
      }),
    );

    return {
      orgId,
      totalSegments: segments.length,
      activeSegments: segments.filter((s) => s.isActive).length,
      segments: segmentStats,
    };
  }

  // ── 11. Remove From Segment (Manual) ─────────────────────────────────────

  async removeFromSegment(orgId: string, segmentId: string, customerId: string) {
    await this._findSegmentOrThrow(orgId, segmentId);

    const member = await this.prisma.customerSegmentMember.findUnique({
      where: { segmentId_customerId: { segmentId, customerId } },
    });
    if (!member) throw new NotFoundException('Customer is not in this segment');

    return this.prisma.customerSegmentMember.update({
      where: { segmentId_customerId: { segmentId, customerId } },
      data: { isActive: false, assignedBy: 'MANUAL_REMOVE' },
    });
  }

  // ── 12. Add To Segment (Manual) ───────────────────────────────────────────

  async addToSegment(orgId: string, segmentId: string, customerId: string, userId: string) {
    await this._findSegmentOrThrow(orgId, segmentId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    return this.prisma.customerSegmentMember.upsert({
      where: { segmentId_customerId: { segmentId, customerId } },
      create: {
        segmentId,
        customerId,
        assignedBy: userId,
        isActive: true,
        score: null,
        metadata: { manuallyAdded: true },
      },
      update: { isActive: true, assignedBy: userId },
    });
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private async _findSegmentOrThrow(orgId: string, segmentId: string) {
    const seg = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, organizationId: orgId },
    });
    if (!seg) throw new NotFoundException(`Segment ${segmentId} not found`);
    return seg;
  }

  private _sortSchemes(schemes: any[], offerPriority: string): any[] {
    switch (offerPriority) {
      case 'BEST_RATE':
        return [...schemes].sort((a, b) => {
          const aDiscount = a.interestRateDiscountBps ?? 0;
          const bDiscount = b.interestRateDiscountBps ?? 0;
          return bDiscount - aDiscount; // higher discount first
        });

      case 'LOWEST_FEE':
        return [...schemes].sort((a, b) => {
          const aFee = a.processingFeeWaiver ? 1 : 0;
          const bFee = b.processingFeeWaiver ? 1 : 0;
          return bFee - aFee;
        });

      case 'HIGHEST_CASHBACK':
        return [...schemes].sort(
          (a, b) => (b.cashbackAmountPaisa ?? 0) - (a.cashbackAmountPaisa ?? 0),
        );

      default: // MANUAL — preserve DB order
        return schemes;
    }
  }
}
