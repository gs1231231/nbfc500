import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddPolicyDto, UpdatePolicyDto, InitiateClaimDto } from './dto/insurance.dto';

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Policy CRUD
  // ============================================================

  /**
   * Adds a new insurance policy linked to a loan.
   */
  async addPolicy(orgId: string, loanId: string, dto: AddPolicyDto) {
    // Validate the loan exists and belongs to org
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true, loanNumber: true, customerId: true },
    });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    // Validate customer belongs to org
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const policy = await prismaAny.insurancePolicy.create({
      data: {
        organizationId: orgId,
        loanId,
        customerId: dto.customerId,
        policyType: dto.policyType,
        providerName: dto.providerName,
        policyNumber: dto.policyNumber ?? null,
        premiumPaisa: dto.premiumPaisa,
        sumInsuredPaisa: dto.sumInsuredPaisa,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'ACTIVE',
        renewalDueDate: dto.renewalDueDate ? new Date(dto.renewalDueDate) : null,
        nomineeId: dto.nomineeId ?? null,
      },
    });

    this.logger.log(
      `Insurance policy ${dto.policyType} added for loan ${loan.loanNumber}. ` +
        `Provider: ${dto.providerName}, Premium: ₹${dto.premiumPaisa / 100}`,
    );

    return policy;
  }

  /**
   * Lists all insurance policies for an organization (optionally filtered by loanId).
   */
  async listPolicies(orgId: string, loanId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };
    if (loanId) where.loanId = loanId;

    return prismaAny.insurancePolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns a single insurance policy by ID.
   */
  async getPolicy(orgId: string, policyId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const policy = await prismaAny.insurancePolicy.findFirst({
      where: { id: policyId, organizationId: orgId },
    });
    if (!policy) throw new NotFoundException(`InsurancePolicy ${policyId} not found`);
    return policy;
  }

  /**
   * Updates an insurance policy.
   */
  async updatePolicy(orgId: string, policyId: string, dto: UpdatePolicyDto) {
    await this.getPolicy(orgId, policyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    return prismaAny.insurancePolicy.update({
      where: { id: policyId },
      data: {
        ...(dto.policyNumber !== undefined && { policyNumber: dto.policyNumber }),
        ...(dto.providerName !== undefined && { providerName: dto.providerName }),
        ...(dto.premiumPaisa !== undefined && { premiumPaisa: dto.premiumPaisa }),
        ...(dto.sumInsuredPaisa !== undefined && { sumInsuredPaisa: dto.sumInsuredPaisa }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.renewalDueDate !== undefined && { renewalDueDate: new Date(dto.renewalDueDate) }),
        ...(dto.nomineeId !== undefined && { nomineeId: dto.nomineeId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  /**
   * Soft-cancels a policy (status → CANCELLED).
   */
  async deletePolicy(orgId: string, policyId: string) {
    await this.getPolicy(orgId, policyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    await prismaAny.insurancePolicy.update({
      where: { id: policyId },
      data: { status: 'CANCELLED' },
    });
    return { message: `InsurancePolicy ${policyId} cancelled successfully` };
  }

  // ============================================================
  // Renewal Management
  // ============================================================

  /**
   * Returns insurance policies expiring within the next N days.
   *
   * Used to drive renewal reminders and proactive re-engagement.
   */
  async getRenewalsDue(orgId: string, daysAhead = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const policies = await prismaAny.insurancePolicy.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        endDate: { lte: cutoffDate },
      },
      orderBy: { endDate: 'asc' },
    });

    return {
      daysAhead,
      count: policies.length,
      policies: policies.map((p: {
        id: string;
        loanId: string;
        customerId: string;
        policyType: string;
        providerName: string;
        endDate: Date;
        renewalDueDate: Date | null;
        premiumPaisa: number;
      }) => ({
        ...p,
        daysToExpiry: Math.ceil(
          (new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  /**
   * Processes a policy renewal:
   *  - Sets the current policy to EXPIRED
   *  - Creates a new policy for the next period
   *  - Posts a LoanChargeEntry for the renewal premium (charged to the loan)
   */
  async processRenewal(orgId: string, policyId: string) {
    const policy = await this.getPolicy(orgId, policyId);

    if (policy.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        `Only ACTIVE policies can be renewed. Current status: ${policy.status}`,
      );
    }

    // Determine new policy dates (same duration, shifted by one year for simplicity)
    const oldEndDate = new Date(policy.endDate);
    const newStartDate = new Date(oldEndDate);
    newStartDate.setDate(newStartDate.getDate() + 1);

    const newEndDate = new Date(newStartDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    const newRenewalDueDate = new Date(newEndDate);
    newRenewalDueDate.setDate(newRenewalDueDate.getDate() - 30); // 30 days before expiry

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    const [updatedOldPolicy, newPolicy] = await this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txAny = tx as any;

      // Mark old policy as EXPIRED
      const updatedOld = await txAny.insurancePolicy.update({
        where: { id: policyId },
        data: { status: 'EXPIRED' },
      });

      // Create renewed policy
      const renewed = await txAny.insurancePolicy.create({
        data: {
          organizationId: orgId,
          loanId: policy.loanId,
          customerId: policy.customerId,
          policyType: policy.policyType,
          providerName: policy.providerName,
          policyNumber: policy.policyNumber ?? null,
          premiumPaisa: policy.premiumPaisa,
          sumInsuredPaisa: policy.sumInsuredPaisa,
          startDate: newStartDate,
          endDate: newEndDate,
          status: 'ACTIVE',
          renewalDueDate: newRenewalDueDate,
          nomineeId: policy.nomineeId ?? null,
        },
      });

      // Post renewal premium as a charge on the loan
      await tx.loanChargeEntry.create({
        data: {
          organizationId: orgId,
          loanId: policy.loanId,
          chargeType: 'INSURANCE_RENEWAL',
          amountPaisa: policy.premiumPaisa,
          gstPaisa: Math.round(policy.premiumPaisa * 0.18), // 18% GST
          dueDate: newStartDate,
          status: 'DUE',
        },
      });

      return [updatedOld, renewed];
    });

    this.logger.log(
      `Insurance policy ${policyId} (${policy.policyType}) renewed. ` +
        `New policy ID: ${newPolicy.id}. Premium charged: ₹${policy.premiumPaisa / 100}`,
    );

    return {
      message: 'Policy renewed successfully',
      expiredPolicyId: updatedOldPolicy.id,
      newPolicyId: newPolicy.id,
      newPolicy,
      premiumChargedPaisa: policy.premiumPaisa,
      renewalPeriod: {
        startDate: newStartDate.toISOString(),
        endDate: newEndDate.toISOString(),
      },
    };
  }

  // ============================================================
  // Claims
  // ============================================================

  /**
   * Initiates a claim process for an active policy.
   *
   * - Marks the policy status as CLAIMED.
   * - Creates a GL entry to record the claim event for audit.
   * - Returns claim reference details.
   *
   * Full claim settlement would integrate with the insurer's API
   * and is recorded here as a trigger point.
   */
  async initiateClaim(orgId: string, policyId: string, dto: InitiateClaimDto) {
    const policy = await this.getPolicy(orgId, policyId);

    if (policy.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        `Claims can only be initiated on ACTIVE policies. Current status: ${policy.status}`,
      );
    }

    const claimRef = `CLM-${Date.now()}-${policyId.slice(0, 8)}`;
    const claimDate = new Date(dto.claimDate);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    // Fetch loan for branch info
    const loan = await this.prisma.loan.findFirst({
      where: { id: policy.loanId },
      select: { branchId: true, loanNumber: true },
    });

    await this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txAny = tx as any;

      // Mark policy as CLAIMED
      await txAny.insurancePolicy.update({
        where: { id: policyId },
        data: { status: 'CLAIMED' },
      });

      // GL entry for claim initiation record (contingent liability)
      if (loan) {
        await tx.glEntry.create({
          data: {
            organizationId: orgId,
            branchId: loan.branchId,
            entryDate: claimDate,
            valueDate: claimDate,
            accountCode: 'INS_CLAIM',
            accountName: 'Insurance Claim Initiated',
            debitAmountPaisa: dto.estimatedClaimAmountPaisa ?? 0,
            creditAmountPaisa: 0,
            narration: JSON.stringify({
              claimRef,
              claimType: dto.claimType,
              policyId,
              policyType: policy.policyType,
              providerName: policy.providerName,
              loanId: policy.loanId,
              remarks: dto.remarks ?? null,
            }),
            referenceType: 'INSURANCE_CLAIM',
            referenceId: claimRef,
          },
        });
      }
    });

    this.logger.log(
      `Insurance claim ${claimRef} initiated for policy ${policyId} ` +
        `(${policy.policyType}). Claim type: ${dto.claimType}`,
    );

    return {
      claimRef,
      policyId,
      loanId: policy.loanId,
      policyType: policy.policyType,
      providerName: policy.providerName,
      claimType: dto.claimType,
      claimDate: claimDate.toISOString(),
      estimatedClaimAmountPaisa: dto.estimatedClaimAmountPaisa ?? null,
      estimatedClaimAmountRupees: dto.estimatedClaimAmountPaisa
        ? dto.estimatedClaimAmountPaisa / 100
        : null,
      status: 'CLAIM_INITIATED',
      remarks: dto.remarks ?? null,
      initiatedAt: new Date(),
    };
  }
}
