import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { Prisma } from '@prisma/client';
import { UpdateCamDto } from './dto/update-cam.dto';

@Injectable()
export class CamService {
  private readonly logger = new Logger(CamService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // generateCam
  // -------------------------------------------------------------------------

  async generateCam(orgId: string, applicationId: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId },
      include: {
        customer: {
          include: {
            employments: { where: { isCurrent: true } },
            bankAccounts: true,
          },
        },
        product: true,
        bureauRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { bureauResponse: true },
        },
      },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    // Ensure no existing CAM
    const existingCam = await this.prisma.creditAppraisalMemo.findUnique({
      where: { applicationId },
    });
    if (existingCam) {
      throw new BadRequestException(
        `CAM already exists for application ${applicationId}. Use update instead.`,
      );
    }

    const camNumber = await this.generateCamNumber(orgId);

    // ---- Customer Profile ----
    const customer = application.customer;
    const customerProfile = {
      customerId: customer.id,
      name: customer.fullName,
      dateOfBirth: customer.dateOfBirth,
      pan: customer.panNumber,
      phone: customer.phone,
      email: customer.email,
      employmentType: customer.employmentType,
      kycStatus: customer.kycStatus,
    };

    // ---- Income Assessment ----
    const currentEmployment = customer.employments[0];
    let incomeAssessment: Record<string, unknown> = {};
    if (currentEmployment) {
      const empType = customer.employmentType;
      if (empType === 'SALARIED') {
        incomeAssessment = {
          type: 'SALARIED',
          companyName: currentEmployment.companyName,
          designation: currentEmployment.designation,
          grossMonthlyIncomePaisa: currentEmployment.grossIncomePaisa,
          netMonthlyIncomePaisa: currentEmployment.netIncomePaisa,
          annualIncomePaisa: currentEmployment.annualIncomePaisa,
          incomeProofType: currentEmployment.incomeProofType,
          joiningDate: currentEmployment.joiningDate,
        };
      } else if (
        empType === 'SELF_EMPLOYED_PROFESSIONAL' ||
        empType === 'SELF_EMPLOYED_BUSINESS'
      ) {
        incomeAssessment = {
          type: 'SELF_EMPLOYED',
          businessName: currentEmployment.companyName,
          industry: currentEmployment.industry,
          annualIncomePaisa: currentEmployment.annualIncomePaisa,
          incomeProofType: currentEmployment.incomeProofType,
        };
      }
    }

    // ---- Banking Analysis ----
    const bankingAnalysis: Record<string, unknown> = {
      bankAccountsCount: customer.bankAccounts.length,
      primaryBank:
        customer.bankAccounts.find((b) => b.isPrimary)?.bankName ?? null,
      // Account Aggregator data if available would be merged here
      aaDataAvailable: false,
    };

    // ---- Bureau Analysis ----
    let bureauAnalysis: Record<string, unknown> = {};
    const latestBureauReq = application.bureauRequests[0];
    if (latestBureauReq?.bureauResponse) {
      const br = latestBureauReq.bureauResponse;
      bureauAnalysis = {
        bureauType: latestBureauReq.bureauType,
        score: br.score,
        totalActiveLoans: br.totalActiveLoans,
        totalEmiObligationPaisa: br.totalEmiObligationPaisa,
        maxDpdLast12Months: br.maxDpdLast12Months,
        maxDpdLast24Months: br.maxDpdLast24Months,
        enquiriesLast3Months: br.enquiriesLast3Months,
        enquiriesLast6Months: br.enquiriesLast6Months,
        hasWriteOff: br.hasWriteOff,
        hasSettlement: br.hasSettlement,
        oldestLoanAgeMonths: br.oldestLoanAgeMonths,
        validUntil: br.validUntil,
      };
    }

    // ---- Obligation Mapping ----
    const existingEmiPaisa =
      (latestBureauReq?.bureauResponse?.totalEmiObligationPaisa as number) ?? 0;
    const netMonthlyIncomePaisa =
      (currentEmployment?.netIncomePaisa ?? customer.monthlyIncomePaisa) ?? 0;
    const proposedEmiPaisa =
      application.sanctionedAmountPaisa && application.sanctionedTenureMonths
        ? Math.round(
            (application.sanctionedAmountPaisa / application.sanctionedTenureMonths) * 1.1,
          )
        : 0;
    const foirPercent =
      netMonthlyIncomePaisa > 0
        ? Math.round(
            ((existingEmiPaisa + proposedEmiPaisa) / netMonthlyIncomePaisa) * 100 * 100,
          ) / 100
        : null;

    const obligationMapping = {
      existingEmiObligationPaisa: existingEmiPaisa,
      proposedEmiPaisa,
      totalObligationPaisa: existingEmiPaisa + proposedEmiPaisa,
      netMonthlyIncomePaisa,
      foirPercent,
      foirStatus: foirPercent !== null ? (foirPercent <= 50 ? 'ACCEPTABLE' : 'HIGH') : 'UNKNOWN',
    };

    // ---- Risk Assessment ----
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    const bureauScore = latestBureauReq?.bureauResponse?.score;
    if (bureauScore !== null && bureauScore !== undefined) {
      if (bureauScore >= 750) positiveFactors.push('Excellent bureau score ≥ 750');
      else if (bureauScore >= 650) positiveFactors.push('Acceptable bureau score 650-749');
      else negativeFactors.push(`Low bureau score: ${bureauScore}`);
    }
    if (latestBureauReq?.bureauResponse?.hasWriteOff)
      negativeFactors.push('Write-off history present');
    if (latestBureauReq?.bureauResponse?.hasSettlement)
      negativeFactors.push('Loan settlement history present');
    if (foirPercent !== null && foirPercent <= 40)
      positiveFactors.push(`Low FOIR: ${foirPercent}%`);
    if (foirPercent !== null && foirPercent > 55)
      negativeFactors.push(`High FOIR: ${foirPercent}%`);

    const riskAssessment = {
      positiveFactors,
      negativeFactors,
      overallRisk:
        negativeFactors.length === 0
          ? 'LOW'
          : negativeFactors.length <= 2
          ? 'MEDIUM'
          : 'HIGH',
      recommendation:
        negativeFactors.length > 2
          ? 'REFER_TO_CREDIT_COMMITTEE'
          : negativeFactors.length > 0
          ? 'APPROVE_WITH_CONDITIONS'
          : 'APPROVE',
    };

    const cam = await this.prisma.creditAppraisalMemo.create({
      data: {
        organizationId: orgId,
        applicationId,
        camNumber,
        customerProfile: customerProfile as Prisma.InputJsonValue,
        incomeAssessment: incomeAssessment as Prisma.InputJsonValue,
        bankingAnalysis: bankingAnalysis as Prisma.InputJsonValue,
        bureauAnalysis: bureauAnalysis as Prisma.InputJsonValue,
        obligationMapping: obligationMapping as Prisma.InputJsonValue,
        collateralAssessment: {} as Prisma.InputJsonValue,
        riskAssessment: riskAssessment as Prisma.InputJsonValue,
        deviations: [] as unknown as Prisma.InputJsonValue,
        camStatus: 'DRAFT',
      },
    });

    this.logger.log(`CAM ${camNumber} generated for application ${applicationId}`);
    return cam;
  }

  // -------------------------------------------------------------------------
  // updateCam
  // -------------------------------------------------------------------------

  async updateCam(orgId: string, camId: string, dto: UpdateCamDto) {
    const cam = await this.prisma.creditAppraisalMemo.findFirst({
      where: { id: camId, organizationId: orgId },
    });
    if (!cam) {
      throw new NotFoundException(`CAM ${camId} not found`);
    }
    if (cam.camStatus !== 'DRAFT') {
      throw new BadRequestException(
        `CAM ${camId} is in status ${cam.camStatus} and cannot be edited`,
      );
    }

    return this.prisma.creditAppraisalMemo.update({
      where: { id: camId },
      data: {
        ...(dto.customerProfile !== undefined && {
          customerProfile: dto.customerProfile as Prisma.InputJsonValue,
        }),
        ...(dto.incomeAssessment !== undefined && {
          incomeAssessment: dto.incomeAssessment as Prisma.InputJsonValue,
        }),
        ...(dto.bankingAnalysis !== undefined && {
          bankingAnalysis: dto.bankingAnalysis as Prisma.InputJsonValue,
        }),
        ...(dto.bureauAnalysis !== undefined && {
          bureauAnalysis: dto.bureauAnalysis as Prisma.InputJsonValue,
        }),
        ...(dto.obligationMapping !== undefined && {
          obligationMapping: dto.obligationMapping as Prisma.InputJsonValue,
        }),
        ...(dto.collateralAssessment !== undefined && {
          collateralAssessment: dto.collateralAssessment as Prisma.InputJsonValue,
        }),
        ...(dto.riskAssessment !== undefined && {
          riskAssessment: dto.riskAssessment as Prisma.InputJsonValue,
        }),
        ...(dto.deviations !== undefined && {
          deviations: dto.deviations as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  // -------------------------------------------------------------------------
  // approveCam
  // -------------------------------------------------------------------------

  async approveCam(orgId: string, camId: string, userId: string) {
    const cam = await this.prisma.creditAppraisalMemo.findFirst({
      where: { id: camId, organizationId: orgId },
    });
    if (!cam) {
      throw new NotFoundException(`CAM ${camId} not found`);
    }
    if (cam.camStatus !== 'DRAFT' && cam.camStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        `CAM cannot be approved in status ${cam.camStatus}`,
      );
    }

    return this.prisma.creditAppraisalMemo.update({
      where: { id: camId },
      data: {
        camStatus: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // getCam
  // -------------------------------------------------------------------------

  async getCam(orgId: string, applicationId: string) {
    const cam = await this.prisma.creditAppraisalMemo.findFirst({
      where: { applicationId, organizationId: orgId },
    });
    if (!cam) {
      throw new NotFoundException(`No CAM found for application ${applicationId}`);
    }
    return cam;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async generateCamNumber(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const year = new Date().getFullYear();
    const count = await this.prisma.creditAppraisalMemo.count({
      where: { organizationId: orgId },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `CAM/${org?.code ?? orgId.substring(0, 6).toUpperCase()}/${year}/${seq}`;
  }
}
