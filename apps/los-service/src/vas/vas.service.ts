import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateFeeTemplateDto } from './dto/create-fee-template.dto';
import { UpdateFeeTemplateDto } from './dto/update-fee-template.dto';
import { FilterFeeTemplateDto } from './dto/filter-fee-template.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { WaiveFeeDto } from './dto/waive-fee.dto';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Slab {
  upToPaisa: number | null;
  flatPaisa?: number;
  percent?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Safe formula evaluator — supports simple arithmetic expressions.
 * Variables: loanAmount, tenure, rate, emiAmount (all in paisa / bps / months).
 * Returns paisa integer.
 */
function evaluateFormula(
  formula: string,
  ctx: {
    loanAmount: number;
    tenure: number;
    rate: number;
    emiAmount: number;
  },
): number {
  // Allow only digits, operators, spaces, parentheses, variable names, dots
  const allowed = /^[0-9+\-*/().\s_a-zA-Z]+$/;
  if (!allowed.test(formula)) {
    throw new BadRequestException(`Formula contains invalid characters: ${formula}`);
  }
  // Substitute variable names with their values
  const expr = formula
    .replace(/\bloanAmount\b/g, String(ctx.loanAmount))
    .replace(/\btenure\b/g, String(ctx.tenure))
    .replace(/\brate\b/g, String(ctx.rate))
    .replace(/\bemiAmount\b/g, String(ctx.emiAmount));

  // Final safety check: only digits and operators after substitution
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    throw new BadRequestException('Formula evaluation failed security check');
  }
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${expr})`)() as number;
  if (!isFinite(result) || result < 0) {
    throw new BadRequestException('Formula produced an invalid result');
  }
  return Math.round(result);
}

@Injectable()
export class VasService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Create Fee Template ─────────────────────────────────────────────────

  async createFeeTemplate(
    orgId: string,
    userId: string,
    dto: CreateFeeTemplateDto,
  ): Promise<object> {
    // Validate product IDs belong to org
    if (dto.productIds?.length) {
      const products = await this.prisma.loanProduct.findMany({
        where: { id: { in: dto.productIds }, organizationId: orgId },
        select: { id: true },
      });
      if (products.length !== dto.productIds.length) {
        throw new NotFoundException('One or more productIds not found in this organization');
      }
    }

    // Business-level validations
    if (dto.calculationType === 'FLAT' && dto.flatAmountPaisa == null) {
      throw new BadRequestException('flatAmountPaisa is required for FLAT calculation type');
    }
    if (dto.calculationType === 'PERCENTAGE') {
      if (dto.percentageValue == null) {
        throw new BadRequestException('percentageValue is required for PERCENTAGE calculation type');
      }
      if (!dto.percentageBase) {
        throw new BadRequestException('percentageBase is required for PERCENTAGE calculation type');
      }
    }
    if (dto.calculationType === 'SLAB' && (!dto.slabs || !dto.slabs.length)) {
      throw new BadRequestException('slabs are required for SLAB calculation type');
    }
    if (dto.calculationType === 'PER_UNIT' && dto.perUnitAmountPaisa == null) {
      throw new BadRequestException('perUnitAmountPaisa is required for PER_UNIT calculation type');
    }
    if (dto.calculationType === 'FORMULA' && !dto.formula) {
      throw new BadRequestException('formula is required for FORMULA calculation type');
    }

    const template = await this.prisma.feeTemplate.create({
      data: {
        organizationId: orgId,
        templateName: dto.templateName,
        feeCode: dto.feeCode,
        feeCategory: dto.feeCategory,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        // Applicability
        productIds: dto.productIds ? (dto.productIds as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        minAmountPaisa: dto.minAmountPaisa ?? null,
        maxAmountPaisa: dto.maxAmountPaisa ?? null,
        minRateBps: dto.minRateBps ?? null,
        maxRateBps: dto.maxRateBps ?? null,
        minTenureMonths: dto.minTenureMonths ?? null,
        maxTenureMonths: dto.maxTenureMonths ?? null,
        customerTypes: dto.customerTypes ? (dto.customerTypes as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        employmentTypes: dto.employmentTypes ? (dto.employmentTypes as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        sourceTypes: dto.sourceTypes ? (dto.sourceTypes as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        schemeIds: dto.schemeIds ? (dto.schemeIds as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        loanStatuses: dto.loanStatuses ? (dto.loanStatuses as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        triggerEvent: dto.triggerEvent ?? null,
        // Calculation
        calculationType: dto.calculationType,
        flatAmountPaisa: dto.flatAmountPaisa ?? null,
        percentageValue: dto.percentageValue != null ? new Decimal(dto.percentageValue) : null,
        percentageBase: dto.percentageBase ?? null,
        minCapPaisa: dto.minCapPaisa ?? null,
        maxCapPaisa: dto.maxCapPaisa ?? null,
        slabs: dto.slabs ? (dto.slabs as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        perUnitAmountPaisa: dto.perUnitAmountPaisa ?? null,
        unitType: dto.unitType ?? null,
        formula: dto.formula ?? null,
        // Tax
        gstApplicable: dto.gstApplicable ?? true,
        gstPercent: dto.gstPercent != null ? new Decimal(dto.gstPercent) : new Decimal(18),
        cessPercent: dto.cessPercent != null ? new Decimal(dto.cessPercent) : null,
        // Collection
        collectAt: dto.collectAt ?? 'DISBURSAL',
        deductFromDisbursement: dto.deductFromDisbursement ?? false,
        isRefundable: dto.isRefundable ?? false,
        refundCondition: dto.refundCondition ?? null,
        // Display
        displayOrder: dto.displayOrder ?? 0,
        showInSanctionLetter: dto.showInSanctionLetter ?? true,
        showInKFS: dto.showInKFS ?? true,
        isNegotiable: dto.isNegotiable ?? false,
        maxDiscountPercent: dto.maxDiscountPercent != null ? new Decimal(dto.maxDiscountPercent) : null,
        createdBy: userId,
      },
    });

    return this.serializeTemplate(template);
  }

  // ── 2. Update Fee Template ─────────────────────────────────────────────────

  async updateFeeTemplate(
    orgId: string,
    templateId: string,
    userId: string,
    dto: UpdateFeeTemplateDto,
  ): Promise<object> {
    const existing = await this.prisma.feeTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException(`FeeTemplate ${templateId} not found`);

    const data: Record<string, unknown> = { updatedBy: userId };

    if (dto.templateName !== undefined) data['templateName'] = dto.templateName;
    if (dto.feeCode !== undefined) data['feeCode'] = dto.feeCode;
    if (dto.feeCategory !== undefined) data['feeCategory'] = dto.feeCategory;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.productIds !== undefined) data['productIds'] = dto.productIds;
    if (dto.minAmountPaisa !== undefined) data['minAmountPaisa'] = dto.minAmountPaisa;
    if (dto.maxAmountPaisa !== undefined) data['maxAmountPaisa'] = dto.maxAmountPaisa;
    if (dto.minRateBps !== undefined) data['minRateBps'] = dto.minRateBps;
    if (dto.maxRateBps !== undefined) data['maxRateBps'] = dto.maxRateBps;
    if (dto.minTenureMonths !== undefined) data['minTenureMonths'] = dto.minTenureMonths;
    if (dto.maxTenureMonths !== undefined) data['maxTenureMonths'] = dto.maxTenureMonths;
    if (dto.customerTypes !== undefined) data['customerTypes'] = dto.customerTypes;
    if (dto.employmentTypes !== undefined) data['employmentTypes'] = dto.employmentTypes;
    if (dto.sourceTypes !== undefined) data['sourceTypes'] = dto.sourceTypes;
    if (dto.schemeIds !== undefined) data['schemeIds'] = dto.schemeIds;
    if (dto.loanStatuses !== undefined) data['loanStatuses'] = dto.loanStatuses;
    if (dto.triggerEvent !== undefined) data['triggerEvent'] = dto.triggerEvent;
    if (dto.calculationType !== undefined) data['calculationType'] = dto.calculationType;
    if (dto.flatAmountPaisa !== undefined) data['flatAmountPaisa'] = dto.flatAmountPaisa;
    if (dto.percentageValue !== undefined) data['percentageValue'] = dto.percentageValue != null ? new Decimal(dto.percentageValue) : null;
    if (dto.percentageBase !== undefined) data['percentageBase'] = dto.percentageBase;
    if (dto.minCapPaisa !== undefined) data['minCapPaisa'] = dto.minCapPaisa;
    if (dto.maxCapPaisa !== undefined) data['maxCapPaisa'] = dto.maxCapPaisa;
    if (dto.slabs !== undefined) data['slabs'] = dto.slabs;
    if (dto.perUnitAmountPaisa !== undefined) data['perUnitAmountPaisa'] = dto.perUnitAmountPaisa;
    if (dto.unitType !== undefined) data['unitType'] = dto.unitType;
    if (dto.formula !== undefined) data['formula'] = dto.formula;
    if (dto.gstApplicable !== undefined) data['gstApplicable'] = dto.gstApplicable;
    if (dto.gstPercent !== undefined) data['gstPercent'] = new Decimal(dto.gstPercent);
    if (dto.cessPercent !== undefined) data['cessPercent'] = dto.cessPercent != null ? new Decimal(dto.cessPercent) : null;
    if (dto.collectAt !== undefined) data['collectAt'] = dto.collectAt;
    if (dto.deductFromDisbursement !== undefined) data['deductFromDisbursement'] = dto.deductFromDisbursement;
    if (dto.isRefundable !== undefined) data['isRefundable'] = dto.isRefundable;
    if (dto.refundCondition !== undefined) data['refundCondition'] = dto.refundCondition;
    if (dto.displayOrder !== undefined) data['displayOrder'] = dto.displayOrder;
    if (dto.showInSanctionLetter !== undefined) data['showInSanctionLetter'] = dto.showInSanctionLetter;
    if (dto.showInKFS !== undefined) data['showInKFS'] = dto.showInKFS;
    if (dto.isNegotiable !== undefined) data['isNegotiable'] = dto.isNegotiable;
    if (dto.maxDiscountPercent !== undefined) data['maxDiscountPercent'] = dto.maxDiscountPercent != null ? new Decimal(dto.maxDiscountPercent) : null;

    const updated = await this.prisma.feeTemplate.update({
      where: { id: templateId },
      data,
    });

    return this.serializeTemplate(updated);
  }

  // ── 3. List Fee Templates ──────────────────────────────────────────────────

  async listFeeTemplates(
    orgId: string,
    filters: FilterFeeTemplateDto,
  ): Promise<object> {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (filters.feeCode) where['feeCode'] = filters.feeCode;
    if (filters.feeCategory) where['feeCategory'] = filters.feeCategory;
    if (filters.isActive !== undefined) where['isActive'] = filters.isActive;
    if (filters.calculationType) where['calculationType'] = filters.calculationType;
    if (filters.triggerEvent) where['triggerEvent'] = filters.triggerEvent;

    const templates = await this.prisma.feeTemplate.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { feeCode: 'asc' }],
      include: {
        _count: { select: { appliedFees: true } },
      },
    });

    // Filter by productId in memory (JSON field)
    let result = templates;
    if (filters.productId) {
      result = templates.filter((t) => {
        if (t.productIds == null) return true; // null = all products
        const ids = t.productIds as string[];
        return ids.includes(filters.productId!);
      });
    }

    return {
      data: result.map((t) => ({
        ...this.serializeTemplate(t),
        _usageCount: (t as Record<string, unknown>)['_count']
          ? ((t as Record<string, unknown>)['_count'] as { appliedFees: number }).appliedFees
          : 0,
      })),
      total: result.length,
    };
  }

  // ── 4. Get Fee Template ────────────────────────────────────────────────────

  async getFeeTemplate(orgId: string, templateId: string): Promise<object> {
    const template = await this.prisma.feeTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
      include: {
        _count: { select: { appliedFees: true } },
      },
    });
    if (!template) throw new NotFoundException(`FeeTemplate ${templateId} not found`);

    return {
      ...this.serializeTemplate(template),
      _usageCount: (template as Record<string, unknown>)['_count']
        ? ((template as Record<string, unknown>)['_count'] as { appliedFees: number }).appliedFees
        : 0,
    };
  }

  // ── 5. Deactivate Fee Template ─────────────────────────────────────────────

  async deactivateFeeTemplate(orgId: string, templateId: string): Promise<object> {
    const existing = await this.prisma.feeTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException(`FeeTemplate ${templateId} not found`);

    const updated = await this.prisma.feeTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    return this.serializeTemplate(updated);
  }

  // ── 6. Calculate Fees for Application ─────────────────────────────────────

  async calculateFeesForApplication(
    orgId: string,
    applicationId: string,
  ): Promise<object> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: {
        customer: true,
        product: true,
        breDecision: true,
        schemeApplications: { select: { schemeId: true } },
      },
    });
    if (!application) throw new NotFoundException(`Application ${applicationId} not found`);

    // Determine effective rate
    const effectiveRateBps =
      application.sanctionedInterestRateBps ??
      application.breDecision?.approvedInterestRateBps ??
      application.product.minInterestRateBps;

    const loanAmountPaisa =
      application.sanctionedAmountPaisa ?? application.requestedAmountPaisa;
    const tenureMonths =
      application.sanctionedTenureMonths ?? application.requestedTenureMonths;

    // Estimate EMI (needed for PERCENTAGE on EMI_AMOUNT)
    const emiAmountPaisa = this.estimateEmi(loanAmountPaisa, effectiveRateBps, tenureMonths);

    // Fetch all active fee templates for org
    const templates = await this.prisma.feeTemplate.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const schemeIds = application.schemeApplications.map((sa) => sa.schemeId);

    const applicableTemplates = templates.filter((t) =>
      this.isTemplateApplicable(t, {
        productId: application.productId,
        loanAmountPaisa,
        rateBps: effectiveRateBps,
        tenureMonths,
        customerType: application.customer.customerType,
        employmentType: application.customer.employmentType,
        sourceType: application.sourceType,
        schemeIds,
        triggerEvent: 'DISBURSAL',
      }),
    );

    // Remove existing CALCULATED fees to avoid duplicates
    await this.prisma.appliedFee.deleteMany({
      where: { applicationId, status: 'CALCULATED' },
    });

    const created: object[] = [];

    for (const template of applicableTemplates) {
      const baseAmountPaisa = this.computeBaseFee(template, {
        loanAmountPaisa,
        tenureMonths,
        rateBps: effectiveRateBps,
        emiAmountPaisa,
        outstandingPrincipalPaisa: loanAmountPaisa,
        overdueAmountPaisa: 0,
      });

      if (baseAmountPaisa <= 0) continue;

      const gstPercent = template.gstApplicable
        ? new Decimal(template.gstPercent.toString())
        : new Decimal(0);
      const cessPercent = template.cessPercent
        ? new Decimal(template.cessPercent.toString())
        : new Decimal(0);

      const gstAmountPaisa = new Decimal(baseAmountPaisa)
        .mul(gstPercent)
        .div(100)
        .round()
        .toNumber();
      const cessAmountPaisa = new Decimal(baseAmountPaisa)
        .mul(cessPercent)
        .div(100)
        .round()
        .toNumber();
      const totalAmountPaisa = baseAmountPaisa + gstAmountPaisa + cessAmountPaisa;

      const calculationDetails = {
        calculationType: template.calculationType,
        loanAmountPaisa,
        tenureMonths,
        rateBps: effectiveRateBps,
        emiAmountPaisa,
        baseAmountPaisa,
        gstPercent: gstPercent.toNumber(),
        cessPercent: cessPercent.toNumber(),
        templateSnapshot: {
          id: template.id,
          feeCode: template.feeCode,
          templateName: template.templateName,
        },
      };

      const applied = await this.prisma.appliedFee.create({
        data: {
          organizationId: orgId,
          feeTemplateId: template.id,
          applicationId,
          feeCode: template.feeCode,
          feeName: template.templateName,
          baseAmountPaisa,
          gstAmountPaisa,
          cessAmountPaisa,
          totalAmountPaisa,
          discountPaisa: 0,
          waivedPaisa: 0,
          netPayablePaisa: totalAmountPaisa,
          status: 'CALCULATED',
          deductedFromDisbursement: template.deductFromDisbursement,
          calculationDetails,
        },
      });

      created.push(this.serializeAppliedFee(applied));
    }

    const summary = this.buildFeeSummary(
      created as Array<{ totalAmountPaisa: number; gstAmountPaisa: number; netPayablePaisa: number; deductedFromDisbursement: boolean }>,
    );

    return {
      applicationId,
      fees: created,
      summary,
    };
  }

  // ── 7. Recalculate ────────────────────────────────────────────────────────

  async recalculateFeesForApplication(
    orgId: string,
    applicationId: string,
  ): Promise<object> {
    // Delete existing CALCULATED fees and rerun
    await this.prisma.appliedFee.deleteMany({
      where: { applicationId, status: 'CALCULATED' },
    });
    return this.calculateFeesForApplication(orgId, applicationId);
  }

  // ── 8. Get Fees for Application ────────────────────────────────────────────

  async getFeesForApplication(orgId: string, applicationId: string): Promise<object> {
    const fees = await this.prisma.appliedFee.findMany({
      where: { applicationId, organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: { feeTemplate: { select: { displayOrder: true, showInSanctionLetter: true, showInKFS: true } } },
    });

    const serialized = fees.map((f) => this.serializeAppliedFee(f));
    const summary = this.buildFeeSummary(serialized as Array<{ totalAmountPaisa: number; gstAmountPaisa: number; netPayablePaisa: number; deductedFromDisbursement: boolean }>);

    return { applicationId, fees: serialized, summary };
  }

  // ── 9. Apply Discount ─────────────────────────────────────────────────────

  async applyDiscount(
    orgId: string,
    appliedFeeId: string,
    dto: ApplyDiscountDto,
    userId: string,
  ): Promise<object> {
    const fee = await this.prisma.appliedFee.findFirst({
      where: { id: appliedFeeId, organizationId: orgId },
      include: { feeTemplate: true },
    });
    if (!fee) throw new NotFoundException(`AppliedFee ${appliedFeeId} not found`);
    if (fee.status === 'COLLECTED') throw new BadRequestException('Cannot discount an already collected fee');
    if (fee.status === 'WAIVED') throw new BadRequestException('Fee is already waived');

    // Check max discount limit
    if (fee.feeTemplate.isNegotiable && fee.feeTemplate.maxDiscountPercent) {
      const maxDiscountPaisa = new Decimal(fee.totalAmountPaisa)
        .mul(new Decimal(fee.feeTemplate.maxDiscountPercent.toString()))
        .div(100)
        .round()
        .toNumber();
      if (dto.discountPaisa > maxDiscountPaisa) {
        throw new BadRequestException(
          `Discount exceeds maximum allowed: ${maxDiscountPaisa} paisa (${fee.feeTemplate.maxDiscountPercent}%)`,
        );
      }
    } else if (!fee.feeTemplate.isNegotiable) {
      throw new ForbiddenException('This fee is not negotiable');
    }

    const netPayablePaisa = Math.max(0, fee.totalAmountPaisa - dto.discountPaisa - fee.waivedPaisa);

    const updated = await this.prisma.appliedFee.update({
      where: { id: appliedFeeId },
      data: {
        discountPaisa: dto.discountPaisa,
        netPayablePaisa,
        calculationDetails: {
          ...(fee.calculationDetails as Record<string, unknown>),
          discountAppliedBy: userId,
          discountReason: dto.reason,
        },
      },
    });

    return this.serializeAppliedFee(updated);
  }

  // ── 10. Waive Fee ─────────────────────────────────────────────────────────

  async waiveFee(
    orgId: string,
    appliedFeeId: string,
    dto: WaiveFeeDto,
    userId: string,
  ): Promise<object> {
    const fee = await this.prisma.appliedFee.findFirst({
      where: { id: appliedFeeId, organizationId: orgId },
    });
    if (!fee) throw new NotFoundException(`AppliedFee ${appliedFeeId} not found`);
    if (fee.status === 'COLLECTED') throw new BadRequestException('Cannot waive an already collected fee');

    const updated = await this.prisma.appliedFee.update({
      where: { id: appliedFeeId },
      data: {
        waivedPaisa: fee.totalAmountPaisa - fee.discountPaisa,
        netPayablePaisa: 0,
        status: 'WAIVED',
        waivedBy: userId,
        waivedReason: dto.reason,
      },
    });

    return this.serializeAppliedFee(updated);
  }

  // ── 11. Get Disbursement Deductions ───────────────────────────────────────

  async getDisbursementDeductions(orgId: string, applicationId: string): Promise<object> {
    const app = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
    });
    if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

    const fees = await this.prisma.appliedFee.findMany({
      where: {
        applicationId,
        organizationId: orgId,
        deductedFromDisbursement: true,
        status: { notIn: ['WAIVED', 'REFUNDED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalDeductionPaisa = fees.reduce((sum, f) => sum + f.netPayablePaisa, 0);
    const disbursedAmountPaisa = app.sanctionedAmountPaisa ?? app.requestedAmountPaisa;
    const netDisbursementPaisa = Math.max(0, disbursedAmountPaisa - totalDeductionPaisa);

    return {
      applicationId,
      disbursedAmountPaisa,
      disbursedAmountRupees: +(disbursedAmountPaisa / 100).toFixed(2),
      totalDeductionPaisa,
      totalDeductionRupees: +(totalDeductionPaisa / 100).toFixed(2),
      netDisbursementPaisa,
      netDisbursementRupees: +(netDisbursementPaisa / 100).toFixed(2),
      deductions: fees.map((f) => this.serializeAppliedFee(f)),
    };
  }

  // ── 12. Collect Fee ───────────────────────────────────────────────────────

  async collectFee(orgId: string, appliedFeeId: string): Promise<object> {
    const fee = await this.prisma.appliedFee.findFirst({
      where: { id: appliedFeeId, organizationId: orgId },
    });
    if (!fee) throw new NotFoundException(`AppliedFee ${appliedFeeId} not found`);
    if (fee.status === 'WAIVED') throw new BadRequestException('Fee is waived, cannot collect');
    if (fee.status === 'COLLECTED') throw new BadRequestException('Fee already collected');

    const updated = await this.prisma.appliedFee.update({
      where: { id: appliedFeeId },
      data: { status: 'COLLECTED', collectedAt: new Date() },
    });

    return this.serializeAppliedFee(updated);
  }

  // ── 13. Sanction Letter Fee Summary ───────────────────────────────────────

  async getFeeSummaryForSanctionLetter(orgId: string, applicationId: string): Promise<object> {
    const fees = await this.prisma.appliedFee.findMany({
      where: { applicationId, organizationId: orgId },
      include: { feeTemplate: { select: { showInSanctionLetter: true, showInKFS: true, displayOrder: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const sanctionFees = fees.filter((f) => f.feeTemplate?.showInSanctionLetter);
    const kfsFees = fees.filter((f) => f.feeTemplate?.showInKFS);

    const toFeeRow = (f: (typeof fees)[0]) => ({
      feeCode: f.feeCode,
      feeName: f.feeName,
      baseAmountRupees: +(f.baseAmountPaisa / 100).toFixed(2),
      gstAmountRupees: +(f.gstAmountPaisa / 100).toFixed(2),
      cessAmountRupees: +(f.cessAmountPaisa / 100).toFixed(2),
      totalAmountRupees: +(f.totalAmountPaisa / 100).toFixed(2),
      discountRupees: +(f.discountPaisa / 100).toFixed(2),
      waivedRupees: +(f.waivedPaisa / 100).toFixed(2),
      netPayableRupees: +(f.netPayablePaisa / 100).toFixed(2),
      status: f.status,
      deductedFromDisbursement: f.deductedFromDisbursement,
    });

    const totalNetPayable = sanctionFees.reduce((s, f) => s + f.netPayablePaisa, 0);
    const totalGst = sanctionFees.reduce((s, f) => s + f.gstAmountPaisa, 0);

    return {
      applicationId,
      sanctionLetterFees: sanctionFees.map(toFeeRow),
      kfsFees: kfsFees.map(toFeeRow),
      totals: {
        totalFeesPayableRupees: +(totalNetPayable / 100).toFixed(2),
        totalGstRupees: +(totalGst / 100).toFixed(2),
        grandTotalRupees: +((totalNetPayable + totalGst) / 100).toFixed(2),
      },
    };
  }

  // ── 14. Fee Report ────────────────────────────────────────────────────────

  async getFeeReport(
    orgId: string,
    filters: { fromDate?: string; toDate?: string; feeCode?: string; status?: string },
  ): Promise<object> {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (filters.feeCode) where['feeCode'] = filters.feeCode;
    if (filters.status) where['status'] = filters.status;
    if (filters.fromDate || filters.toDate) {
      where['createdAt'] = {
        ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
      };
    }

    const fees = await this.prisma.appliedFee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by feeCode
    const byCode: Record<string, {
      count: number;
      totalBaseRupees: number;
      totalGstRupees: number;
      totalCessRupees: number;
      totalRupees: number;
      totalDiscountRupees: number;
      totalWaivedRupees: number;
      totalCollectedRupees: number;
    }> = {};

    for (const fee of fees) {
      if (!byCode[fee.feeCode]) {
        byCode[fee.feeCode] = {
          count: 0,
          totalBaseRupees: 0,
          totalGstRupees: 0,
          totalCessRupees: 0,
          totalRupees: 0,
          totalDiscountRupees: 0,
          totalWaivedRupees: 0,
          totalCollectedRupees: 0,
        };
      }
      const row = byCode[fee.feeCode];
      row.count += 1;
      row.totalBaseRupees += fee.baseAmountPaisa / 100;
      row.totalGstRupees += fee.gstAmountPaisa / 100;
      row.totalCessRupees += fee.cessAmountPaisa / 100;
      row.totalRupees += fee.totalAmountPaisa / 100;
      row.totalDiscountRupees += fee.discountPaisa / 100;
      row.totalWaivedRupees += fee.waivedPaisa / 100;
      if (fee.status === 'COLLECTED') row.totalCollectedRupees += fee.netPayablePaisa / 100;
    }

    return {
      reportDate: new Date().toISOString(),
      filters,
      totalFees: fees.length,
      byFeeCode: Object.entries(byCode).map(([code, stats]) => ({
        feeCode: code,
        ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v])),
      })),
      overallTotals: {
        totalBaseRupees: +(fees.reduce((s, f) => s + f.baseAmountPaisa, 0) / 100).toFixed(2),
        totalGstRupees: +(fees.reduce((s, f) => s + f.gstAmountPaisa, 0) / 100).toFixed(2),
        totalCollectedRupees: +(
          fees.filter((f) => f.status === 'COLLECTED').reduce((s, f) => s + f.netPayablePaisa, 0) / 100
        ).toFixed(2),
        totalWaivedRupees: +(fees.reduce((s, f) => s + f.waivedPaisa, 0) / 100).toFixed(2),
      },
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Check if a fee template is applicable for the given loan context.
   */
  private isTemplateApplicable(
    template: {
      productIds: unknown;
      minAmountPaisa: number | null;
      maxAmountPaisa: number | null;
      minRateBps: number | null;
      maxRateBps: number | null;
      minTenureMonths: number | null;
      maxTenureMonths: number | null;
      customerTypes: unknown;
      employmentTypes: unknown;
      sourceTypes: unknown;
      schemeIds: unknown;
      triggerEvent: string | null;
    },
    ctx: {
      productId: string;
      loanAmountPaisa: number;
      rateBps: number;
      tenureMonths: number;
      customerType: string;
      employmentType: string;
      sourceType: string;
      schemeIds: string[];
      triggerEvent: string;
    },
  ): boolean {
    // Product match
    if (template.productIds != null) {
      const ids = template.productIds as string[];
      if (!ids.includes(ctx.productId)) return false;
    }

    // Amount range
    if (template.minAmountPaisa != null && ctx.loanAmountPaisa < template.minAmountPaisa) return false;
    if (template.maxAmountPaisa != null && ctx.loanAmountPaisa > template.maxAmountPaisa) return false;

    // Rate range
    if (template.minRateBps != null && ctx.rateBps < template.minRateBps) return false;
    if (template.maxRateBps != null && ctx.rateBps > template.maxRateBps) return false;

    // Tenure range
    if (template.minTenureMonths != null && ctx.tenureMonths < template.minTenureMonths) return false;
    if (template.maxTenureMonths != null && ctx.tenureMonths > template.maxTenureMonths) return false;

    // Customer type
    if (template.customerTypes != null) {
      const types = template.customerTypes as string[];
      if (!types.includes(ctx.customerType)) return false;
    }

    // Employment type
    if (template.employmentTypes != null) {
      const types = template.employmentTypes as string[];
      if (!types.includes(ctx.employmentType)) return false;
    }

    // Source type
    if (template.sourceTypes != null) {
      const types = template.sourceTypes as string[];
      if (!types.includes(ctx.sourceType)) return false;
    }

    // Scheme IDs
    if (template.schemeIds != null) {
      const ids = template.schemeIds as string[];
      if (ids.length > 0 && !ids.some((id) => ctx.schemeIds.includes(id))) return false;
    }

    // Trigger event — DISBURSAL fees apply at origination; null = always apply
    if (template.triggerEvent != null && template.triggerEvent !== ctx.triggerEvent) return false;

    return true;
  }

  /**
   * Compute the base fee amount (before GST) in paisa.
   */
  private computeBaseFee(
    template: {
      calculationType: string;
      flatAmountPaisa: number | null;
      percentageValue: unknown;
      percentageBase: string | null;
      minCapPaisa: number | null;
      maxCapPaisa: number | null;
      slabs: unknown;
      perUnitAmountPaisa: number | null;
      formula: string | null;
    },
    ctx: {
      loanAmountPaisa: number;
      tenureMonths: number;
      rateBps: number;
      emiAmountPaisa: number;
      outstandingPrincipalPaisa: number;
      overdueAmountPaisa: number;
    },
  ): number {
    switch (template.calculationType) {
      case 'FLAT':
        return template.flatAmountPaisa ?? 0;

      case 'PERCENTAGE': {
        const pct = new Decimal(template.percentageValue?.toString() ?? '0');
        let base = 0;
        switch (template.percentageBase) {
          case 'LOAN_AMOUNT': base = ctx.loanAmountPaisa; break;
          case 'OUTSTANDING_PRINCIPAL': base = ctx.outstandingPrincipalPaisa; break;
          case 'OVERDUE_AMOUNT': base = ctx.overdueAmountPaisa; break;
          case 'EMI_AMOUNT': base = ctx.emiAmountPaisa; break;
          case 'DISBURSED_AMOUNT': base = ctx.loanAmountPaisa; break;
          default: base = ctx.loanAmountPaisa;
        }
        let fee = new Decimal(base).mul(pct).div(100).round().toNumber();
        if (template.minCapPaisa != null) fee = Math.max(fee, template.minCapPaisa);
        if (template.maxCapPaisa != null) fee = Math.min(fee, template.maxCapPaisa);
        return fee;
      }

      case 'SLAB': {
        const slabs = (template.slabs as Slab[]) ?? [];
        // Sort: slabs with upToPaisa first (ascending), null last
        const sorted = [...slabs].sort((a, b) => {
          if (a.upToPaisa == null) return 1;
          if (b.upToPaisa == null) return -1;
          return a.upToPaisa - b.upToPaisa;
        });
        const matchedSlab = sorted.find(
          (s) => s.upToPaisa == null || ctx.loanAmountPaisa <= s.upToPaisa,
        );
        if (!matchedSlab) return 0;
        if (matchedSlab.flatPaisa != null) return matchedSlab.flatPaisa;
        if (matchedSlab.percent != null) {
          return new Decimal(ctx.loanAmountPaisa)
            .mul(matchedSlab.percent)
            .div(100)
            .round()
            .toNumber();
        }
        return 0;
      }

      case 'PER_UNIT':
        // Unit count defaults to 1 at calculation time; caller can adjust
        return template.perUnitAmountPaisa ?? 0;

      case 'FORMULA':
        if (!template.formula) return 0;
        return evaluateFormula(template.formula, {
          loanAmount: ctx.loanAmountPaisa,
          tenure: ctx.tenureMonths,
          rate: ctx.rateBps,
          emiAmount: ctx.emiAmountPaisa,
        });

      default:
        return 0;
    }
  }

  /**
   * Estimate EMI using reducing balance formula.
   * P * r * (1+r)^n / ((1+r)^n - 1) — result in paisa.
   */
  private estimateEmi(principalPaisa: number, rateBps: number, tenureMonths: number): number {
    const r = new Decimal(rateBps).div(12).div(10000);
    const P = new Decimal(principalPaisa);
    if (r.isZero()) return P.div(tenureMonths).round().toNumber();
    const onePlusR = r.plus(1);
    const pow = onePlusR.pow(tenureMonths);
    return P.mul(r).mul(pow).div(pow.minus(1)).round().toNumber();
  }

  private buildFeeSummary(fees: Array<{
    totalAmountPaisa: number;
    gstAmountPaisa: number;
    netPayablePaisa: number;
    deductedFromDisbursement: boolean;
  }>) {
    const totalPaisa = fees.reduce((s, f) => s + f.totalAmountPaisa, 0);
    const gstPaisa = fees.reduce((s, f) => s + f.gstAmountPaisa, 0);
    const netPayablePaisa = fees.reduce((s, f) => s + f.netPayablePaisa, 0);
    const deductionPaisa = fees
      .filter((f) => f.deductedFromDisbursement)
      .reduce((s, f) => s + f.netPayablePaisa, 0);

    return {
      totalFeesRupees: +(totalPaisa / 100).toFixed(2),
      totalGstRupees: +(gstPaisa / 100).toFixed(2),
      netPayableRupees: +(netPayablePaisa / 100).toFixed(2),
      deductedFromDisbursementRupees: +(deductionPaisa / 100).toFixed(2),
      feeCount: fees.length,
    };
  }

  private serializeTemplate(t: Record<string, unknown>): object {
    return {
      id: t['id'],
      organizationId: t['organizationId'],
      templateName: t['templateName'],
      feeCode: t['feeCode'],
      feeCategory: t['feeCategory'],
      description: t['description'],
      isActive: t['isActive'],
      productIds: t['productIds'],
      minAmountPaisa: t['minAmountPaisa'],
      maxAmountPaisa: t['maxAmountPaisa'],
      minRateBps: t['minRateBps'],
      maxRateBps: t['maxRateBps'],
      minTenureMonths: t['minTenureMonths'],
      maxTenureMonths: t['maxTenureMonths'],
      customerTypes: t['customerTypes'],
      employmentTypes: t['employmentTypes'],
      sourceTypes: t['sourceTypes'],
      schemeIds: t['schemeIds'],
      loanStatuses: t['loanStatuses'],
      triggerEvent: t['triggerEvent'],
      calculationType: t['calculationType'],
      flatAmountPaisa: t['flatAmountPaisa'],
      flatAmountRupees: t['flatAmountPaisa'] != null ? +((t['flatAmountPaisa'] as number) / 100).toFixed(2) : null,
      percentageValue: t['percentageValue'] != null ? +parseFloat(t['percentageValue']!.toString()).toFixed(4) : null,
      percentageBase: t['percentageBase'],
      minCapPaisa: t['minCapPaisa'],
      minCapRupees: t['minCapPaisa'] != null ? +((t['minCapPaisa'] as number) / 100).toFixed(2) : null,
      maxCapPaisa: t['maxCapPaisa'],
      maxCapRupees: t['maxCapPaisa'] != null ? +((t['maxCapPaisa'] as number) / 100).toFixed(2) : null,
      slabs: t['slabs'],
      perUnitAmountPaisa: t['perUnitAmountPaisa'],
      perUnitAmountRupees: t['perUnitAmountPaisa'] != null ? +((t['perUnitAmountPaisa'] as number) / 100).toFixed(2) : null,
      unitType: t['unitType'],
      formula: t['formula'],
      gstApplicable: t['gstApplicable'],
      gstPercent: t['gstPercent'] != null ? +parseFloat(t['gstPercent']!.toString()).toFixed(2) : null,
      cessPercent: t['cessPercent'] != null ? +parseFloat(t['cessPercent']!.toString()).toFixed(2) : null,
      collectAt: t['collectAt'],
      deductFromDisbursement: t['deductFromDisbursement'],
      isRefundable: t['isRefundable'],
      refundCondition: t['refundCondition'],
      displayOrder: t['displayOrder'],
      showInSanctionLetter: t['showInSanctionLetter'],
      showInKFS: t['showInKFS'],
      isNegotiable: t['isNegotiable'],
      maxDiscountPercent: t['maxDiscountPercent'] != null ? +parseFloat(t['maxDiscountPercent']!.toString()).toFixed(2) : null,
      createdBy: t['createdBy'],
      updatedBy: t['updatedBy'],
      createdAt: t['createdAt'],
      updatedAt: t['updatedAt'],
    };
  }

  private serializeAppliedFee(f: Record<string, unknown>): object {
    return {
      id: f['id'],
      organizationId: f['organizationId'],
      feeTemplateId: f['feeTemplateId'],
      applicationId: f['applicationId'],
      loanId: f['loanId'],
      feeCode: f['feeCode'],
      feeName: f['feeName'],
      baseAmountPaisa: f['baseAmountPaisa'],
      baseAmountRupees: +((f['baseAmountPaisa'] as number) / 100).toFixed(2),
      gstAmountPaisa: f['gstAmountPaisa'],
      gstAmountRupees: +((f['gstAmountPaisa'] as number) / 100).toFixed(2),
      cessAmountPaisa: f['cessAmountPaisa'],
      cessAmountRupees: +((f['cessAmountPaisa'] as number) / 100).toFixed(2),
      totalAmountPaisa: f['totalAmountPaisa'],
      totalAmountRupees: +((f['totalAmountPaisa'] as number) / 100).toFixed(2),
      discountPaisa: f['discountPaisa'],
      discountRupees: +((f['discountPaisa'] as number) / 100).toFixed(2),
      waivedPaisa: f['waivedPaisa'],
      waivedRupees: +((f['waivedPaisa'] as number) / 100).toFixed(2),
      netPayablePaisa: f['netPayablePaisa'],
      netPayableRupees: +((f['netPayablePaisa'] as number) / 100).toFixed(2),
      status: f['status'],
      collectedAt: f['collectedAt'],
      waivedBy: f['waivedBy'],
      waivedReason: f['waivedReason'],
      deductedFromDisbursement: f['deductedFromDisbursement'],
      calculationDetails: f['calculationDetails'],
      createdAt: f['createdAt'],
      updatedAt: f['updatedAt'],
    };
  }
}
