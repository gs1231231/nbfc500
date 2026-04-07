import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { Prisma } from '@prisma/client';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { AssignVerificationDto } from './dto/assign-verification.dto';
import { SubmitReportDto } from './dto/submit-report.dto';

const REQUIRED_VERIFICATIONS_BY_TYPE: Record<string, string[]> = {
  PERSONAL_LOAN: ['TVR', 'FI'],
  BUSINESS_LOAN: ['TVR', 'FI', 'PD'],
  VEHICLE_FINANCE: ['TVR', 'FI'],
  LAP: ['TVR', 'FI', 'TECHNICAL_VALUATION', 'LEGAL_VERIFICATION'],
  HOME_LOAN: ['TVR', 'FI', 'TECHNICAL_VALUATION', 'LEGAL_VERIFICATION'],
  GOLD_LOAN: ['TVR'],
  EDUCATION_LOAN: ['TVR', 'FI'],
  MSME_LOAN: ['TVR', 'FI', 'PD'],
  SUPPLY_CHAIN_FINANCE: ['TVR'],
  MICROFINANCE: ['TVR', 'FI'],
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // requestVerification
  // -------------------------------------------------------------------------

  async requestVerification(orgId: string, dto: RequestVerificationDto) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: dto.applicationId, organizationId: orgId },
      include: { product: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${dto.applicationId} not found`);
    }

    // Prevent duplicate pending requests for same type
    const existing = await this.prisma.verificationRequest.findFirst({
      where: {
        applicationId: dto.applicationId,
        organizationId: orgId,
        verificationType: dto.verificationType,
        status: { notIn: ['NEGATIVE', 'INCONCLUSIVE'] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A ${dto.verificationType} verification request already exists for this application`,
      );
    }

    const verification = await this.prisma.verificationRequest.create({
      data: {
        organizationId: orgId,
        applicationId: dto.applicationId,
        customerId: dto.customerId,
        verificationType: dto.verificationType,
        vendorName: dto.vendorName,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : undefined,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Verification ${dto.verificationType} requested for application ${dto.applicationId}`,
    );
    return verification;
  }

  // -------------------------------------------------------------------------
  // assignVerification
  // -------------------------------------------------------------------------

  async assignVerification(
    orgId: string,
    verificationId: string,
    dto: AssignVerificationDto,
  ) {
    const verification = await this.prisma.verificationRequest.findFirst({
      where: { id: verificationId, organizationId: orgId },
    });
    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    if (!['PENDING', 'ASSIGNED'].includes(verification.status)) {
      throw new BadRequestException(
        `Cannot assign verification in status ${verification.status}`,
      );
    }

    return this.prisma.verificationRequest.update({
      where: { id: verificationId },
      data: {
        assignedToId: dto.agentId,
        status: 'ASSIGNED',
      },
    });
  }

  // -------------------------------------------------------------------------
  // submitReport
  // -------------------------------------------------------------------------

  async submitReport(
    orgId: string,
    verificationId: string,
    dto: SubmitReportDto,
  ) {
    const verification = await this.prisma.verificationRequest.findFirst({
      where: { id: verificationId, organizationId: orgId },
    });
    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    if (['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'].includes(verification.status)) {
      throw new BadRequestException(
        `Verification ${verificationId} is already completed`,
      );
    }

    const outcome = dto.outcome ?? 'COMPLETED';
    const finalStatus = ['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'].includes(outcome)
      ? outcome
      : 'COMPLETED';

    return this.prisma.verificationRequest.update({
      where: { id: verificationId },
      data: {
        report: dto.report as Prisma.InputJsonValue,
        photos: (dto.photos ?? []) as unknown as Prisma.InputJsonValue,
        geoLocation: dto.geoLocation as Prisma.InputJsonValue | undefined,
        remarks: dto.remarks,
        status: finalStatus,
        completedAt: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // getVerifications
  // -------------------------------------------------------------------------

  async getVerifications(orgId: string, applicationId: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    return this.prisma.verificationRequest.findMany({
      where: { applicationId, organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // -------------------------------------------------------------------------
  // areAllVerificationsComplete
  // -------------------------------------------------------------------------

  async areAllVerificationsComplete(
    orgId: string,
    applicationId: string,
  ): Promise<{ complete: boolean; pending: string[]; negative: string[] }> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: { product: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const required =
      REQUIRED_VERIFICATIONS_BY_TYPE[application.product.productType] ?? ['TVR', 'FI'];

    const verifications = await this.prisma.verificationRequest.findMany({
      where: { applicationId, organizationId: orgId },
    });

    const positiveTypes = verifications
      .filter((v) => v.status === 'POSITIVE')
      .map((v) => v.verificationType);

    const negativeTypes = verifications
      .filter((v) => v.status === 'NEGATIVE')
      .map((v) => v.verificationType);

    const pending = required.filter((r) => !positiveTypes.includes(r));
    const complete = pending.length === 0;

    return { complete, pending, negative: negativeTypes };
  }
}
