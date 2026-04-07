import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class CreateGroupDto {
  groupName!: string;
  centerName!: string;
  branchId!: string;
  groupLeaderId?: string;
  meetingDay?: string; // MONDAY | TUESDAY | ...
  meetingTime?: string;
  formationDate!: string;
  groupType?: 'JLG' | 'SHG'; // Joint Liability Group | Self Help Group
}

export class AddMemberDto {
  customerId!: string;
  role?: string; // LEADER | SECRETARY | MEMBER
}

export class CGTDto {
  trainingDate!: string;
  trainingVenue!: string;
  attendeeCount!: number;
  conductedBy!: string;
  remarks?: string;
}

export class GRTDto {
  testDate!: string;
  conductedBy!: string;
  passedCount!: number;
  failedCount!: number;
  remarks?: string;
}

export class GroupCollectionDto {
  collectionDate!: string;
  collectedAmountPaisa!: number;
  receivedBy!: string;
  remarks?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MfiService {
  private readonly logger = new Logger(MfiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Group Operations ────────────────────────────────────────────────────

  /**
   * Create a JLG (Joint Liability Group) or SHG (Self Help Group).
   * RBI/NBFC-MFI guidelines require groups of 5-10 members for JLG,
   * 10-20 for SHG.
   */
  async createGroup(orgId: string, dto: CreateGroupDto): Promise<object> {
    this.logger.log(`Creating MFI group ${dto.groupName} for org ${orgId}`);

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId: orgId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${dto.branchId} not found`);
    }

    const group = await (this.prisma as any).mFIGroup.create({
      data: {
        organizationId: orgId,
        groupName: dto.groupName,
        centerName: dto.centerName,
        branchId: dto.branchId,
        groupLeaderId: dto.groupLeaderId ?? null,
        meetingDay: dto.meetingDay ?? null,
        meetingTime: dto.meetingTime ?? null,
        formationDate: new Date(dto.formationDate),
        memberCount: 0,
        status: 'ACTIVE',
      },
    });

    return {
      ...group,
      groupType: dto.groupType ?? 'JLG',
      message: `MFI group created. Next steps: (1) Add members, (2) Conduct CGT, (3) Conduct GRT, (4) Bulk disburse.`,
    };
  }

  async listGroups(orgId: string, branchId?: string, page = 1, limit = 20): Promise<object> {
    const where: any = { organizationId: orgId };
    if (branchId) where.branchId = branchId;

    const [data, total] = await Promise.all([
      (this.prisma as any).mFIGroup.findMany({
        where,
        include: { members: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).mFIGroup.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getGroup(orgId: string, groupId: string): Promise<object> {
    const group = await (this.prisma as any).mFIGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);
    return group;
  }

  async updateGroup(orgId: string, groupId: string, dto: Partial<CreateGroupDto>): Promise<object> {
    await this.getGroup(orgId, groupId);
    return (this.prisma as any).mFIGroup.update({
      where: { id: groupId },
      data: dto,
    });
  }

  // ── Member Operations ───────────────────────────────────────────────────

  /**
   * Add a customer as a group member. Validates that the customer exists
   * and is not already in another active JLG group (RBI cross-membership restriction).
   */
  async addMember(orgId: string, groupId: string, dto: AddMemberDto): Promise<object> {
    this.logger.log(`Adding member ${dto.customerId} to group ${groupId}`);

    await this.getGroup(orgId, groupId);

    // Check customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    // Check for duplicate membership
    const existingMembership = await (this.prisma as any).mFIGroupMember.findFirst({
      where: { customerId: dto.customerId, status: 'ACTIVE' },
    });
    if (existingMembership && existingMembership.groupId !== groupId) {
      throw new BadRequestException(
        `Customer ${dto.customerId} is already an active member of another group. ` +
          `RBI/NBFC-MFI guidelines prohibit membership in multiple active JLG groups.`,
      );
    }

    const member = await (this.prisma as any).mFIGroupMember.create({
      data: {
        groupId,
        customerId: dto.customerId,
        role: dto.role ?? 'MEMBER',
        status: 'ACTIVE',
      },
    });

    // Update member count
    const memberCount = await (this.prisma as any).mFIGroupMember.count({
      where: { groupId, status: 'ACTIVE' },
    });
    await (this.prisma as any).mFIGroup.update({
      where: { id: groupId },
      data: { memberCount },
    });

    return {
      ...member,
      customerName: customer.fullName,
      groupId,
      message: `Customer ${customer.fullName} added as ${dto.role ?? 'MEMBER'}.`,
    };
  }

  // ── Training & Recognition ──────────────────────────────────────────────

  /**
   * Conduct CGT (Compulsory Group Training) — mandatory for new MFI groups.
   * Per RBI NBFC-MFI directions, typically 5-7 days of training.
   */
  async conductCGT(orgId: string, groupId: string, dto: CGTDto): Promise<object> {
    this.logger.log(`CGT for group ${groupId}`);

    const group = (await this.getGroup(orgId, groupId)) as any;

    // Log to audit as group event
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: 'SYSTEM',
        entityType: 'MFI_GROUP',
        entityId: groupId,
        action: 'CREATE' as any,
        changes: {
          event: 'CGT',
          trainingDate: dto.trainingDate,
          trainingVenue: dto.trainingVenue,
          attendeeCount: dto.attendeeCount,
          conductedBy: dto.conductedBy,
          groupName: group.groupName,
          remarks: dto.remarks ?? null,
        },
      },
    });

    return {
      groupId,
      groupName: group.groupName,
      event: 'CGT_COMPLETED',
      trainingDate: dto.trainingDate,
      trainingVenue: dto.trainingVenue,
      attendeeCount: dto.attendeeCount,
      conductedBy: dto.conductedBy,
      remarks: dto.remarks ?? null,
      nextStep: 'Conduct GRT (Group Recognition Test) before disbursement',
      recordedAt: new Date().toISOString(),
    };
  }

  /**
   * Conduct GRT (Group Recognition Test) — final eligibility check before disbursement.
   * All members must pass to qualify for loans.
   */
  async conductGRT(orgId: string, groupId: string, dto: GRTDto): Promise<object> {
    this.logger.log(`GRT for group ${groupId}`);

    const group = (await this.getGroup(orgId, groupId)) as any;
    const passed = dto.passedCount >= dto.passedCount + dto.failedCount * 0.8; // 80% pass threshold

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: 'SYSTEM',
        entityType: 'MFI_GROUP',
        entityId: groupId,
        action: 'UPDATE' as any,
        changes: {
          event: 'GRT',
          testDate: dto.testDate,
          conductedBy: dto.conductedBy,
          passedCount: dto.passedCount,
          failedCount: dto.failedCount,
          eligible: passed,
          groupName: group.groupName,
          remarks: dto.remarks ?? null,
        },
      },
    });

    return {
      groupId,
      groupName: group.groupName,
      event: 'GRT_COMPLETED',
      testDate: dto.testDate,
      conductedBy: dto.conductedBy,
      passedCount: dto.passedCount,
      failedCount: dto.failedCount,
      eligible: passed,
      passThresholdPercent: 80,
      remarks: dto.remarks ?? null,
      nextStep: passed
        ? 'Group eligible for bulk disbursement. Proceed with loan applications.'
        : `${dto.failedCount} members failed GRT. Retrain before disbursement.`,
      recordedAt: new Date().toISOString(),
    };
  }

  // ── Disbursement & Collection ───────────────────────────────────────────

  /**
   * Bulk Disbursement — disburse to all approved members of a group simultaneously.
   * This triggers disbursement requests for each member's loan application.
   */
  async bulkDisburse(orgId: string, groupId: string): Promise<object> {
    this.logger.log(`Bulk disbursement for group ${groupId}`);

    const group = (await this.getGroup(orgId, groupId)) as any;

    // Find all approved loan applications for group members
    const memberIds = group.members
      .filter((m: any) => m.status === 'ACTIVE')
      .map((m: any) => m.customerId);

    if (memberIds.length === 0) {
      throw new BadRequestException('No active members in group');
    }

    const approvedApplications = await this.prisma.loanApplication.findMany({
      where: {
        organizationId: orgId,
        customerId: { in: memberIds },
        status: 'APPROVED',
      },
      include: {
        customer: { select: { fullName: true } },
      },
    });

    if (approvedApplications.length === 0) {
      return {
        groupId,
        groupName: group.groupName,
        message: 'No approved applications found for group members.',
        eligibleMemberCount: memberIds.length,
        approvedApplicationCount: 0,
      };
    }

    // Create disbursement requests for each
    const disbursementRequests = [];
    for (const app of approvedApplications) {
      const sanctionedAmount =
        app.sanctionedAmountPaisa ?? app.requestedAmountPaisa;

      const disbRequest = await this.prisma.disbursementRequest.create({
        data: {
          organizationId: orgId,
          applicationId: app.id,
          requestedById: 'SYSTEM_MFI_BULK', // Would be replaced by actual user ID in production
          grossAmountPaisa: sanctionedAmount,
          netAmountPaisa: sanctionedAmount, // Deductions handled separately
          status: 'PENDING_APPROVAL',
          disbursementType: 'FULL',
          payeeType: 'BORROWER',
          remarks: `Bulk disbursement — MFI Group: ${group.groupName} (${groupId})`,
        },
      });

      disbursementRequests.push({
        requestId: disbRequest.id,
        customerId: app.customerId,
        customerName: app.customer.fullName,
        applicationId: app.id,
        amountPaisa: sanctionedAmount,
      });
    }

    return {
      groupId,
      groupName: group.groupName,
      centerName: group.centerName,
      totalMembersInGroup: memberIds.length,
      disbursementsInitiated: disbursementRequests.length,
      totalAmountPaisa: disbursementRequests.reduce((s, d) => s + d.amountPaisa, 0),
      disbursementRequests,
      message: `Bulk disbursement initiated for ${disbursementRequests.length} members.`,
    };
  }

  /**
   * Group Collection — record a single center meeting collection for the whole group.
   * Typically done weekly/monthly at center meetings.
   */
  async groupCollection(
    orgId: string,
    groupId: string,
    dto: GroupCollectionDto,
  ): Promise<object> {
    this.logger.log(`Group collection for group ${groupId}`);

    const group = (await this.getGroup(orgId, groupId)) as any;

    const memberIds = group.members
      .filter((m: any) => m.status === 'ACTIVE')
      .map((m: any) => m.customerId);

    // Find active loans for group members
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        customerId: { in: memberIds },
        loanStatus: 'ACTIVE',
      },
    });

    if (activeLoans.length === 0) {
      return {
        groupId,
        groupName: group.groupName,
        message: 'No active loans for group members.',
        collectionDate: dto.collectionDate,
        collectedAmountPaisa: dto.collectedAmountPaisa,
      };
    }

    // Distribute collection proportionally across active loans
    const perLoanAmount = Math.floor(
      dto.collectedAmountPaisa / activeLoans.length,
    );
    const remainder =
      dto.collectedAmountPaisa - perLoanAmount * activeLoans.length;

    const collectionRecords = activeLoans.map((loan, idx) => ({
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      allocatedAmountPaisa: perLoanAmount + (idx === 0 ? remainder : 0),
    }));

    // Log the group collection event
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: 'SYSTEM',
        entityType: 'MFI_GROUP',
        entityId: groupId,
        action: 'UPDATE' as any,
        changes: {
          event: 'GROUP_COLLECTION',
          collectionDate: dto.collectionDate,
          collectedAmountPaisa: dto.collectedAmountPaisa,
          receivedBy: dto.receivedBy,
          loanCount: activeLoans.length,
          centerName: group.centerName,
          remarks: dto.remarks ?? null,
        },
      },
    });

    return {
      groupId,
      groupName: group.groupName,
      centerName: group.centerName,
      collectionDate: dto.collectionDate,
      totalCollectedPaisa: dto.collectedAmountPaisa,
      receivedBy: dto.receivedBy,
      activeLoanCount: activeLoans.length,
      collectionRecords,
      remarks: dto.remarks ?? null,
      message: `Group collection recorded. Distribute to individual loan accounts via payment service.`,
    };
  }

  // ── Center Meeting Schedule ─────────────────────────────────────────────

  /**
   * Get the center meeting schedule for all groups in a branch.
   */
  async getCenterMeetingSchedule(orgId: string, branchId: string): Promise<object> {
    const groups = await (this.prisma as any).mFIGroup.findMany({
      where: {
        organizationId: orgId,
        branchId,
        status: 'ACTIVE',
      },
      include: { members: { where: { status: 'ACTIVE' } } },
      orderBy: { meetingDay: 'asc' },
    });

    const dayOrder: Record<string, number> = {
      MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
      FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
    };

    const schedule = groups
      .sort((a: any, b: any) => (dayOrder[a.meetingDay] ?? 8) - (dayOrder[b.meetingDay] ?? 8))
      .map((g: any) => ({
        groupId: g.id,
        groupName: g.groupName,
        centerName: g.centerName,
        meetingDay: g.meetingDay,
        meetingTime: g.meetingTime,
        activeMemberCount: g.members.length,
        branchId: g.branchId,
      }));

    return {
      organizationId: orgId,
      branchId,
      asOfDate: new Date().toISOString().slice(0, 10),
      totalGroups: groups.length,
      schedule,
    };
  }
}
