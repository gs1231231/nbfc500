import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { calculateEmi, generateSchedule } from '@bankos/common';
import {
  InitiateBalanceTransferDto,
  CalculateSavingsDto,
  TopUpLoanDto,
} from './dto/bt.dto';

// Minimum payment track record required for top-up eligibility (months)
const MIN_PAYMENT_TRACK_MONTHS = 6;
// Maximum LTV allowed post top-up for secured products (percent)
const MAX_LTV_PERCENT = 80;

@Injectable()
export class BtService {
  private readonly logger = new Logger(BtService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Balance Transfer
  // ============================================================

  /**
   * Initiates a Balance Transfer application.
   *
   * Creates a LoanApplication record with:
   *  - requestedAmountPaisa = foreclosureAmountPaisa + optional topUpAmountPaisa
   *  - customFields capturing source lender details and BT metadata
   *  - status = APPLICATION
   */
  async initiateBalanceTransfer(orgId: string, dto: InitiateBalanceTransferDto) {
    // Validate customer, product, branch exist
    const [customer, product, branch] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: dto.customerId, organizationId: orgId } }),
      this.prisma.loanProduct.findFirst({ where: { id: dto.productId, organizationId: orgId } }),
      this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId: orgId } }),
    ]);

    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);
    if (!branch) throw new NotFoundException(`Branch ${dto.branchId} not found`);

    const totalAmountPaisa = dto.foreclosureAmountPaisa + (dto.topUpAmountPaisa ?? 0);

    // Generate application number
    const year = new Date().getFullYear();
    const count = await this.prisma.loanApplication.count({
      where: { organizationId: orgId },
    });
    const applicationNumber = `BT/${year}/${String(count + 1).padStart(8, '0')}`;

    // Pre-calculate projected savings for capture in customFields
    const savings = this._computeSavings({
      currentOutstandingPaisa: dto.currentOutstandingPaisa,
      currentRateBps: dto.currentRateBps,
      currentTenureRemainingMonths: dto.currentTenureRemainingMonths,
      currentEmiPaisa: dto.currentEmiPaisa,
      proposedRateBps: dto.proposedRateBps,
      proposedTenureMonths: dto.proposedTenureMonths,
      foreclosureAmountPaisa: dto.foreclosureAmountPaisa,
      processingFeePercent: 0,
    });

    const application = await this.prisma.loanApplication.create({
      data: {
        organizationId: orgId,
        branchId: dto.branchId,
        applicationNumber,
        customerId: dto.customerId,
        productId: dto.productId,
        requestedAmountPaisa: totalAmountPaisa,
        requestedTenureMonths: dto.proposedTenureMonths,
        status: 'APPLICATION',
        sourceType: 'BRANCH',
        customFields: {
          applicationType: 'BALANCE_TRANSFER',
          sourceLender: dto.sourceLender,
          currentOutstandingPaisa: dto.currentOutstandingPaisa,
          foreclosureAmountPaisa: dto.foreclosureAmountPaisa,
          currentRateBps: dto.currentRateBps,
          currentTenureRemainingMonths: dto.currentTenureRemainingMonths,
          currentEmiPaisa: dto.currentEmiPaisa,
          proposedRateBps: dto.proposedRateBps,
          topUpAmountPaisa: dto.topUpAmountPaisa ?? 0,
          projectedSavings: savings,
          remarks: dto.remarks ?? null,
        },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        product: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(
      `Balance Transfer initiated: ${applicationNumber} for customer ${customer.fullName}. ` +
        `BT amount: ${dto.foreclosureAmountPaisa / 100} INR from ${dto.sourceLender}`,
    );

    return {
      ...application,
      projectedSavings: savings,
    };
  }

  /**
   * Calculates EMI and interest savings from a balance transfer.
   *
   * Returns:
   *  - Old EMI vs new EMI
   *  - Total interest under old vs new loan
   *  - Net monetary savings
   *  - Payback period for processing fee (if any)
   */
  async calculateSavings(dto: CalculateSavingsDto) {
    return this._computeSavings(dto);
  }

  /**
   * Internal helper — pure financial computation, no DB access.
   */
  private _computeSavings(dto: CalculateSavingsDto) {
    const {
      currentOutstandingPaisa,
      currentRateBps,
      currentTenureRemainingMonths,
      currentEmiPaisa,
      proposedRateBps,
      proposedTenureMonths,
      foreclosureAmountPaisa,
      processingFeePercent = 0,
    } = dto;

    // New EMI at proposed terms on the foreclosure amount
    const newEmiPaisa = calculateEmi(
      foreclosureAmountPaisa,
      proposedRateBps,
      proposedTenureMonths,
    );

    // Total payable under existing loan (remaining installments)
    const oldTotalPayablePaisa = currentEmiPaisa * currentTenureRemainingMonths;
    const oldTotalInterestPaisa = oldTotalPayablePaisa - currentOutstandingPaisa;

    // Total payable under new loan
    const newTotalPayablePaisa = newEmiPaisa * proposedTenureMonths;
    const newTotalInterestPaisa = newTotalPayablePaisa - foreclosureAmountPaisa;

    // Processing fee cost
    const processingFeePaisa = Math.round((foreclosureAmountPaisa * processingFeePercent) / 100);

    // Net savings = (old total - new total) - processing fee
    const grossSavingsPaisa = oldTotalPayablePaisa - newTotalPayablePaisa;
    const netSavingsPaisa = grossSavingsPaisa - processingFeePaisa;

    // EMI savings per month
    const emiSavingsPaisa = currentEmiPaisa - newEmiPaisa;

    // Break-even months: how many months of EMI savings to recoup processing fee
    const breakEvenMonths =
      emiSavingsPaisa > 0 ? Math.ceil(processingFeePaisa / emiSavingsPaisa) : null;

    return {
      currentEmiPaisa,
      newEmiPaisa,
      emiSavingsPaisa,
      emiSavingsRupees: emiSavingsPaisa / 100,
      oldTotalInterestPaisa,
      newTotalInterestPaisa,
      interestSavingsPaisa: oldTotalInterestPaisa - newTotalInterestPaisa,
      processingFeePaisa,
      netSavingsPaisa,
      netSavingsRupees: netSavingsPaisa / 100,
      breakEvenMonths,
      rateReductionBps: currentRateBps - proposedRateBps,
      worthwhileBT: netSavingsPaisa > 0,
    };
  }

  // ============================================================
  // Top-Up Loan
  // ============================================================

  /**
   * Processes a Top-Up disbursement on an existing active loan.
   *
   * Eligibility checks:
   *  a. Loan must be ACTIVE.
   *  b. Customer must have paid >= MIN_PAYMENT_TRACK_MONTHS installments on time.
   *  c. For secured loans (product.isSecured), LTV headroom must accommodate the top-up.
   *
   * On approval:
   *  - Increases outstandingPrincipalPaisa by the top-up amount.
   *  - Recalculates EMI and regenerates the remaining schedule.
   */
  async processTopUp(orgId: string, loanId: string, dto: TopUpLoanDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        product: true,
        schedules: { orderBy: { installmentNumber: 'asc' } },
        customer: { select: { id: true, fullName: true } },
      },
    });

    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    if (loan.loanStatus !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        `Top-up is only allowed for ACTIVE loans. Current status: ${loan.loanStatus}`,
      );
    }

    // Payment track check: count PAID installments
    const paidInstallments = loan.schedules.filter((s) => s.status === 'PAID');
    if (paidInstallments.length < MIN_PAYMENT_TRACK_MONTHS) {
      throw new UnprocessableEntityException(
        `Top-up requires at least ${MIN_PAYMENT_TRACK_MONTHS} paid installments. ` +
          `Customer has ${paidInstallments.length} paid installment(s).`,
      );
    }

    // Check for any overdue installments — block top-up if customer has active arrears
    const overdueCount = loan.schedules.filter((s) => s.status === 'OVERDUE').length;
    if (overdueCount > 0) {
      throw new UnprocessableEntityException(
        `Top-up is not allowed when there are ${overdueCount} overdue installment(s).`,
      );
    }

    // Determine new outstanding principal post top-up
    const newPrincipalPaisa = loan.outstandingPrincipalPaisa + dto.topUpAmountPaisa;

    // LTV check for secured products
    if (loan.product.isSecured) {
      const maxAllowedPaisa = Math.round(
        (loan.disbursedAmountPaisa * MAX_LTV_PERCENT) / 100,
      );
      if (newPrincipalPaisa > maxAllowedPaisa) {
        throw new UnprocessableEntityException(
          `Top-up would breach LTV limit. ` +
            `New combined outstanding: ₹${newPrincipalPaisa / 100}, ` +
            `Max allowed (${MAX_LTV_PERCENT}% LTV): ₹${maxAllowedPaisa / 100}.`,
        );
      }
    }

    const topUpRateBps = dto.topUpRateBps ?? loan.interestRateBps;
    const pendingSchedules = loan.schedules.filter(
      (s) => s.status === 'PENDING' || s.status === 'OVERDUE',
    );
    const remainingTenure = dto.topUpTenureMonths ?? pendingSchedules.length;

    if (remainingTenure <= 0) {
      throw new UnprocessableEntityException('Remaining tenure must be greater than 0');
    }

    const firstEmiDate =
      pendingSchedules.length > 0
        ? pendingSchedules[0].dueDate
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            return d;
          })();

    // Recalculate new combined EMI
    const newEmiPaisa = calculateEmi(newPrincipalPaisa, topUpRateBps, remainingTenure);

    // Regenerate schedule
    const newSchedule = generateSchedule({
      principalPaisa: newPrincipalPaisa,
      annualRateBps: topUpRateBps,
      tenureMonths: remainingTenure,
      disbursementDate: new Date(),
      firstEmiDate,
    });

    const nextInstallmentNumber = paidInstallments.length + 1;

    // Execute in transaction
    const updatedLoan = await this.prisma.$transaction(async (tx) => {
      // Remove old pending installments
      await tx.loanSchedule.deleteMany({
        where: {
          loanId: loan.id,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      });

      // Create new combined schedule
      await tx.loanSchedule.createMany({
        data: newSchedule.map((entry, i) => ({
          loanId: loan.id,
          installmentNumber: nextInstallmentNumber + i,
          dueDate: entry.dueDate,
          emiAmountPaisa: entry.emiAmountPaisa,
          principalComponentPaisa: entry.principalPaisa,
          interestComponentPaisa: entry.interestPaisa,
          openingBalancePaisa: entry.openingBalancePaisa,
          closingBalancePaisa: entry.closingBalancePaisa,
          status: 'PENDING',
        })),
      });

      // Update loan record
      return tx.loan.update({
        where: { id: loan.id },
        data: {
          outstandingPrincipalPaisa: newPrincipalPaisa,
          disbursedAmountPaisa: loan.disbursedAmountPaisa + dto.topUpAmountPaisa,
          interestRateBps: topUpRateBps,
          emiAmountPaisa: newEmiPaisa,
          maturityDate: newSchedule[newSchedule.length - 1]?.dueDate ?? loan.maturityDate,
          tenureMonths: remainingTenure,
        },
        include: {
          customer: { select: { id: true, fullName: true } },
          product: { select: { id: true, name: true } },
        },
      });
    });

    this.logger.log(
      `Top-up of ₹${dto.topUpAmountPaisa / 100} processed for loan ${loan.loanNumber}. ` +
        `New outstanding: ₹${newPrincipalPaisa / 100}`,
    );

    return {
      message: `Top-up processed successfully for loan ${loan.loanNumber}`,
      loanId: updatedLoan.id,
      loanNumber: updatedLoan.loanNumber,
      topUpAmountPaisa: dto.topUpAmountPaisa,
      topUpAmountRupees: dto.topUpAmountPaisa / 100,
      newOutstandingPaisa: newPrincipalPaisa,
      newOutstandingRupees: newPrincipalPaisa / 100,
      newEmiPaisa,
      newEmiRupees: newEmiPaisa / 100,
      newRateBps: topUpRateBps,
      remainingTenure,
      newMaturityDate: updatedLoan.maturityDate,
    };
  }
}
