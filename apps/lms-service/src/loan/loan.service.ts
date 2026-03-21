import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { calculatePrepaymentAmount } from '@bankos/common';
import { LoanStatus } from '@prisma/client';
import { ListLoansDto } from './dto/list-loans.dto';
import { PrepayLoanDto } from './dto/prepay-loan.dto';
import { ForeCloseLoanDto } from './dto/foreclose-loan.dto';

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists loans for an organization with optional filters on status, product,
   * branch, and customer. Supports cursor-based pagination.
   */
  async listLoans(orgId: string, filters: ListLoansDto) {
    const limit = filters.limit ? Number(filters.limit) : 20;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };

    if (filters.status) where.loanStatus = filters.status;
    if (filters.product) where.productId = filters.product;
    if (filters.branch) where.branchId = filters.branch;
    if (filters.customer) where.customerId = filters.customer;

    const loans = await this.prisma.loan.findMany({
      where,
      take: limit + 1,
      ...(filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true, customerNumber: true },
        },
        product: {
          select: { id: true, name: true, code: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    const hasMore = loans.length > limit;
    const items = hasMore ? loans.slice(0, limit) : loans;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      data: items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Returns the full EMI schedule for a loan.
   */
  async getSchedule(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: {
        id: true,
        loanNumber: true,
        disbursedAmountPaisa: true,
        interestRateBps: true,
        tenureMonths: true,
        emiAmountPaisa: true,
        maturityDate: true,
        loanStatus: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const schedules = await this.prisma.loanSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });

    return {
      loan,
      schedule: schedules,
    };
  }

  /**
   * Calculates the prepayment amount for a loan using calculatePrepaymentAmount
   * from @bankos/common.
   *
   * If lastEmiDate is not provided, the most recent PAID installment's paidDate is used.
   * If no installments have been paid, the disbursement date is used.
   */
  async calculatePrepayment(orgId: string, loanId: string, dto: PrepayLoanDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    if (loan.loanStatus !== LoanStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        `Prepayment is only allowed for ACTIVE loans. Current status: ${loan.loanStatus}`,
      );
    }

    let lastEmiDate: Date;

    if (dto.lastEmiDate) {
      lastEmiDate = new Date(dto.lastEmiDate);
    } else {
      // Find the most recently paid installment
      const lastPaid = await this.prisma.loanSchedule.findFirst({
        where: { loanId, status: 'PAID' },
        orderBy: { installmentNumber: 'desc' },
        select: { paidDate: true },
      });

      lastEmiDate = lastPaid?.paidDate ?? loan.disbursementDate;
    }

    const prepaymentDate = new Date(dto.prepaymentDate);

    const result = calculatePrepaymentAmount(
      loan.outstandingPrincipalPaisa,
      loan.interestRateBps,
      lastEmiDate,
      prepaymentDate,
      dto.penaltyPercent,
    );

    return {
      loanId,
      loanNumber: loan.loanNumber,
      prepaymentDate: dto.prepaymentDate,
      lastEmiDate: lastEmiDate.toISOString(),
      ...result,
    };
  }

  /**
   * Forecloses a loan: marks status as FORECLOSED, zeroes out balances,
   * and sets the closureDate.
   */
  async foreclose(orgId: string, loanId: string, dto: ForeCloseLoanDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    if (loan.loanStatus !== LoanStatus.ACTIVE) {
      throw new UnprocessableEntityException(
        `Foreclosure is only allowed for ACTIVE loans. Current status: ${loan.loanStatus}`,
      );
    }

    const closureDate = new Date(dto.closureDate);

    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        loanStatus: LoanStatus.FORECLOSED,
        outstandingPrincipalPaisa: 0,
        outstandingInterestPaisa: 0,
        totalOverduePaisa: 0,
        dpd: 0,
        closureDate,
      },
    });

    return {
      message: `Loan ${loan.loanNumber} foreclosed successfully`,
      loanId: updated.id,
      loanNumber: updated.loanNumber,
      loanStatus: updated.loanStatus,
      closureDate: updated.closureDate,
    };
  }
}
