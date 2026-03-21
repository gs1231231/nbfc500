import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { ApplicationStatus } from '@bankos/common';
import { BreFinalDecision } from '@prisma/client';
import { SanctionApplicationDto } from './dto/sanction-application.dto';

@Injectable()
export class SanctionService {
  private readonly logger = new Logger(SanctionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Converts paisa amounts to rupees with 2 decimal places for API responses.
   */
  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  // ============================================================
  // Service methods
  // ============================================================

  /**
   * Sanctions a loan application.
   *
   * Workflow:
   * 1. Validate application exists and belongs to org.
   * 2. Validate application status allows sanctioning:
   *    - Must be APPROVED (BRE decision = APPROVED), or
   *    - Must be UNDERWRITING/APPROVED with a REFERRED BRE decision that was
   *      manually overridden (overriddenBy is set).
   * 3. Validate a BRE decision exists and is APPROVED or overridden REFERRED.
   * 4. Update application with sanction details and transition to SANCTIONED.
   *
   * Sanction conditions are stored in application settings via a JSON field update.
   */
  async sanctionApplication(
    orgId: string,
    applicationId: string,
    dto: SanctionApplicationDto,
  ) {
    // 1. Fetch application with BRE decision
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        breDecision: true,
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        product: {
          select: { id: true, name: true, code: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found`,
      );
    }

    // 2. Validate application status — must be APPROVED to proceed to sanction
    const validStatuses: ApplicationStatus[] = [ApplicationStatus.APPROVED];
    if (!validStatuses.includes(application.status as ApplicationStatus)) {
      throw new UnprocessableEntityException(
        `Application status is ${application.status}. Sanction is only allowed for applications in status: ` +
          `[${validStatuses.join(', ')}]`,
      );
    }

    // 3. Validate BRE decision exists
    if (!application.breDecision) {
      throw new UnprocessableEntityException(
        `No BRE decision found for application ${applicationId}. ` +
          `Run BRE evaluation before sanctioning.`,
      );
    }

    const breDecision = application.breDecision;

    // 4. Validate BRE final decision: must be APPROVED, or REFERRED with an override
    const isApproved =
      breDecision.finalDecision === BreFinalDecision.APPROVED;
    const isOverriddenReferred =
      breDecision.finalDecision === BreFinalDecision.REFERRED &&
      breDecision.overriddenBy != null;

    if (!isApproved && !isOverriddenReferred) {
      throw new UnprocessableEntityException(
        `BRE decision is ${breDecision.finalDecision}` +
          (breDecision.finalDecision === BreFinalDecision.REFERRED
            ? ' and has not been overridden by a credit officer'
            : '') +
          `. Sanction requires BRE decision to be APPROVED or an overridden REFERRED.`,
      );
    }

    // 5. Update application with sanction details and transition to SANCTIONED
    const updated = await this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SANCTIONED,
        sanctionedAmountPaisa: dto.sanctionedAmountPaisa,
        sanctionedTenureMonths: dto.sanctionedTenureMonths,
        sanctionedInterestRateBps: dto.sanctionedInterestRateBps,
      },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        product: {
          select: { id: true, name: true, code: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        breDecision: true,
      },
    });

    this.logger.log(
      `Application ${application.applicationNumber} sanctioned. ` +
        `Amount: ${this.paisaToRupees(dto.sanctionedAmountPaisa)} INR, ` +
        `Tenure: ${dto.sanctionedTenureMonths} months, ` +
        `Rate: ${dto.sanctionedInterestRateBps} bps`,
    );

    return {
      ...updated,
      sanctionedAmount: this.paisaToRupees(updated.sanctionedAmountPaisa!),
      requestedAmount: this.paisaToRupees(updated.requestedAmountPaisa),
      conditions: dto.conditions ?? [],
    };
  }
}
