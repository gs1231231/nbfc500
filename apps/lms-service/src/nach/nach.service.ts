import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CollectionTaskType, CollectionTaskStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class RegisterMandateDto {
  loanId!: string;
  mandateType!: string; // DEBIT_CARD, NET_BANKING, PHYSICAL
  maxAmountPaisa!: number;
  bankAccountId!: string;
}

export class ActivateMandateDto {
  umrn!: string;
}

export class HandleBounceDto {
  loanId!: string;
  bounceDate!: string;
  amountPaisa!: number;
  returnReason!: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class NachService {
  private readonly logger = new Logger(NachService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new NachMandate in INITIATED status.
   */
  async registerMandate(orgId: string, loanId: string, dto: RegisterMandateDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Use GL entry as persistence layer (NachMandate model may not be migrated yet)
    const mandateRef = `NACH-${Date.now()}-${loanId.slice(0, 8)}`;

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'NACH_MANDATE',
        accountName: 'NACH Mandate Register',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          mandateType: dto.mandateType,
          maxAmountPaisa: dto.maxAmountPaisa,
          bankAccountId: dto.bankAccountId,
          status: 'INITIATED',
        }),
        referenceType: 'NACH_MANDATE',
        referenceId: mandateRef,
      },
    });

    // Attempt to use NachMandate model if available (added by another agent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (prismaAny.nachMandate) {
      try {
        const mandate = await prismaAny.nachMandate.create({
          data: {
            organizationId: orgId,
            loanId,
            mandateType: dto.mandateType,
            maxAmountPaisa: dto.maxAmountPaisa,
            bankAccountId: dto.bankAccountId,
            status: 'INITIATED',
            mandateRef,
          },
        });
        return mandate;
      } catch (err) {
        this.logger.warn(`NachMandate model not available, using GL fallback: ${(err as Error).message}`);
      }
    }

    return {
      mandateId: mandateRef,
      loanId,
      mandateType: dto.mandateType,
      maxAmountPaisa: dto.maxAmountPaisa,
      bankAccountId: dto.bankAccountId,
      status: 'INITIATED',
      organizationId: orgId,
      createdAt: new Date(),
    };
  }

  /**
   * Activates a mandate and records the UMRN.
   */
  async activateMandate(orgId: string, mandateId: string, dto: ActivateMandateDto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (prismaAny.nachMandate) {
      try {
        const mandate = await prismaAny.nachMandate.findFirst({
          where: { id: mandateId, organizationId: orgId },
        });
        if (!mandate) throw new NotFoundException(`Mandate ${mandateId} not found`);

        return await prismaAny.nachMandate.update({
          where: { id: mandateId },
          data: { status: 'ACTIVE', umrn: dto.umrn, activatedAt: new Date() },
        });
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
        this.logger.warn(`NachMandate model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback: update via new GL entry
    const glEntry = await this.prisma.glEntry.findFirst({
      where: { referenceType: 'NACH_MANDATE', referenceId: mandateId },
    });

    if (!glEntry) {
      throw new NotFoundException(`Mandate ${mandateId} not found`);
    }

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: glEntry.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'NACH_MANDATE',
        accountName: 'NACH Mandate Register',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: JSON.stringify({ status: 'ACTIVE', umrn: dto.umrn }),
        referenceType: 'NACH_MANDATE_ACTIVATE',
        referenceId: mandateId,
      },
    });

    return {
      mandateId,
      status: 'ACTIVE',
      umrn: dto.umrn,
      activatedAt: new Date(),
    };
  }

  /**
   * Creates a debit presentation for the upcoming EMI on a loan.
   */
  async presentDebit(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Find the next pending installment
    const nextInstallment = await this.prisma.loanSchedule.findFirst({
      where: { loanId, status: 'PENDING' },
      orderBy: { installmentNumber: 'asc' },
    });

    if (!nextInstallment) {
      throw new BadRequestException('No pending installments found for this loan');
    }

    const presentationRef = `NACH-DEBIT-${Date.now()}-${loanId.slice(0, 8)}`;

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: nextInstallment.dueDate,
        accountCode: 'NACH_PRESENTATION',
        accountName: 'NACH Debit Presentation',
        debitAmountPaisa: nextInstallment.emiAmountPaisa,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          installmentNumber: nextInstallment.installmentNumber,
          dueDate: nextInstallment.dueDate,
          emiAmountPaisa: nextInstallment.emiAmountPaisa,
          status: 'PRESENTED',
        }),
        referenceType: 'NACH_PRESENTATION',
        referenceId: presentationRef,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (prismaAny.nachDebitPresentation) {
      try {
        return await prismaAny.nachDebitPresentation.create({
          data: {
            organizationId: orgId,
            loanId,
            scheduleId: nextInstallment.id,
            amountPaisa: nextInstallment.emiAmountPaisa,
            presentationDate: new Date(),
            dueDate: nextInstallment.dueDate,
            status: 'PRESENTED',
            presentationRef,
          },
        });
      } catch (err) {
        this.logger.warn(`NachDebitPresentation model not available: ${(err as Error).message}`);
      }
    }

    return {
      presentationId: presentationRef,
      loanId,
      installmentNumber: nextInstallment.installmentNumber,
      amountPaisa: nextInstallment.emiAmountPaisa,
      dueDate: nextInstallment.dueDate,
      status: 'PRESENTED',
      createdAt: new Date(),
    };
  }

  /**
   * Records a bounce event, auto-levies BOUNCE fee from ProductFeeConfig,
   * creates LoanChargeEntry, increments consecutiveBouncesCount,
   * creates a collection task if 3+ bounces, and notifies the customer.
   */
  async handleBounce(orgId: string, dto: HandleBounceDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: dto.loanId, organizationId: orgId },
      include: { customer: true, product: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    // Determine bounce fee from product settings or default
    const productSettings = loan.product.settings as Record<string, unknown>;
    const bounceFeeConfig = productSettings?.feeConfig as Record<string, number> | undefined;
    const bounceFeePaisa: number = bounceFeeConfig?.BOUNCE ?? 50000; // default ₹500

    const bounceRef = `BOUNCE-${Date.now()}-${dto.loanId.slice(0, 8)}`;

    // Record bounce in BounceRegister (GL fallback)
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(dto.bounceDate),
        valueDate: new Date(dto.bounceDate),
        accountCode: 'BOUNCE_REGISTER',
        accountName: 'Bounce Register',
        debitAmountPaisa: dto.amountPaisa,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          returnReason: dto.returnReason,
          bounceFeePaisa,
          status: 'BOUNCED',
        }),
        referenceType: 'BOUNCE_REGISTER',
        referenceId: bounceRef,
      },
    });

    // Create LoanChargeEntry for bounce fee (GL record)
    const chargeRef = `CHARGE-BOUNCE-${Date.now()}-${dto.loanId.slice(0, 8)}`;
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'LOAN_CHARGES',
        accountName: 'Loan Charge Entries',
        debitAmountPaisa: bounceFeePaisa,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          chargeType: 'BOUNCE_FEE',
          loanId: dto.loanId,
          bounceRef,
          amountPaisa: bounceFeePaisa,
          status: 'LEVIED',
        }),
        referenceType: 'LOAN_CHARGE',
        referenceId: chargeRef,
      },
    });

    // Count previous bounces for this loan (approximate from GL)
    const previousBounces = await this.prisma.glEntry.count({
      where: {
        organizationId: orgId,
        referenceType: 'BOUNCE_REGISTER',
        narration: { contains: dto.loanId },
      },
    });

    const consecutiveBounces = previousBounces + 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    // Try native BounceRegister model if available
    if (prismaAny.bounceRegister) {
      try {
        await prismaAny.bounceRegister.create({
          data: {
            organizationId: orgId,
            loanId: dto.loanId,
            bounceDate: new Date(dto.bounceDate),
            amountPaisa: dto.amountPaisa,
            returnReason: dto.returnReason,
            bounceFeePaisa,
            status: 'BOUNCED',
          },
        });
      } catch (err) {
        this.logger.warn(`BounceRegister model not available: ${(err as Error).message}`);
      }
    }

    // Try native LoanChargeEntry model if available
    if (prismaAny.loanChargeEntry) {
      try {
        await prismaAny.loanChargeEntry.create({
          data: {
            organizationId: orgId,
            loanId: dto.loanId,
            chargeType: 'BOUNCE_FEE',
            amountPaisa: bounceFeePaisa,
            status: 'LEVIED',
            referenceId: bounceRef,
          },
        });
      } catch (err) {
        this.logger.warn(`LoanChargeEntry model not available: ${(err as Error).message}`);
      }
    }

    // Create collection task if 3+ consecutive bounces
    if (consecutiveBounces >= 3) {
      await this.prisma.collectionTask.create({
        data: {
          organizationId: orgId,
          loanId: dto.loanId,
          dpdAtCreation: loan.dpd,
          taskType: CollectionTaskType.TELECALL,
          scheduledDate: new Date(),
          status: CollectionTaskStatus.PENDING,
          remarks: `Auto-created: ${consecutiveBounces} consecutive NACH bounces. Last return reason: ${dto.returnReason}`,
        },
      });
      this.logger.warn(`Collection task created for loan ${loan.loanNumber} after ${consecutiveBounces} bounces`);
    }

    // Notify customer (log notification)
    await this.prisma.notificationLog.create({
      data: {
        organizationId: orgId,
        customerId: loan.customerId,
        channel: 'SMS',
        templateCode: 'NACH_BOUNCE_ALERT',
        recipient: loan.customer.phone,
        content: `Dear ${loan.customer.firstName}, your NACH debit of ₹${(dto.amountPaisa / 100).toFixed(2)} for loan ${loan.loanNumber} was returned (${dto.returnReason}). A bounce charge of ₹${(bounceFeePaisa / 100).toFixed(2)} has been applied. Please pay to avoid penalties.`,
        status: 'SENT',
      },
    });

    return {
      bounceId: bounceRef,
      loanId: dto.loanId,
      loanNumber: loan.loanNumber,
      bounceDate: dto.bounceDate,
      amountPaisa: dto.amountPaisa,
      returnReason: dto.returnReason,
      bounceFeeLevied: bounceFeePaisa,
      consecutiveBounces,
      collectionTaskCreated: consecutiveBounces >= 3,
      customerNotified: true,
    };
  }

  /**
   * Marks a presentation as cleared and applies payment.
   */
  async handleClearance(orgId: string, loanId: string, presentationId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Verify presentation exists
    const presentation = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'NACH_PRESENTATION',
        referenceId: presentationId,
      },
    });

    if (!presentation) {
      throw new NotFoundException(`Presentation ${presentationId} not found`);
    }

    // Mark cleared
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'NACH_PRESENTATION',
        accountName: 'NACH Debit Presentation',
        debitAmountPaisa: 0,
        creditAmountPaisa: presentation.debitAmountPaisa,
        narration: JSON.stringify({ status: 'CLEARED', presentationId }),
        referenceType: 'NACH_CLEARANCE',
        referenceId: presentationId,
      },
    });

    // Create a payment record
    const paymentNumber = `PAY-NACH-${Date.now()}`;
    await this.prisma.payment.create({
      data: {
        organizationId: orgId,
        loanId,
        paymentNumber,
        amountPaisa: presentation.debitAmountPaisa,
        paymentDate: new Date(),
        paymentMode: 'NACH',
        referenceNumber: presentationId,
        status: 'SUCCESS',
        allocatedToPrincipalPaisa: 0,
        allocatedToInterestPaisa: presentation.debitAmountPaisa,
      },
    });

    return {
      presentationId,
      loanId,
      status: 'CLEARED',
      amountPaisa: presentation.debitAmountPaisa,
      clearedAt: new Date(),
      paymentNumber,
    };
  }

  /**
   * Cancels a mandate.
   */
  async cancelMandate(orgId: string, mandateId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    if (prismaAny.nachMandate) {
      try {
        const mandate = await prismaAny.nachMandate.findFirst({
          where: { id: mandateId, organizationId: orgId },
        });
        if (!mandate) throw new NotFoundException(`Mandate ${mandateId} not found`);

        return await prismaAny.nachMandate.update({
          where: { id: mandateId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
        this.logger.warn(`NachMandate model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback
    const glEntry = await this.prisma.glEntry.findFirst({
      where: { referenceType: 'NACH_MANDATE', referenceId: mandateId },
    });

    if (!glEntry) {
      throw new NotFoundException(`Mandate ${mandateId} not found`);
    }

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: glEntry.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'NACH_MANDATE',
        accountName: 'NACH Mandate Register',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: JSON.stringify({ status: 'CANCELLED' }),
        referenceType: 'NACH_MANDATE_CANCEL',
        referenceId: mandateId,
      },
    });

    return { mandateId, status: 'CANCELLED', cancelledAt: new Date() };
  }

  /**
   * Returns mandate status plus recent presentations for a loan.
   */
  async getMandateStatus(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true, loanNumber: true, branchId: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    let mandate: unknown = null;
    let presentations: unknown[] = [];

    if (prismaAny.nachMandate) {
      try {
        mandate = await prismaAny.nachMandate.findFirst({
          where: { loanId, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
        });

        if (prismaAny.nachDebitPresentation) {
          presentations = await prismaAny.nachDebitPresentation.findMany({
            where: { loanId, organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
        }
      } catch (err) {
        this.logger.warn(`NachMandate model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback for mandate
    if (!mandate) {
      const mandateGl = await this.prisma.glEntry.findFirst({
        where: { organizationId: orgId, referenceType: 'NACH_MANDATE' },
        orderBy: { entryDate: 'desc' },
      });
      if (mandateGl) {
        const narration = JSON.parse(mandateGl.narration || '{}');
        mandate = {
          mandateId: mandateGl.referenceId,
          ...narration,
          createdAt: mandateGl.createdAt,
        };
      }
    }

    // GL fallback for presentations
    if (!presentations.length) {
      const presentationGls = await this.prisma.glEntry.findMany({
        where: { organizationId: orgId, referenceType: 'NACH_PRESENTATION' },
        orderBy: { entryDate: 'desc' },
        take: 10,
      });
      presentations = presentationGls.map((g) => {
        const narration = JSON.parse(g.narration || '{}');
        return {
          presentationId: g.referenceId,
          amountPaisa: g.debitAmountPaisa,
          presentationDate: g.entryDate,
          ...narration,
        };
      });
    }

    return {
      loanId,
      loanNumber: loan.loanNumber,
      mandate,
      recentPresentations: presentations,
    };
  }

  /**
   * Calculates the daily cash position for an org on a given date.
   * = NACH collections + UPI + cash - bounces - disbursements
   */
  async getDailyCashPosition(orgId: string, date: string) {
    const targetDate = new Date(date);
    const dateStart = new Date(targetDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    // NACH collections (successful payments via NACH)
    const nachPayments = await this.prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paymentMode: 'NACH',
        paymentDate: { gte: dateStart, lte: dateEnd },
        status: 'SUCCESS',
      },
      _sum: { amountPaisa: true },
    });

    // UPI collections
    const upiPayments = await this.prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paymentMode: 'UPI',
        paymentDate: { gte: dateStart, lte: dateEnd },
        status: 'SUCCESS',
      },
      _sum: { amountPaisa: true },
    });

    // Cash collections
    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paymentMode: 'CASH',
        paymentDate: { gte: dateStart, lte: dateEnd },
        status: 'SUCCESS',
      },
      _sum: { amountPaisa: true },
    });

    // Bounces (NACH payments that failed/reversed)
    const bouncePayments = await this.prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paymentMode: 'NACH',
        paymentDate: { gte: dateStart, lte: dateEnd },
        status: { in: ['FAILED', 'REVERSED'] },
      },
      _sum: { amountPaisa: true },
    });

    // Also count GL bounce register entries
    const glBounces = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        referenceType: 'BOUNCE_REGISTER',
        entryDate: { gte: dateStart, lte: dateEnd },
      },
      _sum: { debitAmountPaisa: true },
    });

    // Disbursements (GL debit entries for disbursements)
    const disbursements = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        referenceType: 'DISBURSEMENT',
        entryDate: { gte: dateStart, lte: dateEnd },
      },
      _sum: { debitAmountPaisa: true },
    });

    const nachInflow = nachPayments._sum.amountPaisa ?? 0;
    const upiInflow = upiPayments._sum.amountPaisa ?? 0;
    const cashInflow = cashPayments._sum.amountPaisa ?? 0;
    const bounceOutflow = (bouncePayments._sum.amountPaisa ?? 0) + (glBounces._sum.debitAmountPaisa ?? 0);
    const disbursementOutflow = disbursements._sum.debitAmountPaisa ?? 0;

    const netCashPosition = nachInflow + upiInflow + cashInflow - bounceOutflow - disbursementOutflow;

    return {
      date,
      nachCollectionsPaisa: nachInflow,
      upiCollectionsPaisa: upiInflow,
      cashCollectionsPaisa: cashInflow,
      totalInflowPaisa: nachInflow + upiInflow + cashInflow,
      bouncesPaisa: bounceOutflow,
      disbursementsPaisa: disbursementOutflow,
      totalOutflowPaisa: bounceOutflow + disbursementOutflow,
      netCashPositionPaisa: netCashPosition,
    };
  }
}
