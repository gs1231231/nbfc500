import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MockTransaction {
  date: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  balance: number;
}

export interface BankStatements {
  consentId: string;
  accountNumber: string;
  bankName: string;
  transactions: MockTransaction[];
}

export interface StatementAnalysis {
  averageBalance: number;
  estimatedMonthlyIncome: number;
  regularEmiCount: number;
  bounceCount: number;
  salaryDetected: boolean;
  incomeStability: 'HIGH' | 'MEDIUM' | 'LOW';
  totalCredits: number;
  totalDebits: number;
  cashWithdrawals: number;
  monthsCovered: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AaService {
  private readonly logger = new Logger(AaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an AA consent request for a customer.
   * Mock: returns a deterministic consentId.
   */
  async createConsent(
    orgId: string,
    customerId: string,
  ): Promise<{ consentId: string; status: string; expiresAt: string }> {
    // Validate customer belongs to org
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const consentId = `CONSENT-${customerId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    this.logger.log(`AA consent created: ${consentId} for customer ${customerId}`);

    return {
      consentId,
      status: 'ACTIVE',
      expiresAt,
    };
  }

  /**
   * Fetch bank statements using an active consent.
   * Mock: returns 6 months of synthetic transactions.
   */
  async fetchStatements(
    orgId: string,
    consentId: string,
  ): Promise<BankStatements> {
    this.logger.log(`Fetching statements for consent ${consentId}, org ${orgId}`);

    const transactions = this.generateMockTransactions(6);

    return {
      consentId,
      accountNumber: 'XXXX-XXXX-4321',
      bankName: 'Mock Bank Ltd',
      transactions,
    };
  }

  /**
   * Analyze bank statements to extract financial insights.
   */
  analyzeStatements(statements: BankStatements): StatementAnalysis {
    const txns = statements.transactions;

    // Compute balance stats
    const balances = txns.map((t) => t.balance);
    const averageBalance =
      balances.length > 0
        ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length)
        : 0;

    // Total credits / debits
    const credits = txns.filter((t) => t.type === 'CREDIT');
    const debits = txns.filter((t) => t.type === 'DEBIT');
    const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
    const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

    // Salary detection: credit in range 20k–3L with keyword SALARY/PAYROLL
    const salaryTxns = credits.filter(
      (t) =>
        /salary|payroll|pay credit/i.test(t.description) &&
        t.amount >= 20000 &&
        t.amount <= 300000,
    );
    const salaryDetected = salaryTxns.length >= 3;

    // Monthly income estimate: average of top salary credits per month
    const monthSet = new Set(txns.map((t) => t.date.slice(0, 7)));
    const monthsCovered = monthSet.size || 1;
    const estimatedMonthlyIncome = salaryDetected
      ? Math.round(salaryTxns.reduce((s, t) => s + t.amount, 0) / salaryTxns.length)
      : Math.round(totalCredits / monthsCovered);

    // EMI debits: recurring debit with keyword EMI/LOAN/NACH
    const emiTxns = debits.filter((t) => /emi|loan|nach|repayment/i.test(t.description));
    const regularEmiCount = emiTxns.length;

    // Bounce count: debits with BOUNCE/RETURN keyword
    const bounceCount = debits.filter((t) => /bounce|return|dishonour/i.test(t.description))
      .length;

    // Cash withdrawals
    const cashWithdrawals = debits
      .filter((t) => /atm|cash withdrawal/i.test(t.description))
      .reduce((s, t) => s + t.amount, 0);

    // Income stability
    let incomeStability: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (salaryDetected && bounceCount === 0) {
      incomeStability = 'HIGH';
    } else if (salaryDetected || estimatedMonthlyIncome > 30000) {
      incomeStability = 'MEDIUM';
    }

    return {
      averageBalance,
      estimatedMonthlyIncome,
      regularEmiCount,
      bounceCount,
      salaryDetected,
      incomeStability,
      totalCredits,
      totalDebits,
      cashWithdrawals,
      monthsCovered,
    };
  }

  /**
   * Store AA analysis results in the application's customFields
   * so BRE rules can reference them via "aa.*" keys.
   */
  async feedToBre(
    orgId: string,
    applicationId: string,
    analysis: StatementAnalysis,
  ): Promise<{ applicationId: string; fieldsUpdated: string[] }> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const existing = (application.customFields as Record<string, unknown>) ?? {};

    const aaFields: Record<string, unknown> = {
      'aa.averageBalance': analysis.averageBalance,
      'aa.estimatedMonthlyIncome': analysis.estimatedMonthlyIncome,
      'aa.regularEmiCount': analysis.regularEmiCount,
      'aa.bounceCount': analysis.bounceCount,
      'aa.salaryDetected': analysis.salaryDetected,
      'aa.incomeStability': analysis.incomeStability,
      'aa.cashWithdrawals': analysis.cashWithdrawals,
      'aa.monthsCovered': analysis.monthsCovered,
    };

    await this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        customFields: { ...existing, ...aaFields } as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `AA analysis stored in customFields for application ${applicationId}`,
    );

    return {
      applicationId,
      fieldsUpdated: Object.keys(aaFields),
    };
  }

  /**
   * Retrieve the stored AA report from an application's customFields.
   */
  async getReport(
    orgId: string,
    applicationId: string,
  ): Promise<Record<string, unknown>> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const customFields = (application.customFields as Record<string, unknown>) ?? {};
    const aaReport: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(customFields)) {
      if (key.startsWith('aa.')) {
        aaReport[key] = value;
      }
    }

    return {
      applicationId,
      aaReport,
      hasData: Object.keys(aaReport).length > 0,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private generateMockTransactions(months: number): MockTransaction[] {
    const transactions: MockTransaction[] = [];
    const now = new Date();
    let balance = 50000;

    for (let m = months - 1; m >= 0; m--) {
      const year = now.getFullYear();
      const month = now.getMonth() - m;
      const baseDate = new Date(year, month, 1);

      // Salary credit around 1st-5th
      const salaryDay = Math.floor(Math.random() * 5) + 1;
      const salary = 45000 + Math.floor(Math.random() * 10000);
      balance += salary;
      transactions.push({
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), salaryDay)
          .toISOString()
          .slice(0, 10),
        amount: salary,
        type: 'CREDIT',
        description: 'SALARY CREDIT - EMPLOYER INC',
        balance,
      });

      // EMI debit around 5th
      const emiAmount = 12000;
      balance -= emiAmount;
      transactions.push({
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 5)
          .toISOString()
          .slice(0, 10),
        amount: emiAmount,
        type: 'DEBIT',
        description: 'EMI NACH - HOME LOAN XYZ BANK',
        balance,
      });

      // Utility / general debits (3–5 random)
      const numDebits = 3 + Math.floor(Math.random() * 3);
      for (let d = 0; d < numDebits; d++) {
        const amt = 500 + Math.floor(Math.random() * 5000);
        const day = 6 + Math.floor(Math.random() * 22);
        balance -= amt;
        transactions.push({
          date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day)
            .toISOString()
            .slice(0, 10),
          amount: amt,
          type: 'DEBIT',
          description: ['UPI DEBIT', 'ATM CASH WITHDRAWAL', 'BILL PAYMENT', 'ONLINE PURCHASE'][
            d % 4
          ],
          balance,
        });
      }

      // Small miscellaneous credit
      if (m % 2 === 0) {
        const misc = 1000 + Math.floor(Math.random() * 3000);
        balance += misc;
        transactions.push({
          date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 20)
            .toISOString()
            .slice(0, 10),
          amount: misc,
          type: 'CREDIT',
          description: 'TRANSFER RECEIVED',
          balance,
        });
      }
    }

    return transactions.sort((a, b) => a.date.localeCompare(b.date));
  }
}
