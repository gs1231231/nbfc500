import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CoLendingStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/colending.dto';

/** Minimum NBFC share as percentage of total loan (RBI MRR requirement) */
const MIN_NBFC_SHARE_PERCENT = 10;

/**
 * CoLendingService — manages co-lending partnerships, allocations, disbursements,
 * and settlement processing in compliance with RBI co-lending model guidelines.
 *
 * Key RBI rules enforced:
 *  1. MRR (Minimum Risk Retention): NBFC must retain at least 10% of each loan
 *  2. Blended rate = (bankRate*bankShare + nbfcRate*nbfcShare) / 100
 *  3. DLG utilization must be tracked and capped per partner agreement
 */
@Injectable()
export class CoLendingService {
  private readonly logger = new Logger(CoLendingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Partner CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new co-lending partner for the organization.
   *
   * Validates that bankShare + nbfcShare == 100.
   */
  async createPartner(orgId: string, dto: CreatePartnerDto) {
    if (dto.defaultBankSharePercent + dto.defaultNbfcSharePercent !== 100) {
      throw new BadRequestException(
        'defaultBankSharePercent + defaultNbfcSharePercent must equal 100',
      );
    }

    const partner = await this.prisma.coLendingPartner.create({
      data: {
        organizationId: orgId,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        apiEndpoint: dto.apiEndpoint,
        defaultBankSharePercent: dto.defaultBankSharePercent,
        defaultNbfcSharePercent: dto.defaultNbfcSharePercent,
        bankInterestRateBps: dto.bankInterestRateBps,
        nbfcInterestRateBps: dto.nbfcInterestRateBps,
        maxExposurePaisa: BigInt(dto.maxExposurePaisa),
        dlgCapPercent: dto.dlgCapPercent ?? 5,
      },
    });

    this.logger.log(`Created co-lending partner ${partner.id} (${partner.bankCode}) for org ${orgId}`);
    return this.serializePartner(partner);
  }

  /**
   * List all co-lending partners for the organization.
   */
  async listPartners(orgId: string) {
    const partners = await this.prisma.coLendingPartner.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return partners.map((p) => this.serializePartner(p));
  }

  /**
   * Update a co-lending partner.
   */
  async updatePartner(orgId: string, partnerId: string, dto: UpdatePartnerDto) {
    const existing = await this.prisma.coLendingPartner.findFirst({
      where: { id: partnerId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Co-lending partner ${partnerId} not found for organization ${orgId}`,
      );
    }

    // Validate share totals if either is being updated
    const newBankShare = dto.defaultBankSharePercent ?? existing.defaultBankSharePercent;
    const newNbfcShare = dto.defaultNbfcSharePercent ?? existing.defaultNbfcSharePercent;

    if (newBankShare + newNbfcShare !== 100) {
      throw new BadRequestException(
        'defaultBankSharePercent + defaultNbfcSharePercent must equal 100',
      );
    }

    const updated = await this.prisma.coLendingPartner.update({
      where: { id: partnerId },
      data: {
        apiEndpoint: dto.apiEndpoint,
        defaultBankSharePercent: dto.defaultBankSharePercent,
        defaultNbfcSharePercent: dto.defaultNbfcSharePercent,
        bankInterestRateBps: dto.bankInterestRateBps,
        nbfcInterestRateBps: dto.nbfcInterestRateBps,
        maxExposurePaisa: dto.maxExposurePaisa !== undefined
          ? BigInt(dto.maxExposurePaisa)
          : undefined,
        dlgCapPercent: dto.dlgCapPercent,
        isActive: dto.isActive,
      },
    });

    this.logger.log(`Updated co-lending partner ${partnerId} for org ${orgId}`);
    return this.serializePartner(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Allocation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Allocate a loan application to an eligible co-lending partner.
   *
   * Algorithm:
   *  1. Find the first active partner with sufficient remaining exposure
   *  2. Validate MRR: nbfcShare / totalLoan * 100 >= 10%
   *  3. Compute blended interest rate:
   *     blendedRate = (bankRate * bankShare + nbfcRate * nbfcShare) / 100
   *  4. Create CoLendingAllocation record
   *  5. Update partner currentExposurePaisa
   *
   * @param orgId         Organization (tenant) UUID
   * @param applicationId Loan application UUID (must be in DISBURSED or SANCTIONED status)
   */
  async allocate(orgId: string, applicationId: string) {
    // Resolve the application and its loan
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: { loans: true },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found for organization ${orgId}`,
      );
    }

    if (application.loans.length === 0) {
      throw new BadRequestException(
        `Application ${applicationId} has no associated loan. Disburse the loan first.`,
      );
    }

    const loan = application.loans[0];

    // Check if already allocated
    const existingAllocation = await this.prisma.coLendingAllocation.findUnique({
      where: { loanId: loan.id },
    });

    if (existingAllocation) {
      throw new BadRequestException(
        `Loan ${loan.loanNumber} is already allocated to a co-lending partner`,
      );
    }

    const totalLoanPaisa = loan.disbursedAmountPaisa;

    // Find eligible partner (first active partner within exposure limits)
    const partners = await this.prisma.coLendingPartner.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    let selectedPartner: (typeof partners)[0] | null = null;

    for (const partner of partners) {
      const remainingExposure =
        Number(partner.maxExposurePaisa) - Number(partner.currentExposurePaisa);

      if (remainingExposure >= totalLoanPaisa) {
        // Validate MRR: NBFC must retain at least 10% of the loan
        const nbfcSharePercent = partner.defaultNbfcSharePercent;
        const nbfcSharePaisa = Math.floor((totalLoanPaisa * nbfcSharePercent) / 100);
        const mrrPercent = (nbfcSharePaisa / totalLoanPaisa) * 100;

        if (mrrPercent < MIN_NBFC_SHARE_PERCENT) {
          this.logger.warn(
            `Partner ${partner.bankCode} fails MRR check: ` +
              `NBFC share ${mrrPercent.toFixed(2)}% < ${MIN_NBFC_SHARE_PERCENT}% required`,
          );
          continue;
        }

        selectedPartner = partner;
        break;
      }
    }

    if (!selectedPartner) {
      throw new BadRequestException(
        'No eligible co-lending partner found. All partners are at exposure capacity or fail MRR requirement.',
      );
    }

    // Calculate shares
    const bankSharePaisa = BigInt(
      Math.floor((totalLoanPaisa * selectedPartner.defaultBankSharePercent) / 100),
    );
    const nbfcSharePaisa = BigInt(totalLoanPaisa) - bankSharePaisa;

    /**
     * Blended interest rate formula:
     *   blendedRate = (bankRate * bankShare + nbfcRate * nbfcShare) / 100
     *
     * Uses Decimal.js to avoid floating-point errors on rate arithmetic.
     */
    const bankRate = new Decimal(selectedPartner.bankInterestRateBps);
    const nbfcRate = new Decimal(selectedPartner.nbfcInterestRateBps);
    const bankShare = new Decimal(selectedPartner.defaultBankSharePercent);
    const nbfcShare = new Decimal(selectedPartner.defaultNbfcSharePercent);

    const blendedRateBps = bankRate
      .mul(bankShare)
      .add(nbfcRate.mul(nbfcShare))
      .div(100)
      .round()
      .toNumber();

    // Create allocation and update exposure in a transaction
    const [allocation] = await this.prisma.$transaction([
      this.prisma.coLendingAllocation.create({
        data: {
          loanId: loan.id,
          partnerId: selectedPartner.id,
          bankSharePaisa,
          nbfcSharePaisa,
          blendedInterestRateBps: blendedRateBps,
          status: CoLendingStatus.ALLOCATED,
        },
        include: {
          partner: true,
          loan: true,
        },
      }),
      this.prisma.coLendingPartner.update({
        where: { id: selectedPartner.id },
        data: {
          currentExposurePaisa: {
            increment: BigInt(totalLoanPaisa),
          },
        },
      }),
    ]);

    this.logger.log(
      `Allocated loan ${loan.loanNumber} to partner ${selectedPartner.bankCode}: ` +
        `bank ₹${Number(bankSharePaisa) / 100} / NBFC ₹${Number(nbfcSharePaisa) / 100}, ` +
        `blended rate ${blendedRateBps}bps`,
    );

    return this.serializeAllocation(allocation);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Disbursement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark a co-lending allocation as disbursed.
   *
   * In a real system this would trigger bank API calls to split disbursement
   * amounts into the escrow account. Here we update the status to DISBURSED.
   *
   * @param orgId        Organization (tenant) UUID
   * @param allocationId CoLendingAllocation UUID
   */
  async disburse(orgId: string, allocationId: string) {
    const allocation = await this.prisma.coLendingAllocation.findFirst({
      where: { id: allocationId },
      include: { partner: true, loan: true },
    });

    if (!allocation) {
      throw new NotFoundException(
        `Co-lending allocation ${allocationId} not found`,
      );
    }

    // Verify org ownership via partner
    if (allocation.partner.organizationId !== orgId) {
      throw new NotFoundException(
        `Co-lending allocation ${allocationId} not found for organization ${orgId}`,
      );
    }

    if (allocation.status !== CoLendingStatus.ALLOCATED) {
      throw new BadRequestException(
        `Allocation is in status ${allocation.status}. Only ALLOCATED allocations can be disbursed.`,
      );
    }

    const bankShareRupees = (Number(allocation.bankSharePaisa) / 100).toFixed(2);
    const nbfcShareRupees = (Number(allocation.nbfcSharePaisa) / 100).toFixed(2);

    this.logger.log(
      `Disbursing allocation ${allocationId}: ` +
        `Bank portion ₹${bankShareRupees} | NBFC portion ₹${nbfcShareRupees}`,
    );

    const updated = await this.prisma.coLendingAllocation.update({
      where: { id: allocationId },
      data: { status: CoLendingStatus.DISBURSED },
      include: { partner: true, loan: true },
    });

    return this.serializeAllocation(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Daily Settlement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run daily settlement: split successful payments collected today
   * between bank and NBFC per their respective share percentages.
   *
   * For each DISBURSED/ACTIVE allocation:
   *  - Find payments collected today
   *  - Split: bankAmount = payment * bankShare%, nbfcAmount = payment * nbfcShare%
   *  - Log the split to console (no DB writes for MVP)
   *
   * @param orgId Organization (tenant) UUID
   */
  async runDailySettlement(orgId: string): Promise<{
    settledCount: number;
    totalCollectedPaisa: number;
    bankTotalPaisa: number;
    nbfcTotalPaisa: number;
    settlements: Array<{
      loanNumber: string;
      partnerCode: string;
      collectedPaisa: number;
      bankSharePaisa: number;
      nbfcSharePaisa: number;
    }>;
  }> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get all active/disbursed co-lending allocations for this org
    const allocations = await this.prisma.coLendingAllocation.findMany({
      where: {
        status: { in: [CoLendingStatus.DISBURSED, CoLendingStatus.ACTIVE] },
        partner: { organizationId: orgId },
      },
      include: {
        partner: true,
        loan: {
          include: { payments: true },
        },
      },
    });

    const settlements: Array<{
      loanNumber: string;
      partnerCode: string;
      collectedPaisa: number;
      bankSharePaisa: number;
      nbfcSharePaisa: number;
    }> = [];

    let totalCollectedPaisa = 0;
    let bankTotalPaisa = 0;
    let nbfcTotalPaisa = 0;

    for (const allocation of allocations) {
      // Payments collected today
      const todayPayments = allocation.loan.payments.filter(
        (p) =>
          p.status === 'SUCCESS' &&
          p.paymentDate >= startOfDay &&
          p.paymentDate < endOfDay,
      );

      if (todayPayments.length === 0) continue;

      const collectedPaisa = todayPayments.reduce(
        (sum, p) => sum + p.amountPaisa,
        0,
      );

      const bankSharePercent = allocation.partner.defaultBankSharePercent;
      const nbfcSharePercent = allocation.partner.defaultNbfcSharePercent;

      const bankSharePaisa = Math.floor(
        (collectedPaisa * bankSharePercent) / 100,
      );
      const nbfcSharePaisa = collectedPaisa - bankSharePaisa;

      totalCollectedPaisa += collectedPaisa;
      bankTotalPaisa += bankSharePaisa;
      nbfcTotalPaisa += nbfcSharePaisa;

      const settlement = {
        loanNumber: allocation.loan.loanNumber,
        partnerCode: allocation.partner.bankCode,
        collectedPaisa,
        bankSharePaisa,
        nbfcSharePaisa,
      };

      settlements.push(settlement);

      this.logger.log(
        `[SETTLEMENT] Loan ${allocation.loan.loanNumber} | ` +
          `Partner: ${allocation.partner.bankCode} | ` +
          `Collected: ₹${(collectedPaisa / 100).toFixed(2)} | ` +
          `Bank: ₹${(bankSharePaisa / 100).toFixed(2)} (${bankSharePercent}%) | ` +
          `NBFC: ₹${(nbfcSharePaisa / 100).toFixed(2)} (${nbfcSharePercent}%)`,
      );
    }

    this.logger.log(
      `Daily settlement complete: ${settlements.length} loans processed, ` +
        `total collected ₹${(totalCollectedPaisa / 100).toFixed(2)}`,
    );

    return {
      settledCount: settlements.length,
      totalCollectedPaisa,
      bankTotalPaisa,
      nbfcTotalPaisa,
      settlements,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portfolio
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the co-lending portfolio summary for the organization.
   *
   * Returns per-partner:
   *  - AUM (Assets Under Management): sum of outstanding principal on active loans
   *  - NPA count: loans with dpd >= 90
   *  - DLG utilization: dlgUtilizedPaisa / (maxExposure * dlgCapPercent / 100)
   *
   * @param orgId Organization (tenant) UUID
   */
  async getPortfolio(orgId: string) {
    const partners = await this.prisma.coLendingPartner.findMany({
      where: { organizationId: orgId },
      include: {
        allocations: {
          include: {
            loan: true,
          },
        },
      },
    });

    const portfolio = partners.map((partner) => {
      const activeAllocations = partner.allocations.filter(
        (a) =>
          a.status === CoLendingStatus.DISBURSED ||
          a.status === CoLendingStatus.ACTIVE,
      );

      // AUM: sum of outstanding principal (bank share portion)
      const aumPaisa = activeAllocations.reduce((sum, allocation) => {
        const bankShareRatio = new Decimal(partner.defaultBankSharePercent).div(100);
        const bankOutstanding = new Decimal(allocation.loan.outstandingPrincipalPaisa)
          .mul(bankShareRatio)
          .round()
          .toNumber();
        return sum + bankOutstanding;
      }, 0);

      // NPA count: 90+ DPD per RBI IRAC norms
      const npaCount = activeAllocations.filter(
        (a) => a.loan.dpd >= 90,
      ).length;

      // DLG utilization as a percentage
      const dlgCapPaisa =
        (Number(partner.maxExposurePaisa) * partner.dlgCapPercent) / 100;
      const dlgUtilizationPercent =
        dlgCapPaisa > 0
          ? (Number(partner.dlgUtilizedPaisa) / dlgCapPaisa) * 100
          : 0;

      return {
        partnerId: partner.id,
        bankName: partner.bankName,
        bankCode: partner.bankCode,
        isActive: partner.isActive,
        totalAllocations: activeAllocations.length,
        aumPaisa,
        aumRupees: parseFloat((aumPaisa / 100).toFixed(2)),
        npaCount,
        currentExposurePaisa: Number(partner.currentExposurePaisa),
        maxExposurePaisa: Number(partner.maxExposurePaisa),
        exposureUtilizationPercent:
          Number(partner.maxExposurePaisa) > 0
            ? parseFloat(
                (
                  (Number(partner.currentExposurePaisa) /
                    Number(partner.maxExposurePaisa)) *
                  100
                ).toFixed(2),
              )
            : 0,
        dlgCapPercent: partner.dlgCapPercent,
        dlgUtilizedPaisa: Number(partner.dlgUtilizedPaisa),
        dlgUtilizationPercent: parseFloat(dlgUtilizationPercent.toFixed(2)),
        bankInterestRateBps: partner.bankInterestRateBps,
        nbfcInterestRateBps: partner.nbfcInterestRateBps,
        defaultBankSharePercent: partner.defaultBankSharePercent,
        defaultNbfcSharePercent: partner.defaultNbfcSharePercent,
      };
    });

    return portfolio;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization helpers
  // ─────────────────────────────────────────────────────────────────────────

  private serializePartner(
    partner: Awaited<ReturnType<typeof this.prisma.coLendingPartner.findFirst>>,
  ) {
    if (!partner) return null;
    return {
      id: partner.id,
      organizationId: partner.organizationId,
      bankName: partner.bankName,
      bankCode: partner.bankCode,
      apiEndpoint: partner.apiEndpoint,
      defaultBankSharePercent: partner.defaultBankSharePercent,
      defaultNbfcSharePercent: partner.defaultNbfcSharePercent,
      bankInterestRateBps: partner.bankInterestRateBps,
      nbfcInterestRateBps: partner.nbfcInterestRateBps,
      maxExposurePaisa: Number(partner.maxExposurePaisa),
      currentExposurePaisa: Number(partner.currentExposurePaisa),
      dlgCapPercent: partner.dlgCapPercent,
      dlgUtilizedPaisa: Number(partner.dlgUtilizedPaisa),
      isActive: partner.isActive,
      createdAt: partner.createdAt.toISOString(),
      updatedAt: partner.updatedAt.toISOString(),
    };
  }

  private serializeAllocation(
    allocation: Awaited<ReturnType<typeof this.prisma.coLendingAllocation.findFirst>> & {
      partner?: { bankCode: string; bankName: string; defaultBankSharePercent: number; defaultNbfcSharePercent: number };
      loan?: { loanNumber: string; disbursedAmountPaisa: number };
    },
  ) {
    if (!allocation) return null;
    return {
      id: allocation.id,
      loanId: allocation.loanId,
      loanNumber: allocation.loan?.loanNumber,
      partnerId: allocation.partnerId,
      partnerCode: allocation.partner?.bankCode,
      partnerName: allocation.partner?.bankName,
      bankSharePaisa: Number(allocation.bankSharePaisa),
      nbfcSharePaisa: Number(allocation.nbfcSharePaisa),
      bankShareRupees: parseFloat((Number(allocation.bankSharePaisa) / 100).toFixed(2)),
      nbfcShareRupees: parseFloat((Number(allocation.nbfcSharePaisa) / 100).toFixed(2)),
      blendedInterestRateBps: allocation.blendedInterestRateBps,
      blendedInterestRatePercent: parseFloat(
        (allocation.blendedInterestRateBps / 100).toFixed(2),
      ),
      escrowAccountNumber: allocation.escrowAccountNumber,
      status: allocation.status,
      createdAt: allocation.createdAt.toISOString(),
      updatedAt: allocation.updatedAt.toISOString(),
    };
  }
}
