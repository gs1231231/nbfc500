import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  InitiateWriteoffDto,
  ApproveWriteoffDto,
  RecordWriteoffRecoveryDto,
} from './dto/writeoff.dto';

// GL Account Codes for write-off entries
const GL_WRITEOFF_EXPENSE = '5001'; // Dr Write-off Expense
const GL_LOAN_ASSET = '1001';       // Cr Loan Asset
const GL_PROVISION = '2001';        // Cr/Dr Provision Account
const GL_CASH = '1000';             // Dr Cash/Bank on recovery

@Injectable()
export class WriteoffService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateWriteoff(
    orgId: string,
    dto: InitiateWriteoffDto,
  ): Promise<object> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: dto.loanId, organizationId: orgId },
      include: { customer: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    if (loan.loanStatus === 'WRITTEN_OFF') {
      throw new BadRequestException('Loan is already written off');
    }

    const writeoffRef = await this.generateWriteoffRef();

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'WRITEOFF_INIT',
        accountName: 'Write-off Initiated',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: `Write-off initiated for loan ${loan.loanNumber}. Principal: ${dto.outstandingPrincipalPaisa}. Reason: ${dto.reason}`,
        referenceType: 'WRITEOFF',
        referenceId: writeoffRef,
      },
    });

    return {
      writeoffId: writeoffRef,
      writeoffRef,
      organizationId: orgId,
      loanId: dto.loanId,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      status: 'INITIATED',
      reason: dto.reason,
      outstandingPrincipalPaisa: dto.outstandingPrincipalPaisa,
      outstandingInterestPaisa: dto.outstandingInterestPaisa,
      provisionAmountPaisa: dto.provisionAmountPaisa,
      totalWriteoffAmountPaisa:
        dto.outstandingPrincipalPaisa + dto.outstandingInterestPaisa,
      remarks: dto.remarks ?? null,
      approvalRequired: true,
      createdAt: new Date().toISOString(),
    };
  }

  async approveWriteoff(
    orgId: string,
    writeoffId: string,
    dto: ApproveWriteoffDto,
  ): Promise<object> {
    const entry = await this.assertWriteoffExists(orgId, writeoffId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `${entry.narration} | Board Approved: ${dto.boardResolutionNumber} on ${dto.boardApprovalDate} by ${dto.approvedBy}`,
        updatedAt: new Date(),
      },
    });

    return {
      writeoffId,
      status: 'BOARD_APPROVED',
      boardResolutionNumber: dto.boardResolutionNumber,
      boardApprovalDate: dto.boardApprovalDate,
      approvedBy: dto.approvedBy,
      remarks: dto.remarks ?? null,
      approvedAt: new Date().toISOString(),
      nextStep: 'Call /execute to post GL entries and update loan status',
    };
  }

  async executeWriteoff(orgId: string, writeoffId: string): Promise<object> {
    const entry = await this.assertWriteoffExists(orgId, writeoffId);

    // Parse amounts from narration (mock pattern)
    const narration = entry.narration;
    const principalMatch = narration.match(/Principal: (\d+)/);
    const principalPaisa = principalMatch ? parseInt(principalMatch[1]) : 0;

    // Post GL entries: Dr Write-off Expense / Cr Loan Asset
    const glEntries = [
      {
        organizationId: orgId,
        branchId: entry.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: GL_WRITEOFF_EXPENSE,
        accountName: 'Write-off Expense',
        debitAmountPaisa: principalPaisa,
        creditAmountPaisa: 0,
        narration: `Write-off execution — Dr Write-off Expense for ${writeoffId}`,
        referenceType: 'WRITEOFF_GL',
        referenceId: writeoffId,
      },
      {
        organizationId: orgId,
        branchId: entry.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: GL_LOAN_ASSET,
        accountName: 'Loan Asset',
        debitAmountPaisa: 0,
        creditAmountPaisa: principalPaisa,
        narration: `Write-off execution — Cr Loan Asset for ${writeoffId}`,
        referenceType: 'WRITEOFF_GL',
        referenceId: writeoffId,
      },
    ];

    await this.prisma.glEntry.createMany({ data: glEntries });

    // Update the reference entry status
    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `${entry.narration} | EXECUTED`,
        updatedAt: new Date(),
      },
    });

    return {
      writeoffId,
      status: 'EXECUTED',
      glEntries: glEntries.map((e) => ({
        accountCode: e.accountCode,
        accountName: e.accountName,
        debitAmountPaisa: e.debitAmountPaisa,
        creditAmountPaisa: e.creditAmountPaisa,
        narration: e.narration,
      })),
      executedAt: new Date().toISOString(),
      message:
        'Write-off GL entries posted. Loan status should be updated to WRITTEN_OFF.',
    };
  }

  async recordRecovery(
    orgId: string,
    writeoffId: string,
    dto: RecordWriteoffRecoveryDto,
  ): Promise<object> {
    const entry = await this.assertWriteoffExists(orgId, writeoffId);

    // GL recovery entry: Dr Cash/Bank / Cr Write-off Recovery Income
    const recoveryEntries = [
      {
        organizationId: orgId,
        branchId: entry.branchId,
        entryDate: new Date(dto.recoveryDate),
        valueDate: new Date(dto.recoveryDate),
        accountCode: GL_CASH,
        accountName: 'Bank / Cash',
        debitAmountPaisa: dto.recoveredAmountPaisa,
        creditAmountPaisa: 0,
        narration: `Write-off recovery — Dr Bank for ${writeoffId}. Ref: ${dto.referenceNumber}`,
        referenceType: 'WRITEOFF_RECOVERY',
        referenceId: writeoffId,
      },
      {
        organizationId: orgId,
        branchId: entry.branchId,
        entryDate: new Date(dto.recoveryDate),
        valueDate: new Date(dto.recoveryDate),
        accountCode: '3002',
        accountName: 'Write-off Recovery Income',
        debitAmountPaisa: 0,
        creditAmountPaisa: dto.recoveredAmountPaisa,
        narration: `Write-off recovery — Cr Recovery Income for ${writeoffId}`,
        referenceType: 'WRITEOFF_RECOVERY',
        referenceId: writeoffId,
      },
    ];

    await this.prisma.glEntry.createMany({ data: recoveryEntries });

    return {
      writeoffId,
      recovery: {
        recoveredAmountPaisa: dto.recoveredAmountPaisa,
        recoveryDate: dto.recoveryDate,
        recoveryMode: dto.recoveryMode,
        referenceNumber: dto.referenceNumber,
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
      glEntries: recoveryEntries.map((e) => ({
        accountCode: e.accountCode,
        accountName: e.accountName,
        debitAmountPaisa: e.debitAmountPaisa,
        creditAmountPaisa: e.creditAmountPaisa,
      })),
    };
  }

  async listWriteoffs(orgId: string, page = 1, limit = 20): Promise<object> {
    const entries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: 'WRITEOFF' },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.glEntry.count({
      where: { organizationId: orgId, referenceType: 'WRITEOFF' },
    });

    return {
      data: entries.map((e) => ({
        writeoffId: e.referenceId,
        narration: e.narration,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getWriteoff(orgId: string, writeoffId: string): Promise<object> {
    const entry = await this.assertWriteoffExists(orgId, writeoffId);
    return {
      writeoffId,
      narration: entry.narration,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async assertWriteoffExists(orgId: string, writeoffId: string) {
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'WRITEOFF',
        referenceId: writeoffId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`Write-off record ${writeoffId} not found`);
    }
    return entry;
  }

  private async generateWriteoffRef(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.glEntry.count({
      where: { referenceType: 'WRITEOFF' },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `WO/${year}/${seq}`;
  }
}
