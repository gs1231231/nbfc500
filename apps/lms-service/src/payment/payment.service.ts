import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { calculateDpd, classifyNpa } from '@bankos/common';
import { Decimal } from 'decimal.js';
import { ScheduleStatus, PaymentStatus, PaymentMode } from '@prisma/client';
import { RecordPaymentDto } from './dto/record-payment.dto';

// Configure Decimal.js for high-precision financial calculations
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

// GL account codes
const GL_BANK = '1000';
const GL_LOAN_ASSET = '1001';
const GL_INTEREST_INCOME = '3001';

const UNPAID_STATUSES: ScheduleStatus[] = [
  ScheduleStatus.PENDING,
  ScheduleStatus.PARTIALLY_PAID,
  ScheduleStatus.OVERDUE,
];

interface AllocationResult {
  penalPaisa: number;
  interestPaisa: number;
  principalPaisa: number;
  totalApplied: number;
  remainderPaisa: number;
}

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async recordPayment(
    orgId: string,
    loanId: string,
    dto: RecordPaymentDto,
  ) {
    // 1. Verify loan belongs to org
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { branch: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // 2. Generate payment number
    const paymentDate = new Date(dto.paymentDate);
    const year = paymentDate.getFullYear();
    const paymentNumber = await this.generatePaymentNumber(year);

    // 3. Apply payment across installments using a running balance
    let remainingPaisa = new Decimal(dto.amountPaisa);

    let totalPrincipalAllocated = new Decimal(0);
    let totalInterestAllocated = new Decimal(0);
    let totalPenalAllocated = new Decimal(0);

    // We'll process installments in a loop, fetching one at a time to apply
    // the payment sequentially. We keep going while there's remaining amount.
    while (remainingPaisa.greaterThan(0)) {
      const installment = await this.prisma.loanSchedule.findFirst({
        where: {
          loanId,
          status: { in: UNPAID_STATUSES },
        },
        orderBy: { installmentNumber: 'asc' },
      });

      if (!installment) {
        // No more unpaid installments — overpayment guard
        break;
      }

      // Calculate outstanding for this installment
      // penalInterestPaisa on LoanSchedule stores the total penal charged (already outstanding)
      const penalOutstanding = new Decimal(installment.penalInterestPaisa);
      const interestOutstanding = new Decimal(
        installment.interestComponentPaisa,
      ).minus(new Decimal(installment.paidInterestPaisa));
      const principalOutstanding = new Decimal(
        installment.principalComponentPaisa,
      ).minus(new Decimal(installment.paidPrincipalPaisa));

      // Allocate: penal first, then interest, then principal
      const allocation = this.allocatePayment(
        remainingPaisa,
        penalOutstanding,
        interestOutstanding,
        principalOutstanding,
      );

      const newPaidPrincipal = new Decimal(installment.paidPrincipalPaisa).plus(
        allocation.principalPaisa,
      );
      const newPaidInterest = new Decimal(installment.paidInterestPaisa).plus(
        allocation.interestPaisa,
      );
      const newPaidTotal = new Decimal(installment.paidAmountPaisa).plus(
        allocation.totalApplied,
      );

      // Determine new status
      const totalDue = new Decimal(installment.principalComponentPaisa)
        .plus(installment.interestComponentPaisa)
        .plus(installment.penalInterestPaisa);

      let newStatus: ScheduleStatus;
      let paidDate: Date | null = installment.paidDate;

      if (newPaidTotal.greaterThanOrEqualTo(totalDue)) {
        newStatus = ScheduleStatus.PAID;
        paidDate = paymentDate;
      } else {
        newStatus = ScheduleStatus.PARTIALLY_PAID;
      }

      // Update installment
      await this.prisma.loanSchedule.update({
        where: { id: installment.id },
        data: {
          paidAmountPaisa: newPaidTotal.toNumber(),
          paidPrincipalPaisa: newPaidPrincipal.toNumber(),
          paidInterestPaisa: newPaidInterest.toNumber(),
          status: newStatus,
          paidDate,
        },
      });

      totalPrincipalAllocated = totalPrincipalAllocated.plus(allocation.principalPaisa);
      totalInterestAllocated = totalInterestAllocated.plus(allocation.interestPaisa);
      totalPenalAllocated = totalPenalAllocated.plus(allocation.penalPaisa);
      remainingPaisa = new Decimal(allocation.remainderPaisa);

      // Avoid infinite loop if allocation applies nothing (degenerate case)
      if (allocation.totalApplied === 0) {
        break;
      }
    }

    // 4. Recalculate loan outstanding balances
    const updatedSchedules = await this.prisma.loanSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });

    const outstandingPrincipal = updatedSchedules
      .filter((s) => UNPAID_STATUSES.includes(s.status as ScheduleStatus))
      .reduce(
        (sum, s) =>
          sum.plus(
            new Decimal(s.principalComponentPaisa).minus(s.paidPrincipalPaisa),
          ),
        new Decimal(0),
      );

    const outstandingInterest = updatedSchedules
      .filter((s) => UNPAID_STATUSES.includes(s.status as ScheduleStatus))
      .reduce(
        (sum, s) =>
          sum.plus(
            new Decimal(s.interestComponentPaisa).minus(s.paidInterestPaisa),
          ),
        new Decimal(0),
      );

    // 5. Recalculate DPD — find oldest unpaid installment
    const today = new Date();
    let maxDpd = 0;
    let totalOverduePaisa = new Decimal(0);

    for (const s of updatedSchedules) {
      if (!UNPAID_STATUSES.includes(s.status as ScheduleStatus)) continue;
      const dueDate = new Date(s.dueDate);
      const dpd = calculateDpd(dueDate, null, today);
      if (dpd > maxDpd) maxDpd = dpd;
      if (dpd > 0) {
        const overdueAmount = new Decimal(s.principalComponentPaisa)
          .plus(s.interestComponentPaisa)
          .plus(s.penalInterestPaisa)
          .minus(s.paidAmountPaisa);
        if (overdueAmount.greaterThan(0)) {
          totalOverduePaisa = totalOverduePaisa.plus(overdueAmount);
        }
      }
    }

    const npaClassification = classifyNpa(maxDpd);

    // 6. Create Payment record
    const payment = await this.prisma.payment.create({
      data: {
        organizationId: orgId,
        loanId,
        paymentNumber,
        amountPaisa: dto.amountPaisa,
        paymentDate,
        paymentMode: dto.paymentMode as PaymentMode,
        referenceNumber: dto.referenceNumber,
        status: PaymentStatus.SUCCESS,
        allocatedToPrincipalPaisa: totalPrincipalAllocated.toNumber(),
        allocatedToInterestPaisa: totalInterestAllocated.toNumber(),
        allocatedToPenalPaisa: totalPenalAllocated.toNumber(),
      },
    });

    // 7. Update loan fields
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        outstandingPrincipalPaisa: outstandingPrincipal.toNumber(),
        outstandingInterestPaisa: outstandingInterest.toNumber(),
        totalOverduePaisa: totalOverduePaisa.toNumber(),
        dpd: maxDpd,
        npaClassification,
      },
    });

    // 8. Create GL entries
    await this.createGlEntries({
      orgId,
      branchId: loan.branchId,
      paymentId: payment.id,
      paymentDate,
      principalPaisa: totalPrincipalAllocated.toNumber(),
      interestPaisa: totalInterestAllocated.toNumber(),
      penalPaisa: totalPenalAllocated.toNumber(),
      totalPaisa: dto.amountPaisa,
      loanNumber: loan.loanNumber,
    });

    return payment;
  }

  async getPayments(orgId: string, loanId: string) {
    await this.assertLoanExists(orgId, loanId);

    return this.prisma.payment.findMany({
      where: { loanId, organizationId: orgId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getStatement(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        customer: true,
        product: true,
        schedules: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'asc' } },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const totalPaid = loan.payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum.plus(p.amountPaisa), new Decimal(0));

    const totalDue = new Decimal(loan.disbursedAmountPaisa).plus(
      loan.totalInterestPaisa,
    );

    return {
      loan: {
        loanNumber: loan.loanNumber,
        disbursedAmountPaisa: loan.disbursedAmountPaisa,
        disbursementDate: loan.disbursementDate,
        interestRateBps: loan.interestRateBps,
        tenureMonths: loan.tenureMonths,
        emiAmountPaisa: loan.emiAmountPaisa,
        maturityDate: loan.maturityDate,
        loanStatus: loan.loanStatus,
        outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
        outstandingInterestPaisa: loan.outstandingInterestPaisa,
        totalOverduePaisa: loan.totalOverduePaisa,
        dpd: loan.dpd,
        npaClassification: loan.npaClassification,
      },
      customer: {
        fullName: loan.customer.fullName,
        phone: loan.customer.phone,
        customerNumber: loan.customer.customerNumber,
      },
      summary: {
        totalDuePaisa: totalDue.toNumber(),
        totalPaidPaisa: totalPaid.toNumber(),
        balancePaisa: totalDue.minus(totalPaid).toNumber(),
      },
      schedule: loan.schedules.map((s) => ({
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        emiAmountPaisa: s.emiAmountPaisa,
        principalComponentPaisa: s.principalComponentPaisa,
        interestComponentPaisa: s.interestComponentPaisa,
        penalInterestPaisa: s.penalInterestPaisa,
        openingBalancePaisa: s.openingBalancePaisa,
        closingBalancePaisa: s.closingBalancePaisa,
        paidAmountPaisa: s.paidAmountPaisa,
        paidPrincipalPaisa: s.paidPrincipalPaisa,
        paidInterestPaisa: s.paidInterestPaisa,
        paidDate: s.paidDate,
        status: s.status,
      })),
      payments: loan.payments.map((p) => ({
        paymentNumber: p.paymentNumber,
        amountPaisa: p.amountPaisa,
        paymentDate: p.paymentDate,
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        status: p.status,
        allocatedToPrincipalPaisa: p.allocatedToPrincipalPaisa,
        allocatedToInterestPaisa: p.allocatedToInterestPaisa,
        allocatedToPenalPaisa: p.allocatedToPenalPaisa,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Allocates a payment amount in priority order:
   *   1. Penal interest
   *   2. Interest component
   *   3. Principal component
   *
   * Returns the amount allocated to each bucket and the remainder.
   */
  private allocatePayment(
    availablePaisa: Decimal,
    penalOutstanding: Decimal,
    interestOutstanding: Decimal,
    principalOutstanding: Decimal,
  ): AllocationResult {
    let remaining = availablePaisa;

    // Allocate to penal interest first
    const penalAlloc = Decimal.min(remaining, penalOutstanding);
    remaining = remaining.minus(penalAlloc);

    // Then interest
    const interestAlloc = Decimal.min(remaining, interestOutstanding);
    remaining = remaining.minus(interestAlloc);

    // Then principal
    const principalAlloc = Decimal.min(remaining, principalOutstanding);
    remaining = remaining.minus(principalAlloc);

    const totalApplied = penalAlloc.plus(interestAlloc).plus(principalAlloc);

    return {
      penalPaisa: penalAlloc.toNumber(),
      interestPaisa: interestAlloc.toNumber(),
      principalPaisa: principalAlloc.toNumber(),
      totalApplied: totalApplied.toNumber(),
      remainderPaisa: remaining.toNumber(),
    };
  }

  /**
   * Generates a unique payment number in the format PAY/YYYY/NNNNNN.
   * The sequence number is derived from the count of payments in the
   * given year, padded to 6 digits.
   */
  private async generatePaymentNumber(year: number): Promise<string> {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await this.prisma.payment.count({
      where: {
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
    });

    const seq = String(count + 1).padStart(6, '0');
    return `PAY/${year}/${seq}`;
  }

  /**
   * Creates double-entry GL entries for a payment:
   *   Dr  Bank Account (1000)           — full payment received
   *   Cr  Interest Income (3001)        — interest + penal portion
   *   Cr  Loan Asset Account (1001)     — principal portion
   */
  private async createGlEntries(params: {
    orgId: string;
    branchId: string;
    paymentId: string;
    paymentDate: Date;
    principalPaisa: number;
    interestPaisa: number;
    penalPaisa: number;
    totalPaisa: number;
    loanNumber: string;
  }): Promise<void> {
    const {
      orgId,
      branchId,
      paymentId,
      paymentDate,
      principalPaisa,
      interestPaisa,
      penalPaisa,
      totalPaisa,
      loanNumber,
    } = params;

    const incomeCredit = new Decimal(interestPaisa).plus(penalPaisa).toNumber();

    const entries = [
      // Debit: Bank account for total payment received
      {
        organizationId: orgId,
        branchId,
        entryDate: paymentDate,
        valueDate: paymentDate,
        accountCode: GL_BANK,
        accountName: 'Bank Account',
        debitAmountPaisa: totalPaisa,
        creditAmountPaisa: 0,
        narration: `Payment received against loan ${loanNumber}`,
        referenceType: 'PAYMENT',
        referenceId: paymentId,
      },
      // Credit: Interest Income for interest + penal
      ...(incomeCredit > 0
        ? [
            {
              organizationId: orgId,
              branchId,
              entryDate: paymentDate,
              valueDate: paymentDate,
              accountCode: GL_INTEREST_INCOME,
              accountName: 'Interest Income',
              debitAmountPaisa: 0,
              creditAmountPaisa: incomeCredit,
              narration: `Interest & penal income on loan ${loanNumber}`,
              referenceType: 'PAYMENT',
              referenceId: paymentId,
            },
          ]
        : []),
      // Credit: Loan Asset for principal repaid
      ...(principalPaisa > 0
        ? [
            {
              organizationId: orgId,
              branchId,
              entryDate: paymentDate,
              valueDate: paymentDate,
              accountCode: GL_LOAN_ASSET,
              accountName: 'Loan Asset',
              debitAmountPaisa: 0,
              creditAmountPaisa: principalPaisa,
              narration: `Principal repayment on loan ${loanNumber}`,
              referenceType: 'PAYMENT',
              referenceId: paymentId,
            },
          ]
        : []),
    ];

    await this.prisma.glEntry.createMany({ data: entries });
  }

  private async assertLoanExists(orgId: string, loanId: string): Promise<void> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }
  }
}
