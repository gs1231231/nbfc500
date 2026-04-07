import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class CreateComplaintDto {
  customerId!: string;
  loanId?: string;
  category!: string; // BILLING | SERVICE | HARASSMENT | DATA_PRIVACY | FRAUD | OTHER
  description!: string;
  priority?: string; // LOW | MEDIUM | HIGH | CRITICAL
}

export class ResolveComplaintDto {
  resolution!: string;
}

export class HandlePrivacyRequestDto {
  customerId!: string;
  requestType!: string; // ACCESS | CORRECTION | DELETION | PORTABILITY | CONSENT_WITHDRAWAL
  requestDetails?: Record<string, unknown>;
}

export class UpdatePrivacyRequestDto {
  status!: string;
  responseDetails?: Record<string, unknown>;
}

// ── SLA map (hours) ──────────────────────────────────────────────────────────

const PRIORITY_SLA_HOURS: Record<string, number> = {
  CRITICAL: 48,
  HIGH: 72,
  MEDIUM: 120,  // 5 business days
  LOW: 240,     // 10 business days
};

const PRIVACY_REQUEST_SLA_DAYS = 30; // DPDPA: 30 days to respond

// ── Complaint number generator ───────────────────────────────────────────────

async function generateComplaintNumber(
  prisma: PrismaService,
  orgId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await (prisma as any).complaint.count({
    where: { organizationId: orgId },
  });
  const seq = String(count + 1).padStart(6, '0');
  return `CMP/${year}/${seq}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerServiceService {
  private readonly logger = new Logger(CustomerServiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Complaints ──────────────────────────────────────────────────────────

  async createComplaint(orgId: string, dto: CreateComplaintDto): Promise<object> {
    this.logger.log(`Creating complaint for customer ${dto.customerId}`);

    const complaintNumber = await generateComplaintNumber(this.prisma, orgId);
    const priority = dto.priority ?? 'MEDIUM';
    const slaHours = PRIORITY_SLA_HOURS[priority] ?? 120;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const complaint = await (this.prisma as any).complaint.create({
      data: {
        organizationId: orgId,
        customerId: dto.customerId,
        loanId: dto.loanId ?? null,
        complaintNumber,
        category: dto.category,
        description: dto.description,
        priority,
        status: 'OPEN',
        slaDeadline,
        escalationLevel: 0,
      },
    });

    return {
      ...complaint,
      slaHours,
      message: `Complaint ${complaintNumber} registered. SLA: ${slaHours} hours.`,
    };
  }

  async listComplaints(
    orgId: string,
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<object> {
    const where: any = { organizationId: orgId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (this.prisma as any).complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).complaint.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getComplaint(orgId: string, complaintId: string): Promise<object> {
    const complaint = await (this.prisma as any).complaint.findFirst({
      where: { id: complaintId, organizationId: orgId },
    });
    if (!complaint) {
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    }
    return complaint;
  }

  async updateComplaint(
    orgId: string,
    complaintId: string,
    data: Partial<CreateComplaintDto>,
  ): Promise<object> {
    await this.getComplaint(orgId, complaintId);
    return (this.prisma as any).complaint.update({
      where: { id: complaintId },
      data,
    });
  }

  async escalateComplaint(orgId: string, complaintId: string): Promise<object> {
    const complaint = (await this.getComplaint(orgId, complaintId)) as any;

    if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
      throw new BadRequestException(
        `Cannot escalate a ${complaint.status} complaint`,
      );
    }

    const newLevel = (complaint.escalationLevel ?? 0) + 1;

    // Escalation tiers: 0=Agent, 1=Team Lead, 2=Manager, 3=C-Suite/Regulator
    const escalationMap: Record<number, string> = {
      1: 'TEAM_LEAD',
      2: 'BRANCH_MANAGER',
      3: 'NODAL_OFFICER',
    };

    const updated = await (this.prisma as any).complaint.update({
      where: { id: complaintId },
      data: {
        status: 'ESCALATED',
        escalationLevel: newLevel,
      },
    });

    return {
      ...updated,
      escalatedTo: escalationMap[newLevel] ?? 'SENIOR_MANAGEMENT',
      message: `Complaint escalated to Level ${newLevel} (${escalationMap[newLevel] ?? 'Senior Management'})`,
    };
  }

  async resolveComplaint(
    orgId: string,
    complaintId: string,
    dto: ResolveComplaintDto,
  ): Promise<object> {
    await this.getComplaint(orgId, complaintId);

    const updated = await (this.prisma as any).complaint.update({
      where: { id: complaintId },
      data: {
        status: 'RESOLVED',
        resolution: dto.resolution,
        resolvedAt: new Date(),
      },
    });

    return {
      ...updated,
      message: 'Complaint resolved successfully.',
    };
  }

  /**
   * Get all complaints past their SLA deadline (unresolved).
   * Per RBI Customer Service guidelines, these must be escalated immediately.
   */
  async getSLABreaches(orgId: string): Promise<object> {
    const now = new Date();

    const breaches = await (this.prisma as any).complaint.findMany({
      where: {
        organizationId: orgId,
        slaDeadline: { lt: now },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      orderBy: { slaDeadline: 'asc' },
    });

    return {
      organizationId: orgId,
      asOfDate: now.toISOString(),
      breachCount: breaches.length,
      breaches: breaches.map((b: any) => ({
        ...b,
        hoursOverdue: Math.round(
          (now.getTime() - new Date(b.slaDeadline).getTime()) / 3600000,
        ),
      })),
    };
  }

  // ── Privacy Requests (DPDPA) ────────────────────────────────────────────

  async handlePrivacyRequest(
    orgId: string,
    dto: HandlePrivacyRequestDto,
  ): Promise<object> {
    this.logger.log(
      `DPDPA request type=${dto.requestType} for customer ${dto.customerId}`,
    );

    const slaDeadline = new Date(
      Date.now() + PRIVACY_REQUEST_SLA_DAYS * 24 * 60 * 60 * 1000,
    );

    const request = await (this.prisma as any).dataPrivacyRequest.create({
      data: {
        organizationId: orgId,
        customerId: dto.customerId,
        requestType: dto.requestType,
        status: 'RECEIVED',
        requestDetails: dto.requestDetails ?? {},
        slaDeadline,
      },
    });

    // If DELETION requested, flag for data erasure workflow
    if (dto.requestType === 'DELETION') {
      this.logger.warn(
        `Data deletion requested for customer ${dto.customerId}. ` +
          `Review for regulatory retention requirements before erasure.`,
      );
    }

    return {
      ...request,
      slaDeadlineDays: PRIVACY_REQUEST_SLA_DAYS,
      message: `DPDPA ${dto.requestType} request received. SLA: ${PRIVACY_REQUEST_SLA_DAYS} days.`,
      regulatoryBasis: 'Digital Personal Data Protection Act, 2023',
    };
  }

  async listPrivacyRequests(orgId: string, page = 1, limit = 20): Promise<object> {
    const where = { organizationId: orgId };
    const [data, total] = await Promise.all([
      (this.prisma as any).dataPrivacyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).dataPrivacyRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getPrivacyRequest(orgId: string, requestId: string): Promise<object> {
    const req = await (this.prisma as any).dataPrivacyRequest.findFirst({
      where: { id: requestId, organizationId: orgId },
    });
    if (!req) throw new NotFoundException(`Privacy request ${requestId} not found`);
    return req;
  }

  async updatePrivacyRequest(
    orgId: string,
    requestId: string,
    dto: UpdatePrivacyRequestDto,
  ): Promise<object> {
    await this.getPrivacyRequest(orgId, requestId);

    const data: any = {
      status: dto.status,
      responseDetails: dto.responseDetails,
    };

    if (dto.status === 'COMPLETED') {
      data.completedAt = new Date();
    }

    return (this.prisma as any).dataPrivacyRequest.update({
      where: { id: requestId },
      data,
    });
  }
}
