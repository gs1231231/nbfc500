/**
 * Prompt 41 - Account Aggregator Adapter
 * RBI Account Aggregator framework - Finvu / OneMoney / Perfios.
 * Enables consent-based access to bank statements for underwriting.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConsentStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REVOKED'
  | 'EXPIRED';

export type FIType =
  | 'DEPOSIT'          // Savings / Current / FD / RD
  | 'TERM_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'MUTUAL_FUNDS'
  | 'INSURANCE_POLICIES'
  | 'EQUITIES'
  | 'BONDS'
  | 'DEBENTURES'
  | 'ETF'
  | 'GST_GSTR1_3B';

export interface ConsentRequest {
  customerId: string;
  /** Customer's AA handle, e.g. customer@finvu */
  aaHandle?: string;
  purpose: {
    code: string; // e.g. "101" for personal finance
    text: string;
    category: { type: string };
    fulfillment: string;
  };
  fiTypes: FIType[];
  /** Data fetch date range */
  dataRange: {
    from: string; // ISO date
    to: string;
  };
  /** Consent validity */
  consentExpiry: string; // ISO date
  /** Data fetch frequency */
  frequency: {
    unit: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';
    value: number;
  };
}

export interface ConsentResponse {
  consentId: string;
  customerId: string;
  status: ConsentStatus;
  /** URL to redirect customer to consent manager */
  consentUrl?: string;
  consentHandle: string;
  createdAt: string;
  expiresAt: string;
  message: string;
}

export interface FIDataRequest {
  consentId: string;
  sessionId?: string; // for resuming data fetches
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface BankTransaction {
  txnId: string;
  type: 'CREDIT' | 'DEBIT';
  mode: 'NEFT' | 'RTGS' | 'UPI' | 'ATM' | 'CASH' | 'CHEQUE' | 'OTHER';
  amountPaisa: number;
  currentBalancePaisa: number;
  transactionTimestamp: string;
  valueDate: string;
  narration: string;
  reference: string;
  category?: string; // AI-categorized
}

export interface BankAccount {
  fipId: string; // Financial Information Provider ID
  accountType: string;
  maskedAccountNumber: string;
  ifsc: string;
  name: string; // account holder name
  linkedPhone?: string;
}

export interface BankStatement {
  account: BankAccount;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
  statementStartDate: string;
  statementEndDate: string;
  transactions: BankTransaction[];
  /** Derived analytics */
  analytics?: {
    avgMonthlyCredit: number;
    avgMonthlyDebit: number;
    salaryCredits: BankTransaction[];
    emiDebits: BankTransaction[];
    cashWithdrawals: number;
    bouncedCheques: number;
  };
}

export interface FIDataResponse {
  consentId: string;
  sessionId: string;
  status: 'READY' | 'PARTIAL' | 'PENDING' | 'FAILED';
  statements: BankStatement[];
  fetchedAt: string;
  message: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IAccountAggregatorAdapter {
  /**
   * Initiate consent creation for a customer.
   * Customer must approve via AA app / URL.
   */
  createConsent(request: ConsentRequest): Promise<ConsentResponse>;

  /**
   * Check consent status after customer action.
   */
  getConsentStatus(consentId: string): Promise<ConsentResponse>;

  /**
   * Fetch financial statements once consent is ACTIVE.
   */
  fetchStatements(consentId: string, dateRange?: { from: string; to: string }): Promise<FIDataResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockAccountAggregatorAdapter implements IAccountAggregatorAdapter {
  private readonly consents = new Map<string, ConsentResponse>();

  async createConsent(request: ConsentRequest): Promise<ConsentResponse> {
    const consentId = `CONSENT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const consentHandle = `handle-${consentId}`;
    const response: ConsentResponse = {
      consentId,
      customerId: request.customerId,
      status: 'ACTIVE', // auto-approve in mock
      consentHandle,
      consentUrl: `https://finvu.mock.aa.in/consent?id=${consentId}`,
      createdAt: new Date().toISOString(),
      expiresAt: request.consentExpiry,
      message: 'Consent created and auto-approved (mock)',
    };
    this.consents.set(consentId, response);
    console.log(`[MockAccountAggregator] Consent created | consentId: ${consentId} | customerId: ${request.customerId}`);
    return response;
  }

  async getConsentStatus(consentId: string): Promise<ConsentResponse> {
    return (
      this.consents.get(consentId) ?? {
        consentId,
        customerId: '',
        status: 'PENDING',
        consentHandle: '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        message: 'Consent not found',
      }
    );
  }

  async fetchStatements(consentId: string, _dateRange?: { from: string; to: string }): Promise<FIDataResponse> {
    const mockTransactions: BankTransaction[] = Array.from({ length: 6 }, (_, i) => ({
      txnId: `TXN-MOCK-${i + 1}`,
      type: i % 3 === 0 ? 'CREDIT' : 'DEBIT',
      mode: i % 2 === 0 ? 'NEFT' : 'UPI',
      amountPaisa: (i + 1) * 1500000, // 15k, 30k, ...
      currentBalancePaisa: 20000000 - i * 1000000,
      transactionTimestamp: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
      valueDate: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      narration: i % 3 === 0 ? 'SALARY CREDIT' : 'EMI PAYMENT',
      reference: `REF${i + 1}`,
    }));

    const statement: BankStatement = {
      account: {
        fipId: 'HDFC-FIP',
        accountType: 'SAVINGS',
        maskedAccountNumber: 'XXXX XXXX 4321',
        ifsc: 'HDFC0001234',
        name: 'RAMESH KUMAR SHARMA',
      },
      openingBalancePaisa: 20000000,
      closingBalancePaisa: 18000000,
      statementStartDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      statementEndDate: new Date().toISOString().split('T')[0],
      transactions: mockTransactions,
      analytics: {
        avgMonthlyCredit: 5000000,
        avgMonthlyDebit: 3500000,
        salaryCredits: mockTransactions.filter((t) => t.narration.includes('SALARY')),
        emiDebits: mockTransactions.filter((t) => t.narration.includes('EMI')),
        cashWithdrawals: 2,
        bouncedCheques: 0,
      },
    };

    console.log(`[MockAccountAggregator] Statements fetched | consentId: ${consentId} | txns: ${mockTransactions.length}`);

    return {
      consentId,
      sessionId: `SESSION-${Date.now()}`,
      status: 'READY',
      statements: [statement],
      fetchedAt: new Date().toISOString(),
      message: 'Statements fetched successfully (mock)',
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealAccountAggregatorAdapter implements IAccountAggregatorAdapter {
  async createConsent(_request: ConsentRequest): Promise<ConsentResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealAccountAggregatorAdapter requires Finvu/OneMoney FIU credentials. ' +
        'Set AA_FIU_ID, AA_API_KEY, AA_GATEWAY_URL, and AA_ADAPTER=real.',
    );
  }
  async getConsentStatus(_consentId: string): Promise<ConsentResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAccountAggregatorAdapter.getConsentStatus()');
  }
  async fetchStatements(_consentId: string, _dateRange?: { from: string; to: string }): Promise<FIDataResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAccountAggregatorAdapter.fetchStatements()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createAccountAggregatorAdapter(): IAccountAggregatorAdapter {
  if (process.env.AA_ADAPTER === 'real') {
    return new RealAccountAggregatorAdapter();
  }
  return new MockAccountAggregatorAdapter();
}
