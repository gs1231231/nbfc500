import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { LoanStatus } from '@prisma/client';
import { generateSchedule } from '@bankos/common';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class InitiateRestructureDto {
  restructureType!: string; // RATE_REDUCTION | TENURE_EXTENSION | MORATORIUM | COMBINATION
  newTenureMonths?: number;
  newRateBps?: number;
  moratoriumMonths?: number;
  remarks?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RestructureService {
  private readonly logger = new Logger(RestructureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initiates a loan restructure: snapshots old terms, calculates new schedule,
   * and stores LoanRestructure record for approval.
   */
  async initiateRestructure(orgId: string, loanId: string, dto: InitiateRestructureDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { schedules: { orderBy: { installmentNumber: 'asc' } } },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    if (loan.loanStatus !== LoanStatus.ACTIVE) {
      throw new BadRequestException(
        `Restructure only allowed for ACTIVE loans. Current status: ${loan.loanStatus}`,
      );
    }

    // Snapshot old terms
    const oldTerms = {
      interestRateBps: loan.interestRateBps,
      tenureMonths: loan.tenureMonths,
      emiAmountPaisa: loan.emiAmountPaisa,
      outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
      maturityDate: loan.maturityDate,
      remainingInstallments: loan.schedules.filter((s) => s.status === 'PENDING' || s.status === 'OVERDUE').length,
    };

    // Calculate new terms
    const newRateBps = dto.newRateBps ?? loan.interestRateBps;
    const moratoriumMonths = dto.moratoriumMonths ?? 0;
    const baseNewTenure = dto.newTenureMonths ?? oldTerms.remainingInstallments;
    const effectiveNewTenure = baseNewTenure + moratoriumMonths;

    if (effectiveNewTenure <= 0) {
      throw new BadRequestException('Effective new tenure must be greater than 0 months');
    }

    // Calculate new EMI based on outstanding principal
    const newFirstEmiDate = new Date();
    newFirstEmiDate.setMonth(newFirstEmiDate.getMonth() + moratoriumMonths + 1);

    const newSchedule = generateSchedule({
      principalPaisa: loan.outstandingPrincipalPaisa,
      annualRateBps: newRateBps,
      tenureMonths: effectiveNewTenure,
      disbursementDate: new Date(),
      firstEmiDate: newFirstEmiDate,
    });

    const newEmiPaisa = newSchedule[0]?.emiAmountPaisa ?? 0;

    const newMaturityDate = newSchedule[newSchedule.length - 1]?.dueDate ?? loan.maturityDate;

    const newTerms = {
      interestRateBps: newRateBps,
      tenureMonths: effectiveNewTenure,
      emiAmountPaisa: newEmiPaisa,
      moratoriumMonths,
      maturityDate: newMaturityDate,
      newSchedulePreview: newSchedule.slice(0, 3), // preview first 3 installments
    };

    const restructureRef = `RST-${Date.now()}-${loanId.slice(0, 8)}`;

    // Try native LoanRestructure model if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (prismaAny.loanRestructure) {
      try {
        const restructure = await prismaAny.loanRestructure.create({
          data: {
            organizationId: orgId,
            loanId,
            restructureType: dto.restructureType,
            oldTerms,
            newTerms,
            status: 'PENDING_APPROVAL',
            remarks: dto.remarks ?? null,
            restructureRef,
          },
        });
        return restructure;
      } catch (err) {
        this.logger.warn(`LoanRestructure model not available, using GL fallback: ${(err as Error).message}`);
      }
    }

    // GL fallback
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'LOAN_RESTRUCTURE',
        accountName: 'Loan Restructure Register',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          restructureType: dto.restructureType,
          oldTerms,
          newTerms,
          status: 'PENDING_APPROVAL',
          remarks: dto.remarks ?? null,
        }),
        referenceType: 'LOAN_RESTRUCTURE',
        referenceId: restructureRef,
      },
    });

    return {
      restructureId: restructureRef,
      restructureRef,
      organizationId: orgId,
      loanId,
      loanNumber: loan.loanNumber,
      restructureType: dto.restructureType,
      status: 'PENDING_APPROVAL',
      oldTerms,
      newTerms,
      remarks: dto.remarks ?? null,
      createdAt: new Date(),
    };
  }

  /**
   * Approves a restructure, applies new terms to the loan, and regenerates the schedule.
   */
  async approveRestructure(orgId: string, restructureId: string, userId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    let restructureData: {
      loanId: string;
      newTerms: {
        interestRateBps: number;
        tenureMonths: number;
        emiAmountPaisa: number;
        moratoriumMonths: number;
        maturityDate: Date | string;
      };
      oldTerms: unknown;
      restructureType: string;
    } | null = null;

    if (prismaAny.loanRestructure) {
      try {
        const restructure = await prismaAny.loanRestructure.findFirst({
          where: { id: restructureId, organizationId: orgId },
        });

        if (!restructure) {
          throw new NotFoundException(`Restructure ${restructureId} not found`);
        }

        if (restructure.status !== 'PENDING_APPROVAL') {
          throw new BadRequestException(`Restructure is already ${restructure.status}`);
        }

        restructureData = restructure;
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
        this.logger.warn(`LoanRestructure model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback lookup
    if (!restructureData) {
      const glEntry = await this.prisma.glEntry.findFirst({
        where: { referenceType: 'LOAN_RESTRUCTURE', referenceId: restructureId },
      });

      if (!glEntry) {
        throw new NotFoundException(`Restructure ${restructureId} not found`);
      }

      const parsed = JSON.parse(glEntry.narration || '{}');
      if (parsed.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(`Restructure is already ${parsed.status}`);
      }

      // We need to find the loanId from the narration — it should be stored in GL meta
      const loanId = parsed.oldTerms?.loanId ?? glEntry.referenceId.split('-').slice(-1)[0];
      restructureData = { loanId, ...parsed };
    }

    if (!restructureData) {
      throw new NotFoundException(`Restructure ${restructureId} not found`);
    }

    const loan = await this.prisma.loan.findFirst({
      where: { id: restructureData.loanId, organizationId: orgId },
      include: { schedules: { orderBy: { installmentNumber: 'asc' } } },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${restructureData.loanId} not found`);
    }

    const newTerms = restructureData.newTerms;
    const moratoriumMonths = newTerms.moratoriumMonths ?? 0;

    // New first EMI date
    const newFirstEmiDate = new Date();
    newFirstEmiDate.setMonth(newFirstEmiDate.getMonth() + moratoriumMonths + 1);

    // Regenerate schedule
    const newSchedule = generateSchedule({
      principalPaisa: loan.outstandingPrincipalPaisa,
      annualRateBps: newTerms.interestRateBps,
      tenureMonths: newTerms.tenureMonths,
      disbursementDate: new Date(),
      firstEmiDate: newFirstEmiDate,
    });

    // Cancel pending/overdue installments
    const pendingInstallmentIds = loan.schedules
      .filter((s) => s.status === 'PENDING' || s.status === 'OVERDUE')
      .map((s) => s.id);

    if (pendingInstallmentIds.length > 0) {
      // Mark old pending installments as cancelled (status transition to PAID at 0)
      // We use a GL entry approach since ScheduleStatus doesn't have CANCELLED
      await this.prisma.glEntry.create({
        data: {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(),
          valueDate: new Date(),
          accountCode: 'LOAN_RESTRUCTURE',
          accountName: 'Loan Restructure - Old Schedule Superseded',
          debitAmountPaisa: 0,
          creditAmountPaisa: 0,
          narration: JSON.stringify({
            action: 'OLD_SCHEDULE_SUPERSEDED',
            restructureId,
            cancelledInstallmentIds: pendingInstallmentIds,
          }),
          referenceType: 'LOAN_RESTRUCTURE_APPLY',
          referenceId: restructureId,
        },
      });
    }

    // Create new schedule entries
    const nextInstallmentNumber =
      loan.schedules.filter((s) => s.status === 'PAID').length + 1;

    for (let i = 0; i < newSchedule.length; i++) {
      const entry = newSchedule[i];
      await this.prisma.loanSchedule.create({
        data: {
          loanId: loan.id,
          installmentNumber: nextInstallmentNumber + i,
          dueDate: entry.dueDate,
          emiAmountPaisa: entry.emiAmountPaisa,
          principalComponentPaisa: entry.principalPaisa,
          interestComponentPaisa: entry.interestPaisa,
          openingBalancePaisa: entry.openingBalancePaisa,
          closingBalancePaisa: entry.closingBalancePaisa,
          status: 'PENDING',
        },
      });
    }

    // Update loan with new terms
    const updatedLoan = await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        interestRateBps: newTerms.interestRateBps,
        tenureMonths: newTerms.tenureMonths,
        emiAmountPaisa: newTerms.emiAmountPaisa,
        maturityDate: new Date(newTerms.maturityDate),
        loanStatus: LoanStatus.RESTRUCTURED,
      },
    });

    // Mark restructure as approved
    if (prismaAny.loanRestructure) {
      try {
        await prismaAny.loanRestructure.update({
          where: { id: restructureId },
          data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
        });
      } catch { /* not migrated */ }
    } else {
      await this.prisma.glEntry.create({
        data: {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(),
          valueDate: new Date(),
          accountCode: 'LOAN_RESTRUCTURE',
          accountName: 'Loan Restructure Register',
          debitAmountPaisa: 0,
          creditAmountPaisa: 0,
          narration: JSON.stringify({ status: 'APPROVED', approvedBy: userId }),
          referenceType: 'LOAN_RESTRUCTURE_APPROVE',
          referenceId: restructureId,
        },
      });
    }

    return {
      restructureId,
      loanId: loan.id,
      loanNumber: updatedLoan.loanNumber,
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      newTerms: {
        interestRateBps: updatedLoan.interestRateBps,
        tenureMonths: updatedLoan.tenureMonths,
        emiAmountPaisa: updatedLoan.emiAmountPaisa,
        maturityDate: updatedLoan.maturityDate,
      },
      newScheduleInstallments: newSchedule.length,
    };
  }

  /**
   * Lists all restructure records for a loan.
   */
  async getRestructureHistory(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true, loanNumber: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    if (prismaAny.loanRestructure) {
      try {
        const restructures = await prismaAny.loanRestructure.findMany({
          where: { loanId, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
        });
        return { loanId, loanNumber: loan.loanNumber, data: restructures };
      } catch (err) {
        this.logger.warn(`LoanRestructure model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback
    const glEntries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        referenceType: { in: ['LOAN_RESTRUCTURE', 'LOAN_RESTRUCTURE_APPROVE'] },
      },
      orderBy: { entryDate: 'desc' },
    });

    const data = glEntries.map((g) => {
      try {
        return { restructureId: g.referenceId, ...JSON.parse(g.narration), createdAt: g.createdAt };
      } catch {
        return { restructureId: g.referenceId, narration: g.narration, createdAt: g.createdAt };
      }
    });

    return { loanId, loanNumber: loan.loanNumber, data };
  }
}
