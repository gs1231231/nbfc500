import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { ApplicationStatus, KycStatus, SourceType } from '@bankos/common';
import { WorkflowService } from '@bankos/workflow';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { FilterApplicationDto } from './dto/filter-application.dto';
import { TransitionApplicationDto } from './dto/transition-application.dto';

// ============================================================
// Valid status transitions map
// CANCELLED is allowed from any stage except DISBURSED.
// ============================================================
export const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.LEAD]: [
    ApplicationStatus.APPLICATION,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.APPLICATION]: [
    ApplicationStatus.DOCUMENT_COLLECTION,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.DOCUMENT_COLLECTION]: [
    ApplicationStatus.BUREAU_CHECK,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.BUREAU_CHECK]: [
    ApplicationStatus.UNDERWRITING,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.UNDERWRITING]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.APPROVED]: [
    ApplicationStatus.SANCTIONED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.SANCTIONED]: [
    ApplicationStatus.DISBURSEMENT_PENDING,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.DISBURSEMENT_PENDING]: [
    ApplicationStatus.DISBURSED,
    ApplicationStatus.CANCELLED,
  ],
  // Terminal states — no further transitions allowed
  [ApplicationStatus.DISBURSED]: [],
  [ApplicationStatus.REJECTED]: [ApplicationStatus.CANCELLED],
  [ApplicationStatus.CANCELLED]: [],
  [ApplicationStatus.EXPIRED]: [ApplicationStatus.CANCELLED],
};

// Stages in which an application's details may be edited
const EDITABLE_STAGES = new Set<ApplicationStatus>([
  ApplicationStatus.LEAD,
  ApplicationStatus.APPLICATION,
  ApplicationStatus.DOCUMENT_COLLECTION,
]);

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Generates a unique application number in the format ORG/PROD/YYYY/NNNNNN.
   * The sequential counter (NNNNNN) resets per organization per calendar year.
   *
   * Algorithm:
   * 1. Count existing applications for (orgId, year) to derive the next sequence.
   * 2. Fetch the organization code and product code for the prefix.
   * 3. Zero-pad the sequence to 6 digits.
   */
  private async generateApplicationNumber(
    orgId: string,
    productId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const [org, product, count] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      this.prisma.loanProduct.findUniqueOrThrow({ where: { id: productId } }),
      this.prisma.loanApplication.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: yearStart, lt: yearEnd },
        },
      }),
    ]);

    const sequence = String(count + 1).padStart(6, '0');
    return `${org.code}/${product.code}/${year}/${sequence}`;
  }

  /**
   * Converts paisa amounts to rupees with 2 decimal places for API responses.
   * @param paisa - integer amount in paisa
   * @returns number with 2 decimal places (rupees)
   */
  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  /**
   * Serialises a LoanApplication record for API responses.
   * Converts all paisa fields to rupees and includes relations.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(application: any): any {
    return {
      ...application,
      requestedAmount: this.paisaToRupees(application.requestedAmountPaisa),
      sanctionedAmount:
        application.sanctionedAmountPaisa != null
          ? this.paisaToRupees(application.sanctionedAmountPaisa)
          : null,
      // Keep raw paisa fields as well for internal consumers
    };
  }

  // ============================================================
  // CRUD operations
  // ============================================================

  /**
   * Creates a new loan application.
   *
   * Validations:
   * 1. requestedAmountPaisa must be within the product's [minAmountPaisa, maxAmountPaisa].
   * 2. requestedTenureMonths must be within the product's [minTenureMonths, maxTenureMonths].
   * 3. Customer kycStatus must be VERIFIED.
   * 4. No active application exists for the same customer + product within the last 30 days.
   */
  async create(orgId: string, dto: CreateApplicationDto) {
    // 1. Fetch product and validate it belongs to the org
    const product = await this.prisma.loanProduct.findFirst({
      where: {
        id: dto.productId,
        organizationId: orgId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Loan product ${dto.productId} not found or not active`,
      );
    }

    // 2. Validate requested amount within product limits
    if (
      dto.requestedAmountPaisa < product.minAmountPaisa ||
      dto.requestedAmountPaisa > product.maxAmountPaisa
    ) {
      throw new BadRequestException(
        `Requested amount ${this.paisaToRupees(dto.requestedAmountPaisa)} INR is outside product limits ` +
          `[${this.paisaToRupees(product.minAmountPaisa)} - ${this.paisaToRupees(product.maxAmountPaisa)} INR]`,
      );
    }

    // 3. Validate tenure within product limits
    if (
      dto.requestedTenureMonths < product.minTenureMonths ||
      dto.requestedTenureMonths > product.maxTenureMonths
    ) {
      throw new BadRequestException(
        `Requested tenure ${dto.requestedTenureMonths} months is outside product limits ` +
          `[${product.minTenureMonths} - ${product.maxTenureMonths} months]`,
      );
    }

    // 4. Validate customer belongs to org and KYC is VERIFIED
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer ${dto.customerId} not found`,
      );
    }

    if (customer.kycStatus !== KycStatus.VERIFIED) {
      throw new UnprocessableEntityException(
        `Customer KYC status is ${customer.kycStatus}. Only VERIFIED customers can apply for loans.`,
      );
    }

    // 5. Duplicate check: same customer + product within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const duplicateApplication = await this.prisma.loanApplication.findFirst({
      where: {
        organizationId: orgId,
        customerId: dto.customerId,
        productId: dto.productId,
        deletedAt: null,
        status: {
          notIn: [ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED, ApplicationStatus.EXPIRED],
        },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (duplicateApplication) {
      throw new ConflictException(
        `An active application (${duplicateApplication.applicationNumber}) already exists for this customer and product within the last 30 days`,
      );
    }

    // 6. Generate application number
    const applicationNumber = await this.generateApplicationNumber(
      orgId,
      dto.productId,
    );

    // 7. Create the application
    const application = await this.prisma.loanApplication.create({
      data: {
        organizationId: orgId,
        branchId: dto.branchId,
        applicationNumber,
        customerId: dto.customerId,
        productId: dto.productId,
        requestedAmountPaisa: dto.requestedAmountPaisa,
        requestedTenureMonths: dto.requestedTenureMonths,
        status: ApplicationStatus.LEAD,
        sourceType: dto.sourceType ?? SourceType.BRANCH,
        dsaId: dto.dsaId ?? null,
        assignedToId: dto.assignedToId ?? null,
      },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true, panNumber: true },
        },
        product: {
          select: { id: true, name: true, code: true, productType: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(
      `Created loan application ${applicationNumber} for customer ${dto.customerId}`,
    );

    return this.serialize(application);
  }

  /**
   * Lists loan applications for an organization with cursor-based pagination.
   * Supports filters: status, productId, branchId, dsaId, assignedToId,
   * createdAt range, and amount range.
   * Includes customer name and product name.
   */
  async findAll(orgId: string, filters: FilterApplicationDto) {
    const limit = filters.limit ?? 20;

    // Build where clause incrementally to satisfy strict Prisma types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.dsaId) where.dsaId = filters.dsaId;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;

    if (filters.createdAtFrom || filters.createdAtTo) {
      where.createdAt = {};
      if (filters.createdAtFrom) where.createdAt.gte = new Date(filters.createdAtFrom);
      if (filters.createdAtTo) where.createdAt.lte = new Date(filters.createdAtTo);
    }

    if (filters.minAmountPaisa || filters.maxAmountPaisa) {
      where.requestedAmountPaisa = {};
      if (filters.minAmountPaisa) where.requestedAmountPaisa.gte = filters.minAmountPaisa;
      if (filters.maxAmountPaisa) where.requestedAmountPaisa.lte = filters.maxAmountPaisa;
    }

    const applications = await this.prisma.loanApplication.findMany({
      where,
      take: limit + 1,
      ...(filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
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
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const hasMore = applications.length > limit;
    const items = hasMore ? applications.slice(0, limit) : applications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      data: items.map((a) => this.serialize(a)),
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Returns the full detail of a single loan application with all relations.
   */
  async findOne(orgId: string, id: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        customer: true,
        product: true,
        branch: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
          },
        },
        dsa: {
          select: {
            id: true,
            name: true,
            dsaCode: true,
            dsaType: true,
          },
        },
        breDecision: true,
        documents: {
          where: { deletedAt: null },
        },
        bureauRequests: true,
        loans: {
          where: {},
          select: {
            id: true,
            loanNumber: true,
            loanStatus: true,
            disbursedAmountPaisa: true,
            disbursementDate: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} not found`);
    }

    return this.serialize(application);
  }

  /**
   * Updates editable fields of an application.
   * Only allowed when the application is in an editable stage:
   * LEAD, APPLICATION, or DOCUMENT_COLLECTION.
   */
  async update(orgId: string, id: string, dto: UpdateApplicationDto) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: { product: true },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} not found`);
    }

    if (!EDITABLE_STAGES.has(application.status as ApplicationStatus)) {
      throw new UnprocessableEntityException(
        `Application in status ${application.status} cannot be edited. ` +
          `Editable stages: ${[...EDITABLE_STAGES].join(', ')}`,
      );
    }

    // Validate updated amount against product limits if provided
    if (dto.requestedAmountPaisa !== undefined) {
      const product = application.product;
      if (
        dto.requestedAmountPaisa < product.minAmountPaisa ||
        dto.requestedAmountPaisa > product.maxAmountPaisa
      ) {
        throw new BadRequestException(
          `Requested amount ${this.paisaToRupees(dto.requestedAmountPaisa)} INR is outside product limits ` +
            `[${this.paisaToRupees(product.minAmountPaisa)} - ${this.paisaToRupees(product.maxAmountPaisa)} INR]`,
        );
      }
    }

    // Validate updated tenure against product limits if provided
    if (dto.requestedTenureMonths !== undefined) {
      const product = application.product;
      if (
        dto.requestedTenureMonths < product.minTenureMonths ||
        dto.requestedTenureMonths > product.maxTenureMonths
      ) {
        throw new BadRequestException(
          `Requested tenure ${dto.requestedTenureMonths} months is outside product limits ` +
            `[${product.minTenureMonths} - ${product.maxTenureMonths} months]`,
        );
      }
    }

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        ...(dto.requestedAmountPaisa !== undefined && {
          requestedAmountPaisa: dto.requestedAmountPaisa,
        }),
        ...(dto.requestedTenureMonths !== undefined && {
          requestedTenureMonths: dto.requestedTenureMonths,
        }),
        ...(dto.assignedToId !== undefined && {
          assignedToId: dto.assignedToId,
        }),
        ...(dto.dsaId !== undefined && { dsaId: dto.dsaId }),
        ...(dto.sanctionedAmountPaisa !== undefined && {
          sanctionedAmountPaisa: dto.sanctionedAmountPaisa,
        }),
        ...(dto.sanctionedTenureMonths !== undefined && {
          sanctionedTenureMonths: dto.sanctionedTenureMonths,
        }),
        ...(dto.sanctionedInterestRateBps !== undefined && {
          sanctionedInterestRateBps: dto.sanctionedInterestRateBps,
        }),
        ...(dto.rejectionReason !== undefined && {
          rejectionReason: dto.rejectionReason,
        }),
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
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return this.serialize(updated);
  }

  /**
   * Soft-deletes a loan application by setting deletedAt.
   * Only allowed when the application is in an editable stage.
   */
  async remove(orgId: string, id: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} not found`);
    }

    if (!EDITABLE_STAGES.has(application.status as ApplicationStatus)) {
      throw new UnprocessableEntityException(
        `Application in status ${application.status} cannot be deleted. ` +
          `Deletable stages: ${[...EDITABLE_STAGES].join(', ')}`,
      );
    }

    await this.prisma.loanApplication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted loan application ${id}`);

    return { message: `Application ${application.applicationNumber} deleted successfully` };
  }

  /**
   * Transitions an application to a new status.
   *
   * When a workflow template exists for the org/product, the workflow engine
   * validates the transition (role, conditions, amount limits) and records history.
   * Falls back to the hardcoded STATUS_TRANSITIONS map when no workflow template
   * is configured for the org/product.
   *
   * Allowed paths (fallback):
   * LEAD -> APPLICATION -> DOCUMENT_COLLECTION -> BUREAU_CHECK ->
   * UNDERWRITING -> APPROVED/REJECTED -> SANCTIONED ->
   * DISBURSEMENT_PENDING -> DISBURSED
   * CANCELLED is allowed from any stage except DISBURSED.
   */
  async transition(
    orgId: string,
    id: string,
    dto: TransitionApplicationDto,
    userId?: string,
  ) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${id} not found`);
    }

    // Attempt to resolve a workflow template for this org/product.
    const workflow = await this.workflowService.getWorkflow(orgId, application.productId);

    if (workflow) {
      // Workflow engine path: validate then execute (records history internally).
      const currentStage = application.currentWorkflowStage ?? application.status;

      const validation = await this.workflowService.validateTransition(
        orgId,
        id,
        currentStage,
        dto.toStatus,
        userId ?? 'system',
      );

      if (!validation.allowed) {
        throw new UnprocessableEntityException(
          validation.reason ??
            `Invalid status transition from ${currentStage} to ${dto.toStatus}`,
        );
      }

      await this.workflowService.executeTransition(
        orgId,
        id,
        dto.toStatus,
        userId ?? 'system',
        dto.remarks,
      );
    } else {
      // Fallback: hardcoded STATUS_TRANSITIONS map.
      const currentStatus = application.status as ApplicationStatus;
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus] ?? [];

      if (!allowedTransitions.includes(dto.toStatus)) {
        throw new UnprocessableEntityException(
          `Invalid status transition from ${currentStatus} to ${dto.toStatus}. ` +
            `Allowed transitions: [${allowedTransitions.join(', ')}]`,
        );
      }

      await this.prisma.loanApplication.update({
        where: { id },
        data: {
          status: dto.toStatus,
          ...(dto.toStatus === ApplicationStatus.REJECTED &&
            dto.remarks && { rejectionReason: dto.remarks }),
        },
      });

      await this.prisma.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: currentStatus,
          toStatus: dto.toStatus,
          changedBy: userId ?? 'system',
          remarks: dto.remarks,
        },
      });
    }

    this.logger.log(
      `Application ${application.applicationNumber} transitioned to ${dto.toStatus}` +
        (dto.remarks ? ` — Remarks: ${dto.remarks}` : ''),
    );

    // Return the fresh, fully-serialized record.
    return this.findOne(orgId, id);
  }

  /**
   * Returns the list of workflow stages the given user can immediately
   * transition to from the application's current stage.
   * Falls back to the hardcoded STATUS_TRANSITIONS map when no workflow
   * template exists for the org/product.
   */
  async getAvailableTransitions(
    orgId: string,
    applicationId: string,
    userId: string,
  ) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }

    const workflow = await this.workflowService.getWorkflow(orgId, application.productId);

    if (workflow) {
      return this.workflowService.getAvailableTransitions(orgId, applicationId, userId);
    }

    // Fallback: derive from static STATUS_TRANSITIONS map.
    const currentStatus = application.status as ApplicationStatus;
    const allowedStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
    return allowedStatuses.map((toStatus) => ({
      toStage: toStatus,
      toStageName: toStatus,
      requiresRemarks: toStatus === ApplicationStatus.REJECTED,
    }));
  }
}
