import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateCallLogDto {
  loanId!: string;
  calledNumber!: string;
  duration!: number; // seconds
  disposition!: string;
  ptpDate?: string;
  remarks?: string;
}

export class CreateVisitLogDto {
  loanId!: string;
  checkInLocation!: { lat: number; lng: number; address?: string };
  addressVisited!: string;
  personMet!: string;
  visitOutcome!: string;
  amountCollectedPaisa?: number;
  checkOutLocation?: { lat: number; lng: number };
  photoUrls?: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a collection call log with duration, disposition, and PTP details.
   */
  async createCallLog(orgId: string, loanId: string, dto: CreateCallLogDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const callRef = `CALL-${Date.now()}-${loanId.slice(0, 8)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    // Try native CollectionCallLog model if available
    if (prismaAny.collectionCallLog) {
      try {
        const callLog = await prismaAny.collectionCallLog.create({
          data: {
            organizationId: orgId,
            loanId,
            calledNumber: dto.calledNumber,
            duration: dto.duration,
            disposition: dto.disposition,
            ptpDate: dto.ptpDate ? new Date(dto.ptpDate) : null,
            remarks: dto.remarks ?? null,
            callRef,
          },
        });
        return callLog;
      } catch (err) {
        this.logger.warn(`CollectionCallLog model not available, using GL fallback: ${(err as Error).message}`);
      }
    }

    // GL fallback
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'COLLECTION_CALL_LOG',
        accountName: 'Collection Call Logs',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: JSON.stringify({
          loanId,
          loanNumber: loan.loanNumber,
          customerId: loan.customerId,
          customerName: loan.customer.fullName,
          calledNumber: dto.calledNumber,
          duration: dto.duration,
          disposition: dto.disposition,
          ptpDate: dto.ptpDate ?? null,
          remarks: dto.remarks ?? null,
        }),
        referenceType: 'CALL_LOG',
        referenceId: callRef,
      },
    });

    // Also update collection task disposition if PTP
    if (dto.disposition === 'PTP' && dto.ptpDate) {
      const openTask = await this.prisma.collectionTask.findFirst({
        where: {
          loanId,
          organizationId: orgId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        orderBy: { scheduledDate: 'desc' },
      });

      if (openTask) {
        await this.prisma.collectionTask.update({
          where: { id: openTask.id },
          data: {
            disposition: 'PTP',
            ptpDate: new Date(dto.ptpDate),
            remarks: dto.remarks ?? openTask.remarks,
          },
        });
      }
    }

    return {
      callId: callRef,
      organizationId: orgId,
      loanId,
      loanNumber: loan.loanNumber,
      calledNumber: dto.calledNumber,
      duration: dto.duration,
      disposition: dto.disposition,
      ptpDate: dto.ptpDate ?? null,
      remarks: dto.remarks ?? null,
      createdAt: new Date(),
    };
  }

  /**
   * Records a field visit log with GPS check-in/out, photos, and outcome.
   */
  async createVisitLog(orgId: string, loanId: string, dto: CreateVisitLogDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const visitRef = `VISIT-${Date.now()}-${loanId.slice(0, 8)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    // Try native FieldVisitLog model if available
    if (prismaAny.fieldVisitLog) {
      try {
        const visitLog = await prismaAny.fieldVisitLog.create({
          data: {
            organizationId: orgId,
            loanId,
            checkInLat: dto.checkInLocation.lat,
            checkInLng: dto.checkInLocation.lng,
            checkInAddress: dto.checkInLocation.address ?? null,
            addressVisited: dto.addressVisited,
            personMet: dto.personMet,
            visitOutcome: dto.visitOutcome,
            amountCollectedPaisa: dto.amountCollectedPaisa ?? 0,
            checkOutLat: dto.checkOutLocation?.lat ?? null,
            checkOutLng: dto.checkOutLocation?.lng ?? null,
            photoUrls: dto.photoUrls ? JSON.stringify(dto.photoUrls) : null,
            visitRef,
          },
        });
        return visitLog;
      } catch (err) {
        this.logger.warn(`FieldVisitLog model not available, using GL fallback: ${(err as Error).message}`);
      }
    }

    // GL fallback
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'COLLECTION_VISIT_LOG',
        accountName: 'Collection Field Visit Logs',
        debitAmountPaisa: 0,
        creditAmountPaisa: dto.amountCollectedPaisa ?? 0,
        narration: JSON.stringify({
          loanId,
          loanNumber: loan.loanNumber,
          checkInLocation: dto.checkInLocation,
          addressVisited: dto.addressVisited,
          personMet: dto.personMet,
          visitOutcome: dto.visitOutcome,
          amountCollectedPaisa: dto.amountCollectedPaisa ?? 0,
          checkOutLocation: dto.checkOutLocation ?? null,
          photoUrls: dto.photoUrls ?? [],
        }),
        referenceType: 'VISIT_LOG',
        referenceId: visitRef,
      },
    });

    // If cash was collected, record a payment
    if (dto.amountCollectedPaisa && dto.amountCollectedPaisa > 0) {
      const paymentNumber = `PAY-CASH-${Date.now()}`;
      await this.prisma.payment.create({
        data: {
          organizationId: orgId,
          loanId,
          paymentNumber,
          amountPaisa: dto.amountCollectedPaisa,
          paymentDate: new Date(),
          paymentMode: 'CASH',
          referenceNumber: visitRef,
          status: 'SUCCESS',
          allocatedToPrincipalPaisa: 0,
          allocatedToInterestPaisa: dto.amountCollectedPaisa,
        },
      });
    }

    return {
      visitId: visitRef,
      organizationId: orgId,
      loanId,
      loanNumber: loan.loanNumber,
      checkInLocation: dto.checkInLocation,
      addressVisited: dto.addressVisited,
      personMet: dto.personMet,
      visitOutcome: dto.visitOutcome,
      amountCollectedPaisa: dto.amountCollectedPaisa ?? 0,
      checkOutLocation: dto.checkOutLocation ?? null,
      photoUrls: dto.photoUrls ?? [],
      createdAt: new Date(),
    };
  }

  /**
   * Lists call logs for a loan.
   */
  async getCallLogs(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true, loanNumber: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    if (prismaAny.collectionCallLog) {
      try {
        const logs = await prismaAny.collectionCallLog.findMany({
          where: { loanId, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
        });
        return { loanId, loanNumber: loan.loanNumber, data: logs };
      } catch (err) {
        this.logger.warn(`CollectionCallLog model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback
    const glLogs = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        referenceType: 'CALL_LOG',
        narration: { contains: loanId },
      },
      orderBy: { entryDate: 'desc' },
    });

    const data = glLogs.map((g) => {
      try {
        return { callId: g.referenceId, ...JSON.parse(g.narration), createdAt: g.createdAt };
      } catch {
        return { callId: g.referenceId, narration: g.narration, createdAt: g.createdAt };
      }
    });

    return { loanId, loanNumber: loan.loanNumber, data };
  }

  /**
   * Lists visit logs for a loan.
   */
  async getVisitLogs(orgId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      select: { id: true, loanNumber: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;

    if (prismaAny.fieldVisitLog) {
      try {
        const logs = await prismaAny.fieldVisitLog.findMany({
          where: { loanId, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
        });
        return { loanId, loanNumber: loan.loanNumber, data: logs };
      } catch (err) {
        this.logger.warn(`FieldVisitLog model not available: ${(err as Error).message}`);
      }
    }

    // GL fallback
    const glLogs = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        referenceType: 'VISIT_LOG',
        narration: { contains: loanId },
      },
      orderBy: { entryDate: 'desc' },
    });

    const data = glLogs.map((g) => {
      try {
        return { visitId: g.referenceId, ...JSON.parse(g.narration), createdAt: g.createdAt };
      } catch {
        return { visitId: g.referenceId, narration: g.narration, createdAt: g.createdAt };
      }
    });

    return { loanId, loanNumber: loan.loanNumber, data };
  }
}
