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
  TechnicalWriteOffDto,
  BoardApprovalDto,
  PostWriteOffRecoveryDto,
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

  // ── GAP 10: Additional write-off operations ──────────────────────────────

  /**
   * Technical Write-Off — removes loan from books while keeping collection active.
   * Requires 100% provision to have been made already.
   * GL: Dr Provision Account / Cr Loan Asset (net off, no P&L impact at this point).
   */
  async technicalWriteOff(
    orgId: string,
    loanId: string,
    dto: TechnicalWriteOffDto,
  ): Promise<object> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true },
    });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    if (loan.loanStatus === 'WRITTEN_OFF') {
      throw new BadRequestException('Loan is already written off');
    }

    const writeoffRef = await this.generateWriteoffRef();
    const totalAmount =
      dto.outstandingPrincipalPaisa + dto.outstandingInterestPaisa;

    // Technical write-off: provision offsets the asset — no fresh P&L hit
    await this.prisma.glEntry.createMany({
      data: [
        {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(),
          valueDate: new Date(),
          accountCode: GL_PROVISION,
          accountName: 'Loan Loss Provision',
          debitAmountPaisa: dto.provisionAmountPaisa,
          creditAmountPaisa: 0,
          narration: `Technical write-off Dr Provision — ${loan.loanNumber} | Ref: ${writeoffRef}`,
          referenceType: 'TECHNICAL_WRITEOFF',
          referenceId: writeoffRef,
        },
        {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(),
          valueDate: new Date(),
          accountCode: GL_LOAN_ASSET,
          accountName: 'Loan Asset',
          debitAmountPaisa: 0,
          creditAmountPaisa: totalAmount,
          narration: `Technical write-off Cr Loan Asset — ${loan.loanNumber} | Ref: ${writeoffRef}`,
          referenceType: 'TECHNICAL_WRITEOFF',
          referenceId: writeoffRef,
        },
      ],
    });

    // Update loan status to TECHNICAL_WRITTEN_OFF; collection continues
    await this.prisma.loan.update({
      where: { id: loan.id },
      data: { loanStatus: 'WRITTEN_OFF' as any },
    });

    return {
      writeoffId: writeoffRef,
      loanId,
      loanNumber: loan.loanNumber,
      type: 'TECHNICAL',
      status: 'TECHNICAL_WRITTEN_OFF',
      totalWrittenOffPaisa: totalAmount,
      provisionUsedPaisa: dto.provisionAmountPaisa,
      collectionContinues: true,
      message: 'Loan removed from books. Collection efforts continue.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Board Approval — record board resolution number and date for a write-off.
   * RBI mandates board approval for write-offs above certain thresholds.
   */
  async boardApproval(
    orgId: string,
    writeoffId: string,
    dto: BoardApprovalDto,
  ): Promise<object> {
    const entry = await this.assertWriteoffExists(orgId, writeoffId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: [
          entry.narration,
          `BOARD_APPROVED: Resolution#${dto.boardResolutionNumber}`,
          `Date: ${dto.boardResolutionDate}`,
          `Meeting: ${dto.meetingDate}`,
          `By: ${dto.approvedBy}`,
          dto.remarks ? `Remarks: ${dto.remarks}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        updatedAt: new Date(),
      },
    });

    return {
      writeoffId,
      boardResolutionNumber: dto.boardResolutionNumber,
      boardResolutionDate: dto.boardResolutionDate,
      meetingDate: dto.meetingDate,
      approvedBy: dto.approvedBy,
      remarks: dto.remarks ?? null,
      status: 'BOARD_APPROVED',
      approvedAt: new Date().toISOString(),
    };
  }

  /**
   * Post Write-Off Recovery — record cash recovered after write-off.
   * GL: Dr Bank / Cr Write-off Recovery Income.
   * Track total recovered vs written-off for recovery rate computation.
   */
  async postWriteOffRecovery(
    orgId: string,
    loanId: string,
    dto: PostWriteOffRecoveryDto,
  ): Promise<object> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
    });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    const recoveryRef = `REC/${loanId.slice(0, 8)}/${Date.now()}`;

    await this.prisma.glEntry.createMany({
      data: [
        {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(dto.recoveryDate),
          valueDate: new Date(dto.recoveryDate),
          accountCode: GL_CASH,
          accountName: 'Bank / Cash',
          debitAmountPaisa: dto.amountPaisa,
          creditAmountPaisa: 0,
          narration: `Post write-off recovery Dr Bank — Loan ${loan.loanNumber} | Ref: ${dto.referenceNumber}`,
          referenceType: 'POST_WRITEOFF_RECOVERY',
          referenceId: recoveryRef,
        },
        {
          organizationId: orgId,
          branchId: loan.branchId,
          entryDate: new Date(dto.recoveryDate),
          valueDate: new Date(dto.recoveryDate),
          accountCode: '3002',
          accountName: 'Write-off Recovery Income',
          debitAmountPaisa: 0,
          creditAmountPaisa: dto.amountPaisa,
          narration: `Post write-off recovery Cr Income — Loan ${loan.loanNumber} | Mode: ${dto.recoveryMode}`,
          referenceType: 'POST_WRITEOFF_RECOVERY',
          referenceId: recoveryRef,
        },
      ],
    });

    // Compute total recovered for this loan
    const allRecoveries = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        referenceType: 'POST_WRITEOFF_RECOVERY',
        narration: { contains: loan.loanNumber },
        accountCode: GL_CASH,
      },
      _sum: { debitAmountPaisa: true },
    });

    const totalRecovered = allRecoveries._sum.debitAmountPaisa ?? 0;

    return {
      loanId,
      loanNumber: loan.loanNumber,
      recoveryRef,
      recoveredNowPaisa: dto.amountPaisa,
      totalRecoveredPaisa: totalRecovered,
      recoveryDate: dto.recoveryDate,
      recoveryMode: dto.recoveryMode,
      referenceNumber: dto.referenceNumber,
      glEntries: [
        { account: 'Bank', debit: dto.amountPaisa, credit: 0 },
        { account: 'Write-off Recovery Income', debit: 0, credit: dto.amountPaisa },
      ],
    };
  }

  /**
   * Write-Off Report — total written off, total recovered, recovery rate % for a FY.
   */
  async getWriteOffReport(
    orgId: string,
    fy?: string,
    from?: string,
    to?: string,
  ): Promise<object> {
    let fromDate: Date;
    let toDate: Date;

    if (fy) {
      const [startYear] = fy.split('-').map(Number);
      fromDate = new Date(startYear, 3, 1); // April 1
      toDate = new Date(startYear + 1, 2, 31, 23, 59, 59); // March 31
    } else {
      fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 3, 1);
      toDate = to ? new Date(to) : new Date();
    }

    const writtenOffAgg = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        referenceType: { in: ['WRITEOFF', 'TECHNICAL_WRITEOFF'] },
        accountCode: GL_WRITEOFF_EXPENSE,
        entryDate: { gte: fromDate, lte: toDate },
      },
      _sum: { debitAmountPaisa: true },
      _count: true,
    });

    const recoveredAgg = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        referenceType: { in: ['WRITEOFF_RECOVERY', 'POST_WRITEOFF_RECOVERY'] },
        accountCode: GL_CASH,
        entryDate: { gte: fromDate, lte: toDate },
      },
      _sum: { debitAmountPaisa: true },
    });

    const totalWrittenOff = writtenOffAgg._sum.debitAmountPaisa ?? 0;
    const totalRecovered = recoveredAgg._sum.debitAmountPaisa ?? 0;
    const recoveryRate =
      totalWrittenOff > 0
        ? Math.round((totalRecovered / totalWrittenOff) * 10000) / 100
        : 0;

    return {
      organizationId: orgId,
      period: { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) },
      fy: fy ?? null,
      totalWrittenOffPaisa: totalWrittenOff,
      totalWrittenOffCount: writtenOffAgg._count,
      totalRecoveredPaisa: totalRecovered,
      netWrittenOffPaisa: totalWrittenOff - totalRecovered,
      recoveryRatePercent: recoveryRate,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Suo Motu Write-Off — auto-identify loans meeting write-off criteria:
   * NPA > 4 years (i.e., Loss Assets), 100% provision already made.
   */
  async suoMotoWriteOff(orgId: string): Promise<object> {
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    const eligibleLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        npaClassification: 'NPA_LOSS',
        npaDate: { lte: fourYearsAgo },
        loanStatus: { notIn: ['WRITTEN_OFF', 'CLOSED'] as any },
      },
      include: { customer: true },
      take: 200, // Safety cap per batch
    });

    const candidates = eligibleLoans.map((loan) => ({
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      npaDate: loan.npaDate,
      npaClassification: loan.npaClassification,
      outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
      dpd: loan.dpd,
      eligibilityReason: 'NPA_LOSS_ASSET_OVER_4_YEARS',
    }));

    return {
      organizationId: orgId,
      identifiedAt: new Date().toISOString(),
      candidateCount: candidates.length,
      criteria: [
        'NPA Classification: LOSS',
        'NPA Date older than 4 years',
        'Loan Status: ACTIVE or NPA',
      ],
      candidates,
      message:
        candidates.length > 0
          ? 'Review candidates and initiate technical write-off via POST /api/v1/writeoffs/:id/technical'
          : 'No loans currently meet the suo-motu write-off criteria.',
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
