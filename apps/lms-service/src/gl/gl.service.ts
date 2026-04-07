import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Return types ──────────────────────────────────────────────────────────────

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface PnlLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
}

export interface ProfitAndLoss {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  lineItems: PnlLineItem[];
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  balance: number;
}

export interface BalanceSheet {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface ReconcileResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
}

// ── GL Service ────────────────────────────────────────────────────────────────

@Injectable()
export class GlService {
  private readonly logger = new Logger(GlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trial Balance: group all non-reversed GL entries by accountCode up to
   * asOfDate, sum debits and credits, compute running balance (debit - credit).
   *
   * @param orgId    - Organization UUID
   * @param asOfDate - Include all entries on or before this date
   */
  async getTrialBalance(orgId: string, asOfDate: Date): Promise<TrialBalanceLine[]> {
    this.logger.log(`Trial balance for org ${orgId} as of ${asOfDate.toISOString()}`);

    const entries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        entryDate: { lte: asOfDate },
        isReversed: false,
      },
      select: {
        accountCode: true,
        accountName: true,
        debitAmountPaisa: true,
        creditAmountPaisa: true,
      },
    });

    // Aggregate by accountCode
    const map = new Map<string, { accountName: string; totalDebit: number; totalCredit: number }>();

    for (const entry of entries) {
      const existing = map.get(entry.accountCode);
      if (existing) {
        existing.totalDebit += entry.debitAmountPaisa;
        existing.totalCredit += entry.creditAmountPaisa;
      } else {
        map.set(entry.accountCode, {
          accountName: entry.accountName,
          totalDebit: entry.debitAmountPaisa,
          totalCredit: entry.creditAmountPaisa,
        });
      }
    }

    return Array.from(map.entries())
      .map(([accountCode, data]) => ({
        accountCode,
        accountName: data.accountName,
        totalDebit: data.totalDebit,
        totalCredit: data.totalCredit,
        balance: data.totalDebit - data.totalCredit,
      }))
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  /**
   * Profit & Loss: sum Income accounts (3xxx) minus Expense accounts (4xxx, 5xxx)
   * for the given date range.
   *
   * Account code prefixes:
   *  - 3xxx → Income
   *  - 4xxx, 5xxx → Expenses
   *
   * @param orgId    - Organization UUID
   * @param fromDate - Period start (inclusive)
   * @param toDate   - Period end (inclusive)
   */
  async getProfitAndLoss(orgId: string, fromDate: Date, toDate: Date): Promise<ProfitAndLoss> {
    this.logger.log(`P&L for org ${orgId} from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    const entries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        entryDate: { gte: fromDate, lte: toDate },
        isReversed: false,
        OR: [
          { accountCode: { startsWith: '3' } },
          { accountCode: { startsWith: '4' } },
          { accountCode: { startsWith: '5' } },
        ],
      },
      select: {
        accountCode: true,
        accountName: true,
        debitAmountPaisa: true,
        creditAmountPaisa: true,
      },
    });

    // For income accounts (3xxx): credit side increases income
    // For expense accounts (4xxx, 5xxx): debit side increases expenses
    const lineMap = new Map<string, { accountName: string; debit: number; credit: number }>();

    for (const entry of entries) {
      const existing = lineMap.get(entry.accountCode);
      if (existing) {
        existing.debit += entry.debitAmountPaisa;
        existing.credit += entry.creditAmountPaisa;
      } else {
        lineMap.set(entry.accountCode, {
          accountName: entry.accountName,
          debit: entry.debitAmountPaisa,
          credit: entry.creditAmountPaisa,
        });
      }
    }

    const lineItems: PnlLineItem[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const [accountCode, data] of lineMap.entries()) {
      if (accountCode.startsWith('3')) {
        // Income: net = credit - debit
        const amount = data.credit - data.debit;
        totalIncome += amount;
        lineItems.push({ accountCode, accountName: data.accountName, amount, type: 'INCOME' });
      } else {
        // Expense (4xxx / 5xxx): net = debit - credit
        const amount = data.debit - data.credit;
        totalExpenses += amount;
        lineItems.push({ accountCode, accountName: data.accountName, amount, type: 'EXPENSE' });
      }
    }

    lineItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      lineItems,
    };
  }

  /**
   * Balance Sheet: Assets (1xxx, 2xxx) = Liabilities (6xxx) + Equity (7xxx, 8xxx, 9xxx).
   *
   * Account code prefixes:
   *  - 1xxx, 2xxx → Assets
   *  - 6xxx       → Liabilities
   *  - 7xxx+      → Equity
   *
   * @param orgId    - Organization UUID
   * @param asOfDate - Include all entries on or before this date
   */
  async getBalanceSheet(orgId: string, asOfDate: Date): Promise<BalanceSheet> {
    this.logger.log(`Balance sheet for org ${orgId} as of ${asOfDate.toISOString()}`);

    const entries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        entryDate: { lte: asOfDate },
        isReversed: false,
        OR: [
          { accountCode: { startsWith: '1' } },
          { accountCode: { startsWith: '2' } },
          { accountCode: { startsWith: '6' } },
          { accountCode: { startsWith: '7' } },
          { accountCode: { startsWith: '8' } },
          { accountCode: { startsWith: '9' } },
        ],
      },
      select: {
        accountCode: true,
        accountName: true,
        debitAmountPaisa: true,
        creditAmountPaisa: true,
      },
    });

    const lineMap = new Map<string, { accountName: string; debit: number; credit: number }>();

    for (const entry of entries) {
      const existing = lineMap.get(entry.accountCode);
      if (existing) {
        existing.debit += entry.debitAmountPaisa;
        existing.credit += entry.creditAmountPaisa;
      } else {
        lineMap.set(entry.accountCode, {
          accountName: entry.accountName,
          debit: entry.debitAmountPaisa,
          credit: entry.creditAmountPaisa,
        });
      }
    }

    const assets: BalanceSheetLine[] = [];
    const liabilities: BalanceSheetLine[] = [];
    const equity: BalanceSheetLine[] = [];

    for (const [accountCode, data] of lineMap.entries()) {
      if (accountCode.startsWith('1') || accountCode.startsWith('2')) {
        // Assets: debit-normal balance
        assets.push({ accountCode, accountName: data.accountName, balance: data.debit - data.credit });
      } else if (accountCode.startsWith('6')) {
        // Liabilities: credit-normal balance
        liabilities.push({ accountCode, accountName: data.accountName, balance: data.credit - data.debit });
      } else {
        // Equity (7xxx, 8xxx, 9xxx): credit-normal balance
        equity.push({ accountCode, accountName: data.accountName, balance: data.credit - data.debit });
      }
    }

    assets.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    liabilities.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    equity.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
  }

  /**
   * Reconciliation: verify that total debits equal total credits for a period.
   * Returns isBalanced = true when the difference is 0.
   *
   * @param orgId    - Organization UUID
   * @param fromDate - Period start (inclusive)
   * @param toDate   - Period end (inclusive)
   */
  async reconcile(orgId: string, fromDate: Date, toDate: Date): Promise<ReconcileResult> {
    this.logger.log(`Reconcile for org ${orgId} from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    const result = await this.prisma.glEntry.aggregate({
      where: {
        organizationId: orgId,
        entryDate: { gte: fromDate, lte: toDate },
        isReversed: false,
      },
      _sum: {
        debitAmountPaisa: true,
        creditAmountPaisa: true,
      },
    });

    const totalDebits = result._sum.debitAmountPaisa ?? 0;
    const totalCredits = result._sum.creditAmountPaisa ?? 0;
    const difference = totalDebits - totalCredits;

    return {
      isBalanced: difference === 0,
      totalDebits,
      totalCredits,
      difference,
    };
  }
}
