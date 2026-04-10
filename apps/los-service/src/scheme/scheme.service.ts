import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { UpdateSchemeDto } from './dto/update-scheme.dto';
import { FilterSchemeDto } from './dto/filter-scheme.dto';
import { ApplySchemeDto } from './dto/apply-scheme.dto';

@Injectable()
export class SchemeService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Create Scheme ────────────────────────────────────────────────────────

  async createScheme(
    orgId: string,
    userId: string,
    dto: CreateSchemeDto,
  ): Promise<object> {
    const validFrom = new Date(dto.validFrom);
    const validTo = new Date(dto.validTo);

    if (validFrom >= validTo) {
      throw new BadRequestException('validFrom must be before validTo');
    }

    // Validate productId belongs to org
    if (dto.productId) {
      const product = await this.prisma.loanProduct.findFirst({
        where: { id: dto.productId, organizationId: orgId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found in org`);
      }
    }

    const scheme = await this.prisma.scheme.create({
      data: {
        organizationId: orgId,
        productId: dto.productId ?? null,
        schemeCode: dto.schemeCode,
        schemeName: dto.schemeName,
        description: dto.description ?? null,
        schemeType: dto.schemeType,
        validFrom,
        validTo,
        isActive: dto.isActive ?? true,
        // Eligibility
        minCibilScore: dto.minCibilScore ?? null,
        maxCibilScore: dto.maxCibilScore ?? null,
        minAmountPaisa: dto.minAmountPaisa ?? null,
        maxAmountPaisa: dto.maxAmountPaisa ?? null,
        minTenureMonths: dto.minTenureMonths ?? null,
        maxTenureMonths: dto.maxTenureMonths ?? null,
        eligibleEmploymentTypes: dto.eligibleEmploymentTypes ?? undefined,
        eligibleCustomerTypes: dto.eligibleCustomerTypes ?? undefined,
        minAgeDays: dto.minAgeDays ?? null,
        maxAgeDays: dto.maxAgeDays ?? null,
        eligibleBranches: dto.eligibleBranches ?? undefined,
        eligibleDsas: dto.eligibleDsas ?? undefined,
        eligibilityCriteria: dto.eligibilityCriteria ?? undefined,
        // Benefits
        interestRateDiscountBps: dto.interestRateDiscountBps ?? null,
        fixedInterestRateBps: dto.fixedInterestRateBps ?? null,
        processingFeeDiscountPercent:
          dto.processingFeeDiscountPercent != null
            ? dto.processingFeeDiscountPercent.toString()
            : null,
        processingFeeWaiver: dto.processingFeeWaiver ?? false,
        stampDutyWaiver: dto.stampDutyWaiver ?? false,
        insuranceDiscount:
          dto.insuranceDiscount != null
            ? dto.insuranceDiscount.toString()
            : null,
        cashbackAmountPaisa: dto.cashbackAmountPaisa ?? null,
        cashbackCondition: dto.cashbackCondition ?? null,
        topUpEligibleAfterMonths: dto.topUpEligibleAfterMonths ?? null,
        balanceTransferMaxDays: dto.balanceTransferMaxDays ?? null,
        additionalBenefits: dto.additionalBenefits ?? undefined,
        // Limits
        maxDisbursementCount: dto.maxDisbursementCount ?? null,
        maxDisbursementAmountPaisa: dto.maxDisbursementAmountPaisa ?? null,
        maxPerBranchCount: dto.maxPerBranchCount ?? null,
        maxPerDsaCount: dto.maxPerDsaCount ?? null,
        // Approval
        requiresApproval: dto.requiresApproval ?? false,
        approvalAuthority: dto.approvalAuthority ?? null,
        // Tracking
        createdBy: userId,
      },
    });

    return this.formatScheme(scheme);
  }

  // ── 2. Update Scheme ────────────────────────────────────────────────────────

  async updateScheme(
    orgId: string,
    userId: string,
    schemeId: string,
    dto: UpdateSchemeDto,
  ): Promise<object> {
    const existing = await this.prisma.scheme.findFirst({
      where: { id: schemeId, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Scheme ${schemeId} not found`);
    }

    const now = new Date();
    if (existing.validTo < now && !dto.validTo) {
      throw new BadRequestException(
        'Cannot update an expired scheme without extending the validTo date',
      );
    }

    if (dto.productId) {
      const product = await this.prisma.loanProduct.findFirst({
        where: { id: dto.productId, organizationId: orgId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found in org`);
      }
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const validTo = dto.validTo ? new Date(dto.validTo) : existing.validTo;

    if (validFrom >= validTo) {
      throw new BadRequestException('validFrom must be before validTo');
    }

    const scheme = await this.prisma.scheme.update({
      where: { id: schemeId },
      data: {
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.schemeCode && { schemeCode: dto.schemeCode }),
        ...(dto.schemeName && { schemeName: dto.schemeName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.schemeType && { schemeType: dto.schemeType }),
        validFrom,
        validTo,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.minCibilScore !== undefined && { minCibilScore: dto.minCibilScore }),
        ...(dto.maxCibilScore !== undefined && { maxCibilScore: dto.maxCibilScore }),
        ...(dto.minAmountPaisa !== undefined && { minAmountPaisa: dto.minAmountPaisa }),
        ...(dto.maxAmountPaisa !== undefined && { maxAmountPaisa: dto.maxAmountPaisa }),
        ...(dto.minTenureMonths !== undefined && { minTenureMonths: dto.minTenureMonths }),
        ...(dto.maxTenureMonths !== undefined && { maxTenureMonths: dto.maxTenureMonths }),
        ...(dto.eligibleEmploymentTypes !== undefined && {
          eligibleEmploymentTypes: dto.eligibleEmploymentTypes,
        }),
        ...(dto.eligibleCustomerTypes !== undefined && {
          eligibleCustomerTypes: dto.eligibleCustomerTypes,
        }),
        ...(dto.minAgeDays !== undefined && { minAgeDays: dto.minAgeDays }),
        ...(dto.maxAgeDays !== undefined && { maxAgeDays: dto.maxAgeDays }),
        ...(dto.eligibleBranches !== undefined && {
          eligibleBranches: dto.eligibleBranches,
        }),
        ...(dto.eligibleDsas !== undefined && { eligibleDsas: dto.eligibleDsas }),
        ...(dto.eligibilityCriteria !== undefined && {
          eligibilityCriteria: dto.eligibilityCriteria,
        }),
        ...(dto.interestRateDiscountBps !== undefined && {
          interestRateDiscountBps: dto.interestRateDiscountBps,
        }),
        ...(dto.fixedInterestRateBps !== undefined && {
          fixedInterestRateBps: dto.fixedInterestRateBps,
        }),
        ...(dto.processingFeeDiscountPercent !== undefined && {
          processingFeeDiscountPercent:
            dto.processingFeeDiscountPercent != null
              ? dto.processingFeeDiscountPercent.toString()
              : null,
        }),
        ...(dto.processingFeeWaiver !== undefined && {
          processingFeeWaiver: dto.processingFeeWaiver,
        }),
        ...(dto.stampDutyWaiver !== undefined && {
          stampDutyWaiver: dto.stampDutyWaiver,
        }),
        ...(dto.insuranceDiscount !== undefined && {
          insuranceDiscount:
            dto.insuranceDiscount != null ? dto.insuranceDiscount.toString() : null,
        }),
        ...(dto.cashbackAmountPaisa !== undefined && {
          cashbackAmountPaisa: dto.cashbackAmountPaisa,
        }),
        ...(dto.cashbackCondition !== undefined && {
          cashbackCondition: dto.cashbackCondition,
        }),
        ...(dto.topUpEligibleAfterMonths !== undefined && {
          topUpEligibleAfterMonths: dto.topUpEligibleAfterMonths,
        }),
        ...(dto.balanceTransferMaxDays !== undefined && {
          balanceTransferMaxDays: dto.balanceTransferMaxDays,
        }),
        ...(dto.additionalBenefits !== undefined && {
          additionalBenefits: dto.additionalBenefits,
        }),
        ...(dto.maxDisbursementCount !== undefined && {
          maxDisbursementCount: dto.maxDisbursementCount,
        }),
        ...(dto.maxDisbursementAmountPaisa !== undefined && {
          maxDisbursementAmountPaisa: dto.maxDisbursementAmountPaisa,
        }),
        ...(dto.maxPerBranchCount !== undefined && {
          maxPerBranchCount: dto.maxPerBranchCount,
        }),
        ...(dto.maxPerDsaCount !== undefined && {
          maxPerDsaCount: dto.maxPerDsaCount,
        }),
        ...(dto.requiresApproval !== undefined && {
          requiresApproval: dto.requiresApproval,
        }),
        ...(dto.approvalAuthority !== undefined && {
          approvalAuthority: dto.approvalAuthority,
        }),
        updatedBy: userId,
      },
    });

    return this.formatScheme(scheme);
  }

  // ── 3. List Schemes ─────────────────────────────────────────────────────────

  async listSchemes(orgId: string, filters: FilterSchemeDto): Promise<object> {
    const now = new Date();

    const where: Record<string, unknown> = { organizationId: orgId };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.schemeType) {
      where.schemeType = filters.schemeType;
    }
    if (filters.current) {
      where.validFrom = { lte: now };
      where.validTo = { gte: now };
    }

    const schemes = await this.prisma.scheme.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, productType: true } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ isActive: 'desc' }, { validFrom: 'desc' }],
    });

    return {
      data: schemes.map((s) => this.formatSchemeWithStats(s, now)),
      total: schemes.length,
    };
  }

  // ── 4. Get Single Scheme ────────────────────────────────────────────────────

  async getScheme(orgId: string, schemeId: string): Promise<object> {
    const scheme = await this.prisma.scheme.findFirst({
      where: { id: schemeId, organizationId: orgId },
      include: {
        product: { select: { id: true, name: true, productType: true } },
        _count: { select: { applications: true } },
      },
    });

    if (!scheme) {
      throw new NotFoundException(`Scheme ${schemeId} not found`);
    }

    return this.formatSchemeWithStats(scheme, new Date());
  }

  // ── 5. Deactivate Scheme ────────────────────────────────────────────────────

  async deactivateScheme(
    orgId: string,
    userId: string,
    schemeId: string,
  ): Promise<object> {
    const existing = await this.prisma.scheme.findFirst({
      where: { id: schemeId, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Scheme ${schemeId} not found`);
    }

    const scheme = await this.prisma.scheme.update({
      where: { id: schemeId },
      data: { isActive: false, updatedBy: userId },
    });

    return { message: 'Scheme deactivated', schemeId: scheme.id };
  }

  // ── 6. Find Eligible Schemes for Application ────────────────────────────────

  async findEligibleSchemes(
    orgId: string,
    applicationId: string,
  ): Promise<object> {
    // Load application with all needed data
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: {
        customer: {
          select: {
            id: true,
            dob: true,
            employmentType: true,
            customerType: true,
          },
        },
        product: { select: { id: true } },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    // Fetch latest bureau response for CIBIL score
    const latestBureau = await this.prisma.bureauResponse.findFirst({
      where: { applicationId },
      orderBy: { id: 'desc' },
      select: { score: true },
    });
    const cibilScore = latestBureau?.score ?? null;

    const now = new Date();

    // Load all active, currently valid schemes for this org
    const schemes = await this.prisma.scheme.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      include: {
        product: { select: { id: true, name: true, productType: true } },
      },
    });

    const eligible: object[] = [];

    for (const scheme of schemes) {
      // Product check
      if (
        scheme.productId &&
        scheme.productId !== application.productId
      ) {
        continue;
      }

      // CIBIL score range
      if (scheme.minCibilScore !== null && cibilScore !== null) {
        if (cibilScore < scheme.minCibilScore) continue;
      }
      if (scheme.maxCibilScore !== null && cibilScore !== null) {
        if (cibilScore > scheme.maxCibilScore) continue;
      }

      // Loan amount range
      if (
        scheme.minAmountPaisa !== null &&
        application.requestedAmountPaisa < scheme.minAmountPaisa
      ) {
        continue;
      }
      if (
        scheme.maxAmountPaisa !== null &&
        application.requestedAmountPaisa > scheme.maxAmountPaisa
      ) {
        continue;
      }

      // Tenure range
      if (
        scheme.minTenureMonths !== null &&
        application.requestedTenureMonths < scheme.minTenureMonths
      ) {
        continue;
      }
      if (
        scheme.maxTenureMonths !== null &&
        application.requestedTenureMonths > scheme.maxTenureMonths
      ) {
        continue;
      }

      // Employment type
      if (scheme.eligibleEmploymentTypes) {
        const types = scheme.eligibleEmploymentTypes as string[];
        if (
          types.length > 0 &&
          !types.includes(application.customer.employmentType)
        ) {
          continue;
        }
      }

      // Customer type
      if (scheme.eligibleCustomerTypes) {
        const ctypes = scheme.eligibleCustomerTypes as string[];
        if (ctypes.length > 0 && !ctypes.includes(application.customer.customerType)) {
          continue;
        }
      }

      // Customer age in days
      if (application.customer.dob) {
        const dobDate = new Date(application.customer.dob);
        const ageInDays = Math.floor(
          (now.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (scheme.minAgeDays !== null && ageInDays < scheme.minAgeDays) {
          continue;
        }
        if (scheme.maxAgeDays !== null && ageInDays > scheme.maxAgeDays) {
          continue;
        }
      }

      // Branch eligibility
      if (scheme.eligibleBranches) {
        const branches = scheme.eligibleBranches as string[];
        if (
          branches.length > 0 &&
          !branches.includes(application.branchId)
        ) {
          continue;
        }
      }

      // DSA eligibility
      if (scheme.eligibleDsas) {
        const dsas = scheme.eligibleDsas as string[];
        if (
          dsas.length > 0 &&
          (!application.dsaId || !dsas.includes(application.dsaId))
        ) {
          continue;
        }
      }

      // Budget checks
      if (
        scheme.maxDisbursementCount !== null &&
        scheme.currentDisbursementCount >= scheme.maxDisbursementCount
      ) {
        continue;
      }
      if (
        scheme.maxDisbursementAmountPaisa !== null &&
        BigInt(scheme.currentDisbursementAmountPaisa) >=
          scheme.maxDisbursementAmountPaisa
      ) {
        continue;
      }

      eligible.push(this.formatScheme(scheme));
    }

    // Sort by best benefit: highest rate discount first
    const sorted = (eligible as Array<{ interestRateDiscountBps?: number | null }>).sort(
      (a, b) =>
        ((b.interestRateDiscountBps as number) || 0) -
        ((a.interestRateDiscountBps as number) || 0),
    );

    return {
      applicationId,
      eligibleSchemes: sorted,
      count: sorted.length,
    };
  }

  // ── 7. Apply Scheme to Application ─────────────────────────────────────────

  async applyScheme(
    orgId: string,
    applicationId: string,
    dto: ApplySchemeDto,
  ): Promise<object> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: { customer: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const scheme = await this.prisma.scheme.findFirst({
      where: { id: dto.schemeId, organizationId: orgId },
    });
    if (!scheme) {
      throw new NotFoundException(`Scheme ${dto.schemeId} not found`);
    }

    // Check unique constraint
    const existing = await this.prisma.schemeApplication.findFirst({
      where: { schemeId: dto.schemeId, applicationId },
    });
    if (existing) {
      throw new ConflictException(
        'This scheme is already applied to this application',
      );
    }

    const now = new Date();
    if (!scheme.isActive) {
      throw new BadRequestException('Scheme is not active');
    }
    if (scheme.validTo < now) {
      throw new BadRequestException('Scheme has expired');
    }
    if (scheme.validFrom > now) {
      throw new BadRequestException('Scheme has not started yet');
    }

    // Build benefits snapshot
    const benefitsApplied: Record<string, unknown> = {};

    if (scheme.interestRateDiscountBps !== null) {
      benefitsApplied.interestRateDiscountBps = scheme.interestRateDiscountBps;
      benefitsApplied.interestRateDiscountPercent =
        scheme.interestRateDiscountBps / 100;
    }
    if (scheme.fixedInterestRateBps !== null) {
      benefitsApplied.fixedInterestRateBps = scheme.fixedInterestRateBps;
      benefitsApplied.fixedInterestRatePercent =
        scheme.fixedInterestRateBps / 100;
    }
    if (scheme.processingFeeWaiver) {
      benefitsApplied.processingFeeWaiver = true;
      benefitsApplied.processingFeeDiscountPercent = 100;
    } else if (scheme.processingFeeDiscountPercent !== null) {
      benefitsApplied.processingFeeDiscountPercent = Number(
        scheme.processingFeeDiscountPercent,
      );
    }
    if (scheme.stampDutyWaiver) {
      benefitsApplied.stampDutyWaiver = true;
    }
    if (scheme.cashbackAmountPaisa !== null) {
      benefitsApplied.cashbackAmountPaisa = scheme.cashbackAmountPaisa;
      benefitsApplied.cashbackAmountRupees = scheme.cashbackAmountPaisa / 100;
      benefitsApplied.cashbackCondition = scheme.cashbackCondition;
    }
    if (scheme.insuranceDiscount !== null) {
      benefitsApplied.insuranceDiscountPercent = Number(scheme.insuranceDiscount);
    }
    if (scheme.additionalBenefits) {
      benefitsApplied.additionalBenefits = scheme.additionalBenefits;
    }

    const cashbackStatus = scheme.cashbackAmountPaisa ? 'PENDING' : null;

    const schemeApp = await this.prisma.schemeApplication.create({
      data: {
        schemeId: dto.schemeId,
        applicationId,
        benefitsApplied,
        cashbackStatus,
      },
    });

    return {
      schemeApplicationId: schemeApp.id,
      schemeId: scheme.id,
      schemeCode: scheme.schemeCode,
      schemeName: scheme.schemeName,
      applicationId,
      benefitsApplied,
      cashbackStatus,
      createdAt: schemeApp.createdAt,
    };
  }

  // ── 8. Remove Scheme from Application ──────────────────────────────────────

  async removeScheme(orgId: string, applicationId: string): Promise<object> {
    // Verify application belongs to org
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const schemeApps = await this.prisma.schemeApplication.findMany({
      where: { applicationId },
    });

    if (schemeApps.length === 0) {
      throw new NotFoundException(`No scheme applied to application ${applicationId}`);
    }

    await this.prisma.schemeApplication.deleteMany({
      where: { applicationId },
    });

    return {
      message: `Scheme(s) removed from application ${applicationId}`,
      removedCount: schemeApps.length,
    };
  }

  // ── 9. Update Utilization (called post-disbursement) ───────────────────────

  async updateUtilization(
    orgId: string,
    schemeId: string,
    amountPaisa: number,
  ): Promise<void> {
    const scheme = await this.prisma.scheme.findFirst({
      where: { id: schemeId, organizationId: orgId },
    });
    if (!scheme) return;

    await this.prisma.scheme.update({
      where: { id: schemeId },
      data: {
        currentDisbursementCount: { increment: 1 },
        currentDisbursementAmountPaisa: {
          increment: BigInt(amountPaisa),
        },
      },
    });
  }

  // ── 10. Process Cashbacks (cron job) ────────────────────────────────────────

  async processCashbacks(orgId: string): Promise<object> {
    const pendingCashbacks = await this.prisma.schemeApplication.findMany({
      where: {
        cashbackStatus: 'PENDING',
        scheme: { organizationId: orgId },
      },
      include: {
        scheme: {
          select: {
            cashbackCondition: true,
            cashbackAmountPaisa: true,
            organizationId: true,
          },
        },
      },
    });

    let eligible = 0;
    let processed = 0;

    for (const sa of pendingCashbacks) {
      if (!sa.loanId || !sa.scheme.cashbackCondition) continue;

      let conditionMet = false;

      const condition = sa.scheme.cashbackCondition;

      if (condition === 'AT_DISBURSAL') {
        conditionMet = true;
      } else {
        // Count paid installments
        const emiCountMatch = condition.match(/AFTER_(\d+)_EMI_PAID/);
        if (emiCountMatch) {
          const requiredEMIs = parseInt(emiCountMatch[1], 10);
          const paidCount = await this.prisma.loanSchedule.count({
            where: {
              loanId: sa.loanId,
              status: { in: ['PAID'] },
            },
          });
          conditionMet = paidCount >= requiredEMIs;
        }
      }

      if (conditionMet) {
        await this.prisma.schemeApplication.update({
          where: { id: sa.id },
          data: { cashbackStatus: 'ELIGIBLE' },
        });
        eligible++;
      }
      processed++;
    }

    return {
      processed,
      eligibleForCashback: eligible,
      orgId,
      processedAt: new Date().toISOString(),
    };
  }

  // ── 11. Scheme MIS Report ───────────────────────────────────────────────────

  async getSchemeReport(
    orgId: string,
    filters: { schemeType?: string; from?: string; to?: string },
  ): Promise<object> {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (filters.schemeType) {
      where.schemeType = filters.schemeType;
    }

    const schemes = await this.prisma.scheme.findMany({
      where,
      include: {
        product: { select: { name: true } },
        applications: {
          include: {
            application: {
              include: {
                loans: {
                  select: {
                    disbursedAmountPaisa: true,
                    interestRateBps: true,
                    branchId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const report = schemes.map((scheme) => {
      const disbursedLoans = scheme.applications
        .flatMap((sa) => sa.application.loans)
        .filter(Boolean);

      const totalDisbursedAmountPaisa = disbursedLoans.reduce(
        (sum, l) => sum + l.disbursedAmountPaisa,
        0,
      );

      const avgRateBps =
        disbursedLoans.length > 0
          ? disbursedLoans.reduce((sum, l) => sum + l.interestRateBps, 0) /
            disbursedLoans.length
          : null;

      const budgetUtilizationCount =
        scheme.maxDisbursementCount
          ? (scheme.currentDisbursementCount / scheme.maxDisbursementCount) * 100
          : null;

      const budgetUtilizationAmount =
        scheme.maxDisbursementAmountPaisa
          ? (Number(scheme.currentDisbursementAmountPaisa) /
              Number(scheme.maxDisbursementAmountPaisa)) *
            100
          : null;

      const totalCashbackLiabilityPaisa =
        scheme.cashbackAmountPaisa !== null
          ? scheme.cashbackAmountPaisa * scheme.applications.length
          : 0;

      const eligibleCashbackPaisa =
        scheme.cashbackAmountPaisa !== null
          ? scheme.cashbackAmountPaisa *
            scheme.applications.filter((sa) => sa.cashbackStatus === 'ELIGIBLE')
              .length
          : 0;

      return {
        schemeId: scheme.id,
        schemeCode: scheme.schemeCode,
        schemeName: scheme.schemeName,
        schemeType: scheme.schemeType,
        product: scheme.product?.name ?? 'All Products',
        validFrom: scheme.validFrom,
        validTo: scheme.validTo,
        isActive: scheme.isActive,
        applications: {
          total: scheme.applications.length,
          disbursed: disbursedLoans.length,
        },
        disbursement: {
          count: scheme.currentDisbursementCount,
          amountPaisa: Number(scheme.currentDisbursementAmountPaisa),
          amountRupees: Number(scheme.currentDisbursementAmountPaisa) / 100,
        },
        averageInterestRateBps: avgRateBps,
        averageInterestRatePercent: avgRateBps ? avgRateBps / 100 : null,
        interestRateDiscountBps: scheme.interestRateDiscountBps,
        budgetUtilization: {
          byCount: budgetUtilizationCount
            ? Math.round(budgetUtilizationCount * 100) / 100
            : null,
          byAmount: budgetUtilizationAmount
            ? Math.round(budgetUtilizationAmount * 100) / 100
            : null,
        },
        cashback: {
          perLoanPaisa: scheme.cashbackAmountPaisa,
          perLoanRupees: scheme.cashbackAmountPaisa
            ? scheme.cashbackAmountPaisa / 100
            : null,
          totalLiabilityPaisa: totalCashbackLiabilityPaisa,
          totalLiabilityRupees: totalCashbackLiabilityPaisa / 100,
          eligiblePaisa: eligibleCashbackPaisa,
          eligibleRupees: eligibleCashbackPaisa / 100,
          pendingCount: scheme.applications.filter(
            (sa) => sa.cashbackStatus === 'PENDING',
          ).length,
          eligibleCount: scheme.applications.filter(
            (sa) => sa.cashbackStatus === 'ELIGIBLE',
          ).length,
          paidCount: scheme.applications.filter(
            (sa) => sa.cashbackStatus === 'PAID',
          ).length,
        },
      };
    });

    return {
      data: report,
      total: report.length,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private formatScheme(scheme: Record<string, unknown>): Record<string, unknown> {
    return {
      id: scheme.id,
      organizationId: scheme.organizationId,
      productId: scheme.productId,
      schemeCode: scheme.schemeCode,
      schemeName: scheme.schemeName,
      description: scheme.description,
      schemeType: scheme.schemeType,
      validFrom: scheme.validFrom,
      validTo: scheme.validTo,
      isActive: scheme.isActive,
      eligibility: {
        minCibilScore: scheme.minCibilScore,
        maxCibilScore: scheme.maxCibilScore,
        minAmountPaisa: scheme.minAmountPaisa,
        maxAmountPaisa: scheme.maxAmountPaisa,
        minAmountRupees: scheme.minAmountPaisa
          ? (scheme.minAmountPaisa as number) / 100
          : null,
        maxAmountRupees: scheme.maxAmountPaisa
          ? (scheme.maxAmountPaisa as number) / 100
          : null,
        minTenureMonths: scheme.minTenureMonths,
        maxTenureMonths: scheme.maxTenureMonths,
        eligibleEmploymentTypes: scheme.eligibleEmploymentTypes,
        eligibleCustomerTypes: scheme.eligibleCustomerTypes,
        minAgeDays: scheme.minAgeDays,
        maxAgeDays: scheme.maxAgeDays,
        eligibleBranches: scheme.eligibleBranches,
        eligibleDsas: scheme.eligibleDsas,
        eligibilityCriteria: scheme.eligibilityCriteria,
      },
      benefits: {
        interestRateDiscountBps: scheme.interestRateDiscountBps,
        interestRateDiscountPercent: scheme.interestRateDiscountBps
          ? (scheme.interestRateDiscountBps as number) / 100
          : null,
        fixedInterestRateBps: scheme.fixedInterestRateBps,
        fixedInterestRatePercent: scheme.fixedInterestRateBps
          ? (scheme.fixedInterestRateBps as number) / 100
          : null,
        processingFeeDiscountPercent: scheme.processingFeeDiscountPercent
          ? Number(scheme.processingFeeDiscountPercent)
          : null,
        processingFeeWaiver: scheme.processingFeeWaiver,
        stampDutyWaiver: scheme.stampDutyWaiver,
        insuranceDiscount: scheme.insuranceDiscount
          ? Number(scheme.insuranceDiscount)
          : null,
        cashbackAmountPaisa: scheme.cashbackAmountPaisa,
        cashbackAmountRupees: scheme.cashbackAmountPaisa
          ? (scheme.cashbackAmountPaisa as number) / 100
          : null,
        cashbackCondition: scheme.cashbackCondition,
        topUpEligibleAfterMonths: scheme.topUpEligibleAfterMonths,
        balanceTransferMaxDays: scheme.balanceTransferMaxDays,
        additionalBenefits: scheme.additionalBenefits,
      },
      limits: {
        maxDisbursementCount: scheme.maxDisbursementCount,
        maxDisbursementAmountPaisa: scheme.maxDisbursementAmountPaisa
          ? Number(scheme.maxDisbursementAmountPaisa)
          : null,
        maxDisbursementAmountRupees: scheme.maxDisbursementAmountPaisa
          ? Number(scheme.maxDisbursementAmountPaisa) / 100
          : null,
        currentDisbursementCount: scheme.currentDisbursementCount,
        currentDisbursementAmountPaisa: Number(
          scheme.currentDisbursementAmountPaisa,
        ),
        currentDisbursementAmountRupees:
          Number(scheme.currentDisbursementAmountPaisa) / 100,
        maxPerBranchCount: scheme.maxPerBranchCount,
        maxPerDsaCount: scheme.maxPerDsaCount,
      },
      approval: {
        requiresApproval: scheme.requiresApproval,
        approvalAuthority: scheme.approvalAuthority,
      },
      createdBy: scheme.createdBy,
      updatedBy: scheme.updatedBy,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt,
    };
  }

  private formatSchemeWithStats(
    scheme: Record<string, unknown> & { _count?: { applications: number } },
    now: Date,
  ): Record<string, unknown> {
    const formatted = this.formatScheme(scheme);
    const validTo = scheme.validTo as Date;
    const validFrom = scheme.validFrom as Date;

    let status: string;
    if (!scheme.isActive) {
      status = 'INACTIVE';
    } else if (validTo < now) {
      status = 'EXPIRED';
    } else if (validFrom > now) {
      status = 'UPCOMING';
    } else {
      status = 'ACTIVE';
    }

    return {
      ...formatted,
      status,
      applicationCount: scheme._count
        ? (scheme._count as { applications: number }).applications
        : 0,
      product: scheme.product ?? null,
    };
  }
}
