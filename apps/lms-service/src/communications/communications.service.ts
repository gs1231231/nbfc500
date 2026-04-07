import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@bankos/database';

// ── Communication template codes (stored in DocumentTemplate) ────────────────

const TEMPLATE_CODES = {
  WELCOME_LETTER:         'WELCOME_LETTER',
  REPAYMENT_SCHEDULE:     'REPAYMENT_SCHEDULE',
  NACH_CONFIRMATION:      'NACH_CONFIRMATION',
  INSURANCE_CERTIFICATE:  'INSURANCE_CERTIFICATE',
  ANNUAL_SOA:             'ANNUAL_SOA',
  INTEREST_CERTIFICATE:   'INTEREST_CERTIFICATE',
  OUTSTANDING_CONFIRM:    'OUTSTANDING_CONFIRMATION',
  RATE_CHANGE_NOTICE:     'RATE_CHANGE_NOTICE',
} as const;

// ── Return types ──────────────────────────────────────────────────────────────

export interface WelcomeKitResult {
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  dispatchedDocuments: string[];
  channel: string;
  dispatchedAt: string;
}

export interface AnnualStatementResult {
  organizationId: string;
  period: string;
  processedCount: number;
  failedCount: number;
  loanIds: string[];
}

export interface RateChangeResult {
  loanId: string;
  loanNumber: string;
  oldRate: number;
  newRate: number;
  effectiveDate: string;
  notifiedAt: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send Welcome Kit after disbursement:
   *  1. Welcome letter with key loan details
   *  2. Repayment schedule (all EMI dates and amounts)
   *  3. NACH mandate confirmation
   *  4. Insurance certificate (if policy exists)
   *
   * Documents are logged in GeneratedDocument and NotificationLog.
   */
  async sendWelcomeKit(orgId: string, loanId: string): Promise<WelcomeKitResult> {
    this.logger.log(`Sending welcome kit for loan ${loanId}`);

    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        customer: true,
        schedules: { orderBy: { dueDate: 'asc' } },
        nachMandates: { where: { status: 'ACTIVE' }, take: 1 },
        insurancePolicies: { where: { status: 'ACTIVE' }, take: 1 },
        product: { select: { name: true } },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const dispatchedDocuments: string[] = [];

    // 1. Welcome letter
    await this.generateAndLogDocument(orgId, loanId, loan.customerId, TEMPLATE_CODES.WELCOME_LETTER, {
      customerName: loan.customer.fullName,
      loanNumber: loan.loanNumber,
      productName: loan.product?.name ?? '',
      disbursedAmount: String(Math.round(loan.disbursedAmountPaisa / 100)),
      interestRate: String(loan.interestRateBps / 100), // convert BPS to %
      tenureMonths: String(loan.tenureMonths ?? 0),
      emiAmount: String(Math.round(loan.emiAmountPaisa / 100)),
    });
    dispatchedDocuments.push('WELCOME_LETTER');

    // 2. Repayment schedule
    if (loan.schedules.length > 0) {
      await this.generateAndLogDocument(orgId, loanId, loan.customerId, TEMPLATE_CODES.REPAYMENT_SCHEDULE, {
        customerName: loan.customer.fullName,
        loanNumber: loan.loanNumber,
        totalInstallments: String(loan.schedules.length),
        firstEmiDate: loan.schedules[0]?.dueDate?.toISOString().slice(0, 10) ?? '',
        lastEmiDate: loan.schedules[loan.schedules.length - 1]?.dueDate?.toISOString().slice(0, 10) ?? '',
      });
      dispatchedDocuments.push('REPAYMENT_SCHEDULE');
    }

    // 3. NACH confirmation
    if (loan.nachMandates.length > 0) {
      const nach = loan.nachMandates[0];
      await this.generateAndLogDocument(orgId, loanId, loan.customerId, TEMPLATE_CODES.NACH_CONFIRMATION, {
        customerName: loan.customer.fullName,
        loanNumber: loan.loanNumber,
        umrn: nach.umrn ?? 'PENDING',
        mandateType: nach.mandateType,
        frequency: nach.frequency,
        emiAmount: String(Math.round(nach.maxAmountPaisa / 100)),
        startDate: nach.startDate.toISOString().slice(0, 10),
        endDate: nach.endDate.toISOString().slice(0, 10),
      });
      dispatchedDocuments.push('NACH_CONFIRMATION');
    }

    // 4. Insurance certificate
    if (loan.insurancePolicies.length > 0) {
      const insurance = loan.insurancePolicies[0];
      await this.generateAndLogDocument(orgId, loanId, loan.customerId, TEMPLATE_CODES.INSURANCE_CERTIFICATE, {
        customerName: loan.customer.fullName,
        loanNumber: loan.loanNumber,
        policyType: insurance.policyType,
        providerName: insurance.providerName,
        policyNumber: insurance.policyNumber ?? '',
        sumInsured: String(Math.round(insurance.sumInsuredPaisa / 100)),
        startDate: insurance.startDate.toISOString().slice(0, 10),
        endDate: insurance.endDate.toISOString().slice(0, 10),
      });
      dispatchedDocuments.push('INSURANCE_CERTIFICATE');
    }

    // Log notification
    await this.prisma.notificationLog.create({
      data: {
        organizationId: orgId,
        customerId: loan.customerId,
        channel: 'EMAIL',
        templateCode: 'WELCOME_KIT',
        recipient: loan.customer.email ?? loan.customer.phone,
        content: `Welcome Kit dispatched for loan ${loan.loanNumber}`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return {
      loanId,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      dispatchedDocuments,
      channel: 'EMAIL',
      dispatchedAt: new Date().toISOString(),
    };
  }

  /**
   * Annual Statement Dispatch (scheduled: runs on April 1 each year).
   * Sends to all active loans of an org:
   *  1. Statement of Account (SOA)
   *  2. Interest Certificate (for tax purposes, IT Section 80C/24)
   *  3. Outstanding confirmation
   */
  @Cron('0 6 1 4 *', { name: 'annual-statement', timeZone: 'Asia/Kolkata' })
  async scheduledAnnualStatements(): Promise<void> {
    this.logger.log('Starting scheduled annual statement dispatch (April 1)');
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const org of orgs) {
      try {
        await this.sendAnnualStatement(org.id);
      } catch (err) {
        this.logger.error(`Annual statement failed for org ${org.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Send annual statements for all active loans in an org.
   */
  async sendAnnualStatement(orgId: string): Promise<AnnualStatementResult> {
    this.logger.log(`Sending annual statements for org ${orgId}`);

    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyLabel = `${year}-${String(year + 1).slice(2)}`; // e.g. 2025-26

    const activeLoans: any[] = await (this.prisma.loan as any).findMany({
      where: {
        organizationId: orgId,
        loanStatus: { notIn: ['CLOSED', 'WRITTEN_OFF'] },
      },
      include: { customer: true },
    });

    let processedCount = 0;
    let failedCount = 0;
    const loanIds: string[] = [];

    for (const loan of activeLoans) {
      try {
        const fyStart = new Date(year, 3, 1);    // April 1
        const fyEnd = new Date(year + 1, 2, 31); // March 31

        // Interest paid during FY (using allocatedToInterestPaisa from successful payments)
        const interestPaid = await this.prisma.payment.aggregate({
          where: {
            loanId: loan.id,
            paymentDate: { gte: fyStart, lte: fyEnd },
            status: 'SUCCESS' as any,
          },
          _sum: { allocatedToInterestPaisa: true },
        });

        const interestAmountPaisa = interestPaid._sum.allocatedToInterestPaisa ?? 0;

        // 1. SOA
        await this.generateAndLogDocument(orgId, loan.id, loan.customerId, TEMPLATE_CODES.ANNUAL_SOA, {
          customerName: loan.customer.fullName,
          loanNumber: loan.loanNumber,
          fy: fyLabel,
          outstandingPrincipal: String(Math.round(loan.outstandingPrincipalPaisa / 100)),
        });

        // 2. Interest Certificate
        await this.generateAndLogDocument(orgId, loan.id, loan.customerId, TEMPLATE_CODES.INTEREST_CERTIFICATE, {
          customerName: loan.customer.fullName,
          loanNumber: loan.loanNumber,
          fy: fyLabel,
          interestPaid: String(Math.round(interestAmountPaisa / 100)),
          financialYear: `April ${year} to March ${year + 1}`,
          pan: loan.customer.panNumber ?? 'NOT_PROVIDED',
        });

        // 3. Outstanding confirmation
        await this.generateAndLogDocument(orgId, loan.id, loan.customerId, TEMPLATE_CODES.OUTSTANDING_CONFIRM, {
          customerName: loan.customer.fullName,
          loanNumber: loan.loanNumber,
          asOfDate: fyEnd.toISOString().slice(0, 10),
          outstandingPrincipal: String(Math.round(loan.outstandingPrincipalPaisa / 100)),
          outstandingInterest: String(Math.round((loan.outstandingInterestPaisa ?? 0) / 100)),
        });

        processedCount++;
        loanIds.push(loan.id);
      } catch (err) {
        this.logger.error(`Failed annual statement for loan ${loan.loanNumber}: ${(err as Error).message}`);
        failedCount++;
      }
    }

    return {
      organizationId: orgId,
      period: fyLabel,
      processedCount,
      failedCount,
      loanIds,
    };
  }

  /**
   * Rate Change Notice — when floating rate changes (e.g. MCLR / Repo rate reset).
   * RBI mandates 30-day advance notice for interest rate changes on floating rate loans.
   */
  async sendRateChangeNotice(
    orgId: string,
    loanId: string,
    newRateAnnual: number,
    effectiveDate: string,
    reason?: string,
  ): Promise<RateChangeResult> {
    this.logger.log(`Rate change notice for loan ${loanId}`);

    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: { customer: true },
    });

    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    const oldRate = loan.interestRateBps / 100; // convert BPS to percent

    await this.generateAndLogDocument(orgId, loanId, loan.customerId, TEMPLATE_CODES.RATE_CHANGE_NOTICE, {
      customerName: loan.customer.fullName,
      loanNumber: loan.loanNumber,
      oldRate: String(oldRate),
      newRate: String(newRateAnnual),
      effectiveDate,
      reason: reason ?? 'Benchmark rate revision',
      noticeDate: new Date().toISOString().slice(0, 10),
    });

    await this.prisma.notificationLog.create({
      data: {
        organizationId: orgId,
        customerId: loan.customerId,
        channel: 'EMAIL',
        templateCode: 'RATE_CHANGE_NOTICE',
        recipient: loan.customer.email ?? loan.customer.phone,
        content: `Rate change notice: ${oldRate}% → ${newRateAnnual}% effective ${effectiveDate}`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return {
      loanId,
      loanNumber: loan.loanNumber,
      oldRate,
      newRate: newRateAnnual,
      effectiveDate,
      notifiedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Generate and log a document using the DocumentTemplate system.
   * Renders the template with provided variables and saves to GeneratedDocument.
   */
  private async generateAndLogDocument(
    orgId: string,
    loanId: string,
    customerId: string,
    templateCode: string,
    variables: Record<string, string>,
  ): Promise<void> {
    // Resolve template
    const template = await this.prisma.documentTemplate.findFirst({
      where: { organizationId: orgId, templateCode },
    });

    let renderedContent: string;
    if (template) {
      // Render template by replacing {{variableName}} placeholders
      renderedContent = template.htmlContent.replace(
        /\{\{(\w+)\}\}/g,
        (match, key: string) => variables[key] ?? match,
      );
    } else {
      // Fallback: use plain text with variables
      renderedContent = Object.entries(variables)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      this.logger.warn(
        `Template ${templateCode} not found for org ${orgId}. Using fallback content.`,
      );
    }

    await this.prisma.generatedDocument.create({
      data: {
        organizationId: orgId,
        templateId: template?.id ?? null,
        entityType: 'LOAN',
        entityId: loanId,
        documentName: templateCode,
        variables: variables as any,
        sentToCustomer: false,
      },
    });
  }

  /**
   * Ensure communication templates exist in DocumentTemplate for an org.
   * Called at service startup or via admin API.
   */
  async seedCommunicationTemplates(orgId: string): Promise<object> {
    const templates = [
      {
        templateCode: TEMPLATE_CODES.WELCOME_LETTER,
        name: 'Welcome Letter',
        htmlContent: `<p>Dear {{customerName}},</p><p>Welcome to BankOS! Your loan {{loanNumber}} for Rs {{disbursedAmount}} has been disbursed.</p><p>Product: {{productName}} | Rate: {{interestRate}}% p.a. | Tenure: {{tenureMonths}} months | EMI: Rs {{emiAmount}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.REPAYMENT_SCHEDULE,
        name: 'Repayment Schedule',
        htmlContent: `<p>Dear {{customerName}},</p><p>Repayment Schedule for Loan {{loanNumber}}:</p><p>Total Installments: {{totalInstallments}} | First EMI: {{firstEmiDate}} | Last EMI: {{lastEmiDate}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.NACH_CONFIRMATION,
        name: 'NACH Mandate Confirmation',
        htmlContent: `<p>Dear {{customerName}},</p><p>Your NACH mandate for Loan {{loanNumber}} has been registered.</p><p>UMRN: {{umrn}} | Type: {{mandateType}} | Frequency: {{frequency}} | Max Amount: Rs {{emiAmount}} | Valid: {{startDate}} to {{endDate}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.INSURANCE_CERTIFICATE,
        name: 'Insurance Certificate',
        htmlContent: `<p>Dear {{customerName}},</p><p>Insurance Certificate for Loan {{loanNumber}}:</p><p>Type: {{policyType}} | Provider: {{providerName}} | Policy No: {{policyNumber}} | Sum Insured: Rs {{sumInsured}} | Valid: {{startDate}} to {{endDate}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.ANNUAL_SOA,
        name: 'Annual Statement of Account',
        htmlContent: `<p>Dear {{customerName}},</p><p>Statement of Account for FY {{fy}}</p><p>Loan: {{loanNumber}} | Outstanding Principal: Rs {{outstandingPrincipal}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.INTEREST_CERTIFICATE,
        name: 'Interest Certificate',
        htmlContent: `<p>Dear {{customerName}},</p><p>Interest Certificate for {{financialYear}}</p><p>Loan: {{loanNumber}} | PAN: {{pan}} | Total Interest Paid: Rs {{interestPaid}}</p><p>For Income Tax purposes under Section 24(b).</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.OUTSTANDING_CONFIRM,
        name: 'Outstanding Confirmation',
        htmlContent: `<p>Dear {{customerName}},</p><p>Outstanding Confirmation as of {{asOfDate}}</p><p>Loan: {{loanNumber}} | Principal: Rs {{outstandingPrincipal}} | Interest: Rs {{outstandingInterest}}</p>`,
      },
      {
        templateCode: TEMPLATE_CODES.RATE_CHANGE_NOTICE,
        name: 'Rate Change Notice',
        htmlContent: `<p>Dear {{customerName}},</p><p><strong>Interest Rate Change Notice</strong></p><p>Loan: {{loanNumber}} | Current Rate: {{oldRate}}% | Revised Rate: {{newRate}}% | Effective: {{effectiveDate}} | Reason: {{reason}}</p><p>Date: {{noticeDate}}</p>`,
      },
    ];

    const results = await Promise.allSettled(
      templates.map((t) =>
        this.prisma.documentTemplate.upsert({
          where: { organizationId_templateCode: { organizationId: orgId, templateCode: t.templateCode } },
          create: { organizationId: orgId, ...t, isActive: true, version: 1 },
          update: { htmlContent: t.htmlContent, name: t.name },
        }),
      ),
    );

    const seeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      organizationId: orgId,
      templatesSeeded: seeded,
      templatesFailed: failed,
      templates: templates.map((t) => t.templateCode),
    };
  }
}
