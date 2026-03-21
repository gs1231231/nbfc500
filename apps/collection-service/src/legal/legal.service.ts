import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  CreateLegalCaseDto,
  UpdateLegalCaseDto,
  GenerateNoticeDto,
} from './dto/legal.dto';

const VALID_CASE_TYPES = ['SARFAESI', 'DRT', 'NCLT', 'CIVIL'];
const VALID_STATUSES = [
  'FILED',
  'NOTICE_ISSUED',
  'HEARING_SCHEDULED',
  'DECREE_OBTAINED',
  'EXECUTION',
  'SETTLED',
  'DISMISSED',
  'WITHDRAWN',
];

type NoticeType = 'SECTION_13_2' | 'DEMAND_NOTICE' | 'POSSESSION_NOTICE';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Case Management
  // -------------------------------------------------------------------------

  async createCase(orgId: string, dto: CreateLegalCaseDto): Promise<object> {
    if (!VALID_CASE_TYPES.includes(dto.caseType)) {
      throw new BadRequestException(
        `Invalid caseType. Must be one of: ${VALID_CASE_TYPES.join(', ')}`,
      );
    }

    const loan = await this.prisma.loan.findFirst({
      where: { id: dto.loanId, organizationId: orgId },
      include: { customer: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    const caseNumber = await this.generateCaseNumber(dto.caseType);

    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'LEGAL',
        accountName: 'Legal Cases',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: `Legal case ${dto.caseType} initiated for loan ${loan.loanNumber}. Outstanding: INR ${(dto.outstandingAmountPaisa / 100).toFixed(2)}`,
        referenceType: 'LEGAL_CASE',
        referenceId: caseNumber,
      },
    });

    return {
      caseId: caseNumber,
      caseNumber,
      organizationId: orgId,
      loanId: dto.loanId,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      caseType: dto.caseType,
      status: 'FILED',
      outstandingAmountPaisa: dto.outstandingAmountPaisa,
      lawyerName: dto.lawyerName ?? null,
      lawyerContact: dto.lawyerContact ?? null,
      courtName: dto.courtName ?? null,
      filingDate: dto.filingDate ?? new Date().toISOString().split('T')[0],
      remarks: dto.remarks ?? null,
      notices: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateStatus(
    orgId: string,
    caseId: string,
    dto: UpdateLegalCaseDto,
  ): Promise<object> {
    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    const entry = await this.assertCaseExists(orgId, caseId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `Legal case ${caseId} updated. Status: ${dto.status ?? 'N/A'}. ${dto.remarks ?? ''}`,
        updatedAt: new Date(),
      },
    });

    return {
      caseId,
      status: dto.status,
      hearingDate: dto.hearingDate ?? null,
      courtOrderDetails: dto.courtOrderDetails ?? null,
      lawyerName: dto.lawyerName ?? null,
      lawyerContact: dto.lawyerContact ?? null,
      remarks: dto.remarks ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  async generateNotice(
    orgId: string,
    caseId: string,
    dto: GenerateNoticeDto,
  ): Promise<object> {
    const entry = await this.assertCaseExists(orgId, caseId);

    // Parse loan number from narration
    const narrationParts = entry.narration.split(' ');
    const loanNumberIdx = narrationParts.findIndex((p) => p === 'loan');
    const loanNumber =
      loanNumberIdx >= 0
        ? narrationParts[loanNumberIdx + 1]
        : 'UNKNOWN';

    const loan = await this.prisma.loan.findFirst({
      where: { loanNumber, organizationId: orgId },
      include: { customer: true },
    });

    const customerName = loan?.customer?.fullName ?? 'Customer';
    const outstanding = loan
      ? `INR ${((loan.outstandingPrincipalPaisa + loan.outstandingInterestPaisa) / 100).toFixed(2)}`
      : 'as per records';

    const noticeContent = this.buildNoticeTemplate(
      dto.noticeType as NoticeType,
      {
        customerName,
        loanNumber,
        outstanding,
        caseId,
        date: new Date().toLocaleDateString('en-IN'),
      },
    );

    const noticeRef = `NOTICE-${caseId}-${Date.now()}`;

    return {
      noticeId: noticeRef,
      caseId,
      noticeType: dto.noticeType,
      content: noticeContent,
      generatedAt: new Date().toISOString(),
      servedOn: dto.servedOn ?? null,
      remarks: dto.remarks ?? null,
    };
  }

  async listCases(orgId: string, page = 1, limit = 20): Promise<object> {
    const entries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: 'LEGAL_CASE' },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.glEntry.count({
      where: { organizationId: orgId, referenceType: 'LEGAL_CASE' },
    });

    return {
      data: entries.map((e) => ({
        caseId: e.referenceId,
        narration: e.narration,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getCase(orgId: string, caseId: string): Promise<object> {
    const entry = await this.assertCaseExists(orgId, caseId);
    return {
      caseId,
      narration: entry.narration,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Notice Templates
  // -------------------------------------------------------------------------

  private buildNoticeTemplate(
    noticeType: NoticeType,
    vars: {
      customerName: string;
      loanNumber: string;
      outstanding: string;
      caseId: string;
      date: string;
    },
  ): string {
    switch (noticeType) {
      case 'SECTION_13_2':
        return `
NOTICE UNDER SECTION 13(2) OF THE SECURITISATION AND RECONSTRUCTION OF
FINANCIAL ASSETS AND ENFORCEMENT OF SECURITY INTEREST ACT, 2002 (SARFAESI)

Date: ${vars.date}

To,
${vars.customerName}
(Borrower)

Sub: Notice demanding repayment of secured debt — Loan No. ${vars.loanNumber}

Dear ${vars.customerName},

This Notice is issued under Section 13(2) of the SARFAESI Act, 2002.

You are hereby called upon to discharge in full the liabilities under the
above-referenced loan within 60 (sixty) days from the date of receipt of
this notice. The total outstanding amount payable is ${vars.outstanding}.

Failure to repay the dues within the stipulated period shall entitle us
to enforce the security interest in accordance with the provisions of the
SARFAESI Act, 2002.

Reference Case: ${vars.caseId}

For and on behalf of the Company,
Authorised Signatory
`.trim();

      case 'DEMAND_NOTICE':
        return `
DEMAND NOTICE

Date: ${vars.date}

To,
${vars.customerName}

Sub: Demand for repayment of outstanding loan dues — Loan No. ${vars.loanNumber}

Dear ${vars.customerName},

This is to bring to your notice that a sum of ${vars.outstanding} is outstanding
and overdue under the above-mentioned loan account.

You are hereby called upon to pay the outstanding amount within 30 (thirty)
days from the date of this notice, failing which legal proceedings shall be
initiated against you without further notice.

Reference Case: ${vars.caseId}

Yours faithfully,
Authorised Signatory
`.trim();

      case 'POSSESSION_NOTICE':
        return `
NOTICE OF POSSESSION

Date: ${vars.date}

PUBLIC NOTICE

Notice is hereby given that the undersigned, being a Secured Creditor
under the SARFAESI Act, 2002, has taken possession of the secured assets
held as security for the loan (No. ${vars.loanNumber}) availed by
${vars.customerName}, the outstanding dues under which amount to ${vars.outstanding}.

The secured assets are now in the possession of the Company as on ${vars.date}.

Any person having interest in the said secured assets may raise their
objection within 15 days from the date of this notice.

Reference Case: ${vars.caseId}

For and on behalf of the Company,
Authorised Officer (SARFAESI)
`.trim();

      default:
        return `Notice for case ${vars.caseId} — ${vars.date}`;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async assertCaseExists(orgId: string, caseId: string) {
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'LEGAL_CASE',
        referenceId: caseId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`Legal case ${caseId} not found`);
    }
    return entry;
  }

  private async generateCaseNumber(caseType: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.glEntry.count({
      where: { referenceType: 'LEGAL_CASE' },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `LEGAL/${caseType}/${year}/${seq}`;
  }
}
