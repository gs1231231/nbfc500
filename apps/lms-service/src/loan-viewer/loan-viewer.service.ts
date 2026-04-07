import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';

export type LoanViewRole =
  | 'CREDIT_OFFICER'
  | 'OPS_OFFICER'
  | 'COLLECTION_AGENT'
  | 'ACCOUNTS_OFFICER'
  | 'MANAGEMENT'
  | 'CUSTOMER';

const VALID_ROLES: LoanViewRole[] = [
  'CREDIT_OFFICER',
  'OPS_OFFICER',
  'COLLECTION_AGENT',
  'ACCOUNTS_OFFICER',
  'MANAGEMENT',
  'CUSTOMER',
];

@Injectable()
export class LoanViewerService {
  private readonly logger = new Logger(LoanViewerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns role-appropriate loan data.
   *
   * CREDIT_OFFICER    : customer, bureau summary, CAM, BRE decision, deviations
   * OPS_OFFICER       : sanction letter, conditions, disbursement requests, documents, NACH status
   * COLLECTION_AGENT  : contacts, overdue details, DPD, payments, PTP history, call logs, visit logs, legal status
   * ACCOUNTS_OFFICER  : SOA, GL entries, schedule, payments, charges, accrual
   * MANAGEMENT        : everything + profitability (interest earned, fees, cost of funds, provision impact)
   * CUSTOMER          : schedule, payments, statements, certificates, overdue, next due date
   */
  async getLoanView(orgId: string, loanId: string, role: string) {
    if (!VALID_ROLES.includes(role as LoanViewRole)) {
      throw new ForbiddenException(
        `Invalid role '${role}'. Allowed: ${VALID_ROLES.join(', ')}`,
      );
    }

    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        customer: true,
        product: true,
        branch: true,
        application: {
          include: {
            breDecision: true,
            bureauRequests: {
              include: { bureauResponse: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            documents: true,
          },
        },
        schedules: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' }, take: 20 },
        collectionTasks: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    switch (role as LoanViewRole) {
      case 'CREDIT_OFFICER':
        return this.buildCreditOfficerView(orgId, loan);
      case 'OPS_OFFICER':
        return this.buildOpsOfficerView(orgId, loan);
      case 'COLLECTION_AGENT':
        return this.buildCollectionAgentView(orgId, loan);
      case 'ACCOUNTS_OFFICER':
        return this.buildAccountsOfficerView(orgId, loan);
      case 'MANAGEMENT':
        return this.buildManagementView(orgId, loan);
      case 'CUSTOMER':
        return this.buildCustomerView(loan);
      default:
        throw new ForbiddenException(`Unhandled role: ${role}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Role-specific view builders
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildCreditOfficerView(orgId: string, loan: any) {
    const bureauRequest = loan.application?.bureauRequests?.[0];
    const bureauResponse = bureauRequest?.bureauResponse;
    const breDecision = loan.application?.breDecision;

    const bureauSummary = bureauResponse
      ? {
          bureauType: bureauRequest.bureauType,
          score: bureauResponse.score,
          totalActiveLoans: bureauResponse.totalActiveLoans,
          totalEmiObligationPaisa: bureauResponse.totalEmiObligationPaisa,
          maxDpdLast12Months: bureauResponse.maxDpdLast12Months,
          hasWriteOff: bureauResponse.hasWriteOff,
          hasSettlement: bureauResponse.hasSettlement,
          enquiriesLast6Months: bureauResponse.enquiriesLast6Months,
          validUntil: bureauResponse.validUntil,
        }
      : null;

    const breInfo = breDecision
      ? {
          finalDecision: breDecision.finalDecision,
          approvedInterestRateBps: breDecision.approvedInterestRateBps,
          ruleResults: breDecision.ruleResults,
          overriddenBy: breDecision.overriddenBy,
          overrideReason: breDecision.overrideReason,
          decidedAt: breDecision.decidedAt,
        }
      : null;

    // CAM fields from application custom fields
    const camData = loan.application?.customFields ?? {};

    return {
      role: 'CREDIT_OFFICER',
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      customer: {
        id: loan.customer.id,
        customerNumber: loan.customer.customerNumber,
        fullName: loan.customer.fullName,
        dateOfBirth: loan.customer.dateOfBirth,
        gender: loan.customer.gender,
        panNumber: loan.customer.panNumber,
        employmentType: loan.customer.employmentType,
        employerName: loan.customer.employerName,
        monthlyIncomePaisa: loan.customer.monthlyIncomePaisa,
        kycStatus: loan.customer.kycStatus,
        riskCategory: loan.customer.riskCategory,
      },
      bureauSummary,
      cam: camData,
      breDecision: breInfo,
      applicationStatus: loan.application?.status,
      sanctionedAmountPaisa: loan.application?.sanctionedAmountPaisa,
      sanctionedInterestRateBps: loan.application?.sanctionedInterestRateBps,
      deviations: loan.application?.customFields?.deviations ?? [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildOpsOfficerView(orgId: string, loan: any) {
    // Fetch documents for the loan
    const documents = await this.prisma.document.findMany({
      where: { loanId: loan.id, organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    const applicationDocuments = loan.application?.documents ?? [];

    // NACH mandate info (GL-based fallback)
    const nachEntries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        referenceType: 'NACH_MANDATE',
      },
      orderBy: { entryDate: 'desc' },
      take: 5,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    let nachMandate: unknown = null;
    if (prismaAny.nachMandate) {
      try {
        nachMandate = await prismaAny.nachMandate.findFirst({
          where: { loanId: loan.id, organizationId: orgId },
        });
      } catch {
        // model not migrated yet
      }
    }

    if (!nachMandate && nachEntries.length > 0) {
      try {
        nachMandate = {
          mandateId: nachEntries[0].referenceId,
          ...JSON.parse(nachEntries[0].narration || '{}'),
          createdAt: nachEntries[0].createdAt,
        };
      } catch {
        nachMandate = { referenceId: nachEntries[0].referenceId };
      }
    }

    return {
      role: 'OPS_OFFICER',
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      loanStatus: loan.loanStatus,
      disbursedAmountPaisa: loan.disbursedAmountPaisa,
      disbursementDate: loan.disbursementDate,
      maturityDate: loan.maturityDate,
      sanctionConditions: loan.application?.customFields?.conditions ?? [],
      sanctionLetterRef: loan.application?.customFields?.sanctionLetterRef ?? null,
      disbursementRequest: loan.application?.customFields?.disbursementRequest ?? null,
      documents: [
        ...documents.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          fileName: d.fileName,
          isVerified: d.isVerified,
          verifiedAt: d.verifiedAt,
        })),
        ...applicationDocuments
          .filter((ad: { id: string }) => !documents.find((d) => d.id === ad.id))
          .map((ad: { id: string; documentType: string; fileName: string; isVerified: boolean; verifiedAt: Date | null }) => ({
            id: ad.id,
            documentType: ad.documentType,
            fileName: ad.fileName,
            isVerified: ad.isVerified,
            verifiedAt: ad.verifiedAt,
          })),
      ],
      nachStatus: nachMandate,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildCollectionAgentView(orgId: string, loan: any) {
    // PTP history from collection tasks
    const ptpTasks = loan.collectionTasks.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t.disposition === 'PTP',
    );

    // Call logs (GL fallback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    let callLogs: unknown[] = [];
    let visitLogs: unknown[] = [];

    if (prismaAny.collectionCallLog) {
      try {
        callLogs = await prismaAny.collectionCallLog.findMany({
          where: { loanId: loan.id, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
      } catch { /* not migrated */ }
    }

    if (!callLogs.length) {
      const glCalls = await this.prisma.glEntry.findMany({
        where: { organizationId: orgId, referenceType: 'CALL_LOG', narration: { contains: loan.id } },
        orderBy: { entryDate: 'desc' },
        take: 10,
      });
      callLogs = glCalls.map((g) => {
        try { return { callId: g.referenceId, ...JSON.parse(g.narration), createdAt: g.createdAt }; }
        catch { return { callId: g.referenceId, createdAt: g.createdAt }; }
      });
    }

    if (prismaAny.fieldVisitLog) {
      try {
        visitLogs = await prismaAny.fieldVisitLog.findMany({
          where: { loanId: loan.id, organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
      } catch { /* not migrated */ }
    }

    if (!visitLogs.length) {
      const glVisits = await this.prisma.glEntry.findMany({
        where: { organizationId: orgId, referenceType: 'VISIT_LOG', narration: { contains: loan.id } },
        orderBy: { entryDate: 'desc' },
        take: 10,
      });
      visitLogs = glVisits.map((g) => {
        try { return { visitId: g.referenceId, ...JSON.parse(g.narration), createdAt: g.createdAt }; }
        catch { return { visitId: g.referenceId, createdAt: g.createdAt }; }
      });
    }

    // Legal status from GL entries
    const legalEntries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: { in: ['LEGAL_NOTICE', 'LEGAL_ACTION'] } },
      orderBy: { entryDate: 'desc' },
      take: 5,
    });

    // Next due date
    const nextDue = loan.schedules.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.status === 'PENDING' || s.status === 'OVERDUE',
    );

    return {
      role: 'COLLECTION_AGENT',
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      contacts: {
        primaryPhone: loan.customer.phone,
        alternatePhone: loan.customer.alternatePhone,
        email: loan.customer.email,
        currentAddress: [
          loan.customer.currentAddressLine1,
          loan.customer.currentAddressLine2,
          loan.customer.currentCity,
          loan.customer.currentState,
          loan.customer.currentPincode,
        ]
          .filter(Boolean)
          .join(', '),
      },
      overdueDetails: {
        totalOverduePaisa: loan.totalOverduePaisa,
        dpd: loan.dpd,
        npaClassification: loan.npaClassification,
        nextDueDate: nextDue?.dueDate ?? null,
        nextDueAmountPaisa: nextDue?.emiAmountPaisa ?? null,
      },
      recentPayments: loan.payments.slice(0, 5).map((p: {
        id: string;
        amountPaisa: number;
        paymentDate: Date;
        paymentMode: string;
        status: string;
        referenceNumber: string | null;
      }) => ({
        id: p.id,
        amountPaisa: p.amountPaisa,
        paymentDate: p.paymentDate,
        paymentMode: p.paymentMode,
        status: p.status,
        referenceNumber: p.referenceNumber,
      })),
      ptpHistory: ptpTasks.map((t: {
        id: string;
        ptpDate: Date | null;
        ptpAmountPaisa: number | null;
        disposition: string | null;
        remarks: string | null;
        scheduledDate: Date;
      }) => ({
        taskId: t.id,
        ptpDate: t.ptpDate,
        ptpAmountPaisa: t.ptpAmountPaisa,
        disposition: t.disposition,
        remarks: t.remarks,
        scheduledDate: t.scheduledDate,
      })),
      collectionTasks: loan.collectionTasks.slice(0, 5),
      callLogs,
      visitLogs,
      legalStatus: {
        hasActiveLegalAction: legalEntries.length > 0,
        entries: legalEntries.map((e) => ({ referenceId: e.referenceId, date: e.entryDate, narration: e.narration })),
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildAccountsOfficerView(orgId: string, loan: any) {
    // GL entries for this loan
    const glEntries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: { in: ['EMI_PAYMENT', 'DISBURSEMENT', 'LOAN_CHARGE', 'ACCRUAL'] } },
      orderBy: { entryDate: 'desc' },
      take: 50,
    });

    // Loan charge entries (GL fallback)
    const chargeEntries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: 'LOAN_CHARGE', narration: { contains: loan.id } },
      orderBy: { entryDate: 'desc' },
    });

    // SOA: Statement of Account
    const soa = loan.schedules.map((s: {
      installmentNumber: number;
      dueDate: Date;
      emiAmountPaisa: number;
      principalComponentPaisa: number;
      interestComponentPaisa: number;
      paidAmountPaisa: number;
      paidPrincipalPaisa: number;
      paidInterestPaisa: number;
      penalInterestPaisa: number;
      status: string;
      paidDate: Date | null;
    }) => ({
      installmentNumber: s.installmentNumber,
      dueDate: s.dueDate,
      emiAmountPaisa: s.emiAmountPaisa,
      principalPaisa: s.principalComponentPaisa,
      interestPaisa: s.interestComponentPaisa,
      paidAmountPaisa: s.paidAmountPaisa,
      paidPrincipalPaisa: s.paidPrincipalPaisa,
      paidInterestPaisa: s.paidInterestPaisa,
      penalInterestPaisa: s.penalInterestPaisa,
      status: s.status,
      paidDate: s.paidDate,
    }));

    return {
      role: 'ACCOUNTS_OFFICER',
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
      outstandingInterestPaisa: loan.outstandingInterestPaisa,
      totalOverduePaisa: loan.totalOverduePaisa,
      statementOfAccount: soa,
      glEntries: glEntries.slice(0, 30),
      schedule: loan.schedules,
      payments: loan.payments,
      chargeEntries: chargeEntries.map((c) => {
        try {
          return { chargeId: c.referenceId, ...JSON.parse(c.narration), entryDate: c.entryDate };
        } catch {
          return { chargeId: c.referenceId, narration: c.narration, entryDate: c.entryDate };
        }
      }),
      accrualSummary: {
        totalInterestPaisa: loan.totalInterestPaisa,
        outstandingInterestPaisa: loan.outstandingInterestPaisa,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildManagementView(orgId: string, loan: any) {
    const [creditView, opsView, collectionView, accountsView] = await Promise.all([
      this.buildCreditOfficerView(orgId, loan),
      this.buildOpsOfficerView(orgId, loan),
      this.buildCollectionAgentView(orgId, loan),
      this.buildAccountsOfficerView(orgId, loan),
    ]);

    // Profitability metrics
    const totalPaid = loan.payments
      .filter((p: { status: string }) => p.status === 'SUCCESS')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((sum: number, p: any) => sum + p.amountPaisa, 0);

    const totalInterestEarned = loan.payments
      .filter((p: { status: string }) => p.status === 'SUCCESS')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((sum: number, p: any) => sum + p.allocatedToInterestPaisa, 0);

    const totalPenalCollected = loan.payments
      .filter((p: { status: string }) => p.status === 'SUCCESS')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((sum: number, p: any) => sum + p.allocatedToPenalPaisa, 0);

    // Fees collected from GL
    const feeEntries = await this.prisma.glEntry.aggregate({
      where: { organizationId: orgId, referenceType: 'LOAN_CHARGE', narration: { contains: loan.id } },
      _sum: { creditAmountPaisa: true },
    });

    const feesCollectedPaisa = feeEntries._sum.creditAmountPaisa ?? 0;

    // Cost of funds approximation (co-lending share)
    const coLending = loan.coLendingAllocation;
    const costOfFundsPaisa = coLending
      ? Math.round(
          (Number(coLending.bankSharePaisa) * coLending.blendedInterestRateBps) / 10000 / 12,
        )
      : 0;

    // Provision from NPA classification
    const provisionRates: Record<string, number> = {
      STANDARD: 0.004,
      SMA_0: 0.004,
      SMA_1: 0.004,
      SMA_2: 0.004,
      NPA_SUBSTANDARD: 0.15,
      NPA_DOUBTFUL_1: 0.25,
      NPA_DOUBTFUL_2: 0.4,
      NPA_DOUBTFUL_3: 1.0,
      NPA_LOSS: 1.0,
    };
    const provisionRate = provisionRates[loan.npaClassification] ?? 0.004;
    const provisionImpactPaisa = Math.round(loan.outstandingPrincipalPaisa * provisionRate);

    return {
      ...creditView,
      ...opsView,
      ...collectionView,
      ...accountsView,
      role: 'MANAGEMENT',
      profitability: {
        totalPaidPaisa: totalPaid,
        interestEarnedPaisa: totalInterestEarned,
        feesCollectedPaisa,
        penalCollectedPaisa: totalPenalCollected,
        estimatedCostOfFundsPaisa: costOfFundsPaisa,
        provisionImpactPaisa,
        netRevenuePaisa: totalInterestEarned + feesCollectedPaisa - costOfFundsPaisa,
      },
      coLendingDetails: coLending
        ? {
            bankSharePaisa: coLending.bankSharePaisa?.toString(),
            nbfcSharePaisa: coLending.nbfcSharePaisa?.toString(),
            blendedRateBps: coLending.blendedInterestRateBps,
            status: coLending.status,
          }
        : null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildCustomerView(loan: any) {
    // Next due installment
    const nextDue = loan.schedules.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.status === 'PENDING' || s.status === 'OVERDUE',
    );

    // Recent payments
    const recentPayments = loan.payments.slice(0, 10).map((p: {
      id: string;
      paymentNumber: string;
      amountPaisa: number;
      paymentDate: Date;
      paymentMode: string;
      status: string;
      referenceNumber: string | null;
    }) => ({
      paymentNumber: p.paymentNumber,
      amountPaisa: p.amountPaisa,
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      status: p.status,
      referenceNumber: p.referenceNumber,
    }));

    const totalPaid = loan.payments
      .filter((p: { status: string }) => p.status === 'SUCCESS')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((sum: number, p: any) => sum + p.amountPaisa, 0);

    return {
      role: 'CUSTOMER',
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      loanStatus: loan.loanStatus,
      disbursedAmountPaisa: loan.disbursedAmountPaisa,
      disbursementDate: loan.disbursementDate,
      tenureMonths: loan.tenureMonths,
      maturityDate: loan.maturityDate,
      emiAmountPaisa: loan.emiAmountPaisa,
      outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
      totalOverduePaisa: loan.totalOverduePaisa,
      nextDueDate: nextDue?.dueDate ?? null,
      nextDueAmountPaisa: nextDue?.emiAmountPaisa ?? null,
      schedule: loan.schedules.map((s: {
        installmentNumber: number;
        dueDate: Date;
        emiAmountPaisa: number;
        status: string;
        paidAmountPaisa: number;
        paidDate: Date | null;
      }) => ({
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        emiAmountPaisa: s.emiAmountPaisa,
        status: s.status,
        paidAmountPaisa: s.paidAmountPaisa,
        paidDate: s.paidDate,
      })),
      payments: recentPayments,
      totalAmountPaidPaisa: totalPaid,
      statements: {
        outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
        outstandingInterestPaisa: loan.outstandingInterestPaisa,
        totalAmountPaidPaisa: totalPaid,
      },
      certificates: {
        noc: loan.loanStatus === 'CLOSED' || loan.loanStatus === 'FORECLOSED',
        interestCertificateAvailable: true,
      },
    };
  }
}
