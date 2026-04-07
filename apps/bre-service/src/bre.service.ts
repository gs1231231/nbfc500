import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { calculateEmi, calculateFoir } from '@bankos/common';
import {
  BreFinalDecision,
  BreRuleAction,
  BreRuleCategory,
  BureauRequestStatus,
} from '@prisma/client';
import { evaluateCondition, EvaluationContext, RuleCondition } from './rule-evaluator';
import { CreateBreRuleDto } from './dto/create-rule.dto';
import { UpdateBreRuleDto } from './dto/update-rule.dto';

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  category: BreRuleCategory;
  result: 'PASS' | 'FAIL';
  reason: string;
}

export interface BreEvaluationResult {
  decision: BreFinalDecision;
  interestRateBps?: number;
  reasons: string[];
  ruleResults: RuleResult[];
}

@Injectable()
export class BreService {
  private readonly logger = new Logger(BreService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Core evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluates BRE rules for a given loan application.
   * Fetches all required data, builds evaluation context, runs rules, persists decision.
   *
   * @param orgId         - Organization UUID (for multi-tenant scoping)
   * @param applicationId - Loan application UUID
   * @returns Final BRE decision with rule results
   */
  async evaluateApplication(
    orgId: string,
    applicationId: string,
  ): Promise<BreEvaluationResult> {
    this.logger.log(`Evaluating BRE for application ${applicationId}, org ${orgId}`);

    // Step 1: Fetch application + customer + bureau + product
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: {
        customer: true,
        product: true,
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found for org ${orgId}`,
      );
    }

    // Fetch the latest successful bureau response for this application
    const latestBureauRequest = await this.prisma.bureauRequest.findFirst({
      where: {
        applicationId,
        organizationId: orgId,
        status: BureauRequestStatus.SUCCESS,
      },
      orderBy: { createdAt: 'desc' },
      include: { bureauResponse: true },
    });

    const bureauResponse = latestBureauRequest?.bureauResponse ?? null;

    // Step 2: Build flat evaluation context (includes custom fields)
    const context = this.buildContext(application, bureauResponse);

    // Merge customer custom fields under the "custom." prefix
    const customerCustomFields = (application.customer as unknown as Record<string, unknown>).customFields;
    if (customerCustomFields && typeof customerCustomFields === 'object') {
      for (const [key, value] of Object.entries(customerCustomFields as Record<string, unknown>)) {
        (context as Record<string, unknown>)[`custom.${key}`] = value as number | string | boolean;
      }
    }

    // Merge application custom fields under the "custom." prefix (application fields override customer fields)
    const applicationCustomFields = (application as unknown as Record<string, unknown>).customFields;
    if (applicationCustomFields && typeof applicationCustomFields === 'object') {
      for (const [key, value] of Object.entries(applicationCustomFields as Record<string, unknown>)) {
        (context as Record<string, unknown>)[`custom.${key}`] = value as number | string | boolean;
      }
    }

    // Step 3 & 4: Fetch and evaluate rules
    const { ruleResults, decision, interestRateBps } = await this.runRules(
      orgId,
      application.productId,
      context,
    );

    // Step 5: Collect failure reasons
    const reasons = ruleResults
      .filter((r) => r.result === 'FAIL')
      .map((r) => r.reason);

    // Step 6: Persist BreDecision (context already includes custom.* fields)
    await this.prisma.breDecision.create({
      data: {
        applicationId,
        organizationId: orgId,
        finalDecision: decision,
        approvedInterestRateBps: interestRateBps ?? null,
        ruleResults: ruleResults as unknown as object[],
        evaluationContext: context as unknown as object,
      },
    });

    this.logger.log(
      `BRE decision for application ${applicationId}: ${decision}`,
    );

    return { decision, interestRateBps, reasons, ruleResults };
  }

  /**
   * Simulates BRE rule evaluation against a provided test context.
   * Does NOT persist any BreDecision record.
   *
   * @param orgId       - Organization UUID
   * @param productId   - Loan product UUID
   * @param testContext - Flat key-value evaluation context provided by caller
   * @returns BRE evaluation result (not persisted)
   */
  async simulate(
    orgId: string,
    productId: string,
    testContext: Record<string, number | string | boolean>,
  ): Promise<BreEvaluationResult> {
    this.logger.log(`Simulating BRE for product ${productId}, org ${orgId}`);

    const product = await this.prisma.loanProduct.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(
        `Loan product ${productId} not found for org ${orgId}`,
      );
    }

    const context: EvaluationContext = testContext;

    const { ruleResults, decision, interestRateBps } = await this.runRules(
      orgId,
      productId,
      context,
    );

    const reasons = ruleResults
      .filter((r) => r.result === 'FAIL')
      .map((r) => r.reason);

    return { decision, interestRateBps, reasons, ruleResults };
  }

  // ---------------------------------------------------------------------------
  // CRUD for BreRules
  // ---------------------------------------------------------------------------

  async createRule(orgId: string, dto: CreateBreRuleDto) {
    const product = await this.prisma.loanProduct.findFirst({
      where: { id: dto.productId, organizationId: orgId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(
        `Loan product ${dto.productId} not found for org ${orgId}`,
      );
    }

    return this.prisma.breRule.create({
      data: {
        organizationId: orgId,
        productId: dto.productId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        condition: dto.condition as object,
        action: dto.action,
        reason: dto.reason,
        isActive: dto.isActive ?? true,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  async findAllRules(
    orgId: string,
    filters: { productId?: string; category?: BreRuleCategory; isActive?: boolean },
  ) {
    return this.prisma.breRule.findMany({
      where: {
        organizationId: orgId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOneRule(orgId: string, ruleId: string) {
    const rule = await this.prisma.breRule.findFirst({
      where: { id: ruleId, organizationId: orgId },
    });

    if (!rule) {
      throw new NotFoundException(`BRE rule ${ruleId} not found for org ${orgId}`);
    }

    return rule;
  }

  async updateRule(orgId: string, ruleId: string, dto: UpdateBreRuleDto) {
    await this.findOneRule(orgId, ruleId);

    const updateData: Record<string, unknown> = {};
    if (dto.productId !== undefined) updateData.productId = dto.productId;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.condition !== undefined) updateData.condition = dto.condition as object;
    if (dto.action !== undefined) updateData.action = dto.action;
    if (dto.reason !== undefined) updateData.reason = dto.reason;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) updateData.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    updateData.version = { increment: 1 };

    return this.prisma.breRule.update({
      where: { id: ruleId },
      data: updateData as any,
    });
  }

  async deleteRule(orgId: string, ruleId: string) {
    await this.findOneRule(orgId, ruleId);

    return this.prisma.breRule.delete({ where: { id: ruleId } });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds a flat evaluation context from the application, customer, bureau, and product data.
   * All monetary values are in paisa. Interest rates in basis points.
   */
  private buildContext(
    application: {
      requestedAmountPaisa: number;
      requestedTenureMonths: number;
      customer: {
        dateOfBirth: Date;
        monthlyIncomePaisa: number | null;
      };
      product: {
        minInterestRateBps: number;
      };
    },
    bureauResponse: {
      score: number | null;
      totalEmiObligationPaisa: number | null;
      hasWriteOff: boolean;
      maxDpdLast12Months: number | null;
      enquiriesLast3Months: number | null;
    } | null,
  ): EvaluationContext {
    // Calculate customer age in years
    const today = new Date();
    const dob = new Date(application.customer.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }

    // Proposed EMI using the product's minimum interest rate as a conservative estimate
    const proposedEmiPaisa = calculateEmi(
      application.requestedAmountPaisa,
      application.product.minInterestRateBps,
      application.requestedTenureMonths,
    );

    // FOIR calculation
    const monthlyIncome = application.customer.monthlyIncomePaisa ?? 0;
    const existingEmi = bureauResponse?.totalEmiObligationPaisa ?? 0;
    const foir = calculateFoir(monthlyIncome, existingEmi, proposedEmiPaisa);

    return {
      'customer.age': age,
      'bureau.score': bureauResponse?.score ?? 0,
      'bureau.totalEmiPaisa': bureauResponse?.totalEmiObligationPaisa ?? 0,
      'bureau.hasWriteOff': bureauResponse?.hasWriteOff ?? false,
      'bureau.maxDpdLast12Months': bureauResponse?.maxDpdLast12Months ?? 0,
      'bureau.enquiriesLast3Months': bureauResponse?.enquiriesLast3Months ?? 0,
      'application.requestedAmountPaisa': application.requestedAmountPaisa,
      'calculated.proposedEmiPaisa': proposedEmiPaisa,
      'calculated.foir': foir,
    };
  }

  /**
   * Fetches active rules for the given product and org, evaluates them in priority order,
   * and returns rule results along with the aggregated decision.
   *
   * Decision logic:
   *  - Any ELIGIBILITY rule FAIL with action REJECT => final decision REJECTED
   *  - Any POLICY rule FAIL with action REJECT and no DEVIATION rule covering it => REJECTED
   *  - POLICY FAIL within allowed DEVIATION => REFERRED
   *  - All rules PASS => APPROVED; pricing rule gives the interest rate
   */
  private async runRules(
    orgId: string,
    productId: string,
    context: EvaluationContext,
  ): Promise<{
    ruleResults: RuleResult[];
    decision: BreFinalDecision;
    interestRateBps?: number;
  }> {
    const now = new Date();

    const rules = await this.prisma.breRule.findMany({
      where: {
        organizationId: orgId,
        productId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { priority: 'asc' },
    });

    const ruleResults: RuleResult[] = [];
    let hasEligibilityFail = false;
    let hasPolicyFail = false;
    let hasDeviationCoverage = false;
    let pricingInterestRateBps: number | undefined;

    for (const rule of rules) {
      const condition = rule.condition as unknown as RuleCondition;

      if (!condition || !condition.field || !condition.operator) {
        this.logger.warn(`Rule ${rule.id} has malformed condition, skipping`);
        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          result: 'PASS',
          reason: `Rule skipped: malformed condition`,
        });
        continue;
      }

      const evalResult = evaluateCondition(condition, context);
      const passed = evalResult.passed;

      if (rule.category === BreRuleCategory.PRICING) {
        // PRICING rules: find the best (lowest) interest rate when condition passes
        if (passed) {
          const rateInCondition = this.extractPricingRate(rule.condition as Record<string, unknown>);
          if (
            rateInCondition !== undefined &&
            (pricingInterestRateBps === undefined || rateInCondition < pricingInterestRateBps)
          ) {
            pricingInterestRateBps = rateInCondition;
          }
        }

        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          result: passed ? 'PASS' : 'FAIL',
          reason: evalResult.reason,
        });
        continue;
      }

      if (!passed) {
        if (rule.category === BreRuleCategory.ELIGIBILITY && rule.action === BreRuleAction.REJECT) {
          hasEligibilityFail = true;
        } else if (rule.category === BreRuleCategory.POLICY && rule.action === BreRuleAction.REJECT) {
          hasPolicyFail = true;
        } else if (rule.category === BreRuleCategory.DEVIATION) {
          // DEVIATION rules failing means deviation is NOT available
          // DEVIATION rules passing means a policy breach can be referred rather than rejected
          hasDeviationCoverage = false;
        }

        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          result: 'FAIL',
          reason: rule.reason || evalResult.reason,
        });
      } else {
        if (rule.category === BreRuleCategory.DEVIATION) {
          // A passing DEVIATION rule means deviations are allowed (refer instead of reject)
          hasDeviationCoverage = true;
        }

        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          result: 'PASS',
          reason: evalResult.reason,
        });
      }
    }

    // Determine final decision
    let decision: BreFinalDecision;

    if (hasEligibilityFail) {
      decision = BreFinalDecision.REJECTED;
    } else if (hasPolicyFail && !hasDeviationCoverage) {
      decision = BreFinalDecision.REJECTED;
    } else if (hasPolicyFail && hasDeviationCoverage) {
      decision = BreFinalDecision.REFERRED;
    } else {
      decision = BreFinalDecision.APPROVED;
    }

    return {
      ruleResults,
      decision,
      interestRateBps: decision === BreFinalDecision.APPROVED ? pricingInterestRateBps : undefined,
    };
  }

  /**
   * Attempts to extract an interest rate (in bps) from a pricing rule's
   * metadata. Pricing rules may carry the rate in the condition's metadata
   * field (e.g. { field: 'bureau.score', operator: 'GTE', value: 700, rateBps: 1200 }).
   */
  private extractPricingRate(
    condition: Record<string, unknown>,
  ): number | undefined {
    if (typeof condition['rateBps'] === 'number') {
      return condition['rateBps'];
    }
    return undefined;
  }

  /**
   * Validates that the organization exists.
   * (Used by controller to guard multi-tenant access; can be wired to a guard instead.)
   */
  async validateOrg(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isActive: true, deletedAt: null },
    });
    if (!org) {
      throw new BadRequestException(`Organization ${orgId} not found or inactive`);
    }
  }
}
