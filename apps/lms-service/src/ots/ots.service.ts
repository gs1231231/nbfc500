import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  CreateOtsProposalDto,
  ReviewOtsProposalDto,
  RecordOtsPaymentDto,
} from './dto/ots.dto';

// One Time Settlement workflow:
// PROPOSED -> UNDER_REVIEW -> APPROVED | REJECTED -> PAYMENT_PENDING -> SETTLED

@Injectable()
export class OtsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProposal(orgId: string, dto: CreateOtsProposalDto): Promise<object> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: dto.loanId, organizationId: orgId },
      include: { customer: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    const totalOutstanding =
      loan.outstandingPrincipalPaisa + loan.outstandingInterestPaisa;

    if (dto.proposedAmountPaisa > totalOutstanding) {
      throw new BadRequestException(
        'Proposed amount cannot exceed total outstanding',
      );
    }

    const proposalNumber = await this.generateProposalNumber();

    // Persist reference via GL metadata pattern
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'OTS',
        accountName: 'OTS Proposals',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: `OTS proposal ${proposalNumber} for loan ${loan.loanNumber}. Proposed: ${dto.proposedAmountPaisa}. Waiver: ${dto.waiverAmountPaisa}`,
        referenceType: 'OTS_PROPOSAL',
        referenceId: proposalNumber,
      },
    });

    return {
      proposalId: proposalNumber,
      proposalNumber,
      organizationId: orgId,
      loanId: dto.loanId,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      status: 'PROPOSED',
      totalOutstandingPaisa: totalOutstanding,
      proposedAmountPaisa: dto.proposedAmountPaisa,
      waiverAmountPaisa: dto.waiverAmountPaisa,
      paymentPlan: dto.paymentPlan,
      installmentCount: dto.installmentCount ?? null,
      firstPaymentDate: dto.firstPaymentDate,
      remarks: dto.remarks ?? null,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async reviewProposal(
    orgId: string,
    proposalId: string,
    dto: ReviewOtsProposalDto,
  ): Promise<object> {
    if (!['APPROVED', 'REJECTED'].includes(dto.decision)) {
      throw new BadRequestException('Decision must be APPROVED or REJECTED');
    }

    const entry = await this.assertProposalExists(orgId, proposalId);

    const newStatus =
      dto.decision === 'APPROVED' ? 'PAYMENT_PENDING' : 'REJECTED';

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `${entry.narration} | Review: ${dto.decision}. ${dto.reviewRemarks}`,
        updatedAt: new Date(),
      },
    });

    return {
      proposalId,
      status: newStatus,
      decision: dto.decision,
      reviewRemarks: dto.reviewRemarks,
      approvedAmountPaisa: dto.approvedAmountPaisa ?? null,
      reviewedAt: new Date().toISOString(),
    };
  }

  async recordPayment(
    orgId: string,
    proposalId: string,
    dto: RecordOtsPaymentDto,
  ): Promise<object> {
    const entry = await this.assertProposalExists(orgId, proposalId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `${entry.narration} | Payment: ${dto.amountPaisa} on ${dto.paymentDate}`,
        updatedAt: new Date(),
      },
    });

    return {
      proposalId,
      payment: {
        amountPaisa: dto.amountPaisa,
        paymentDate: dto.paymentDate,
        paymentMode: dto.paymentMode,
        referenceNumber: dto.referenceNumber,
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
      message: 'OTS payment recorded. Review to mark as SETTLED once fully paid.',
    };
  }

  async closeProposal(orgId: string, proposalId: string): Promise<object> {
    const entry = await this.assertProposalExists(orgId, proposalId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `${entry.narration} | SETTLED`,
        updatedAt: new Date(),
      },
    });

    return {
      proposalId,
      status: 'SETTLED',
      closedAt: new Date().toISOString(),
      message: 'OTS settlement completed successfully',
    };
  }

  async listProposals(orgId: string, page = 1, limit = 20): Promise<object> {
    const entries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: 'OTS_PROPOSAL' },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.glEntry.count({
      where: { organizationId: orgId, referenceType: 'OTS_PROPOSAL' },
    });

    return {
      data: entries.map((e) => ({
        proposalId: e.referenceId,
        narration: e.narration,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getProposal(orgId: string, proposalId: string): Promise<object> {
    const entry = await this.assertProposalExists(orgId, proposalId);
    return {
      proposalId,
      narration: entry.narration,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async assertProposalExists(orgId: string, proposalId: string) {
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'OTS_PROPOSAL',
        referenceId: proposalId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`OTS proposal ${proposalId} not found`);
    }
    return entry;
  }

  private async generateProposalNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.glEntry.count({
      where: { referenceType: 'OTS_PROPOSAL' },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `OTS/${year}/${seq}`;
  }
}
