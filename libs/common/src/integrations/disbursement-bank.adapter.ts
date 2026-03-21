/**
 * Prompt 35 - Disbursement Bank Adapter
 * NEFT/IMPS fund transfer for loan disbursements.
 * Mock returns success immediately; real adapter integrates with partner bank API.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TransferMode = 'NEFT' | 'IMPS' | 'RTGS' | 'UPI';

export type TransferStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'CREDITED'
  | 'FAILED'
  | 'RETURNED'
  | 'REVERSED';

export interface BeneficiaryAccount {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CASH_CREDIT';
  bankName?: string;
}

export interface InitiateTransferRequest {
  /** Lender's internal transaction reference */
  transactionRef: string;
  /** Loan ID for traceability */
  loanId: string;
  beneficiaryAccount: BeneficiaryAccount;
  /** Transfer amount in paisa */
  amountPaisa: number;
  mode: TransferMode;
  /** Payment narration - appears on beneficiary statement */
  narration: string;
  /** Scheduled date for NEFT batches; immediate for IMPS */
  scheduledDate?: string; // YYYY-MM-DD
  /** Optional remarks for internal records */
  remarks?: string;
}

export interface TransferResponse {
  /** Bank-assigned transaction ID */
  transactionId: string;
  transactionRef: string;
  status: TransferStatus;
  /** Bank UTR (Unique Transaction Reference) once settled */
  utr?: string;
  message: string;
  initiatedAt: string;
  /** Estimated credit time */
  expectedCreditAt?: string;
}

export interface TransferStatusResponse {
  transactionId: string;
  transactionRef?: string;
  status: TransferStatus;
  utr?: string;
  /** Failure reason from RBI/bank */
  failureReason?: string;
  /** Timestamp of last status update */
  lastUpdatedAt: string;
  /** Credit confirmation timestamp */
  creditedAt?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IDisbursementBankAdapter {
  /**
   * Initiate a NEFT/IMPS transfer to the borrower's account.
   * IMPS is near-instant; NEFT is batch-settled.
   */
  initiateTransfer(request: InitiateTransferRequest): Promise<TransferResponse>;

  /**
   * Poll the status of a previously initiated transfer.
   */
  checkStatus(transactionId: string): Promise<TransferStatusResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockDisbursementBankAdapter implements IDisbursementBankAdapter {
  private readonly transactions = new Map<string, TransferStatusResponse>();

  async initiateTransfer(request: InitiateTransferRequest): Promise<TransferResponse> {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const utr = `UTR${Date.now()}`;

    const statusRecord: TransferStatusResponse = {
      transactionId,
      transactionRef: request.transactionRef,
      status: 'CREDITED',
      utr,
      lastUpdatedAt: new Date().toISOString(),
      creditedAt: new Date().toISOString(),
    };
    this.transactions.set(transactionId, statusRecord);

    console.log(
      `[MockDisbursement] Transfer initiated | txnId: ${transactionId} | ` +
        `loan: ${request.loanId} | amount: ₹${(request.amountPaisa / 100).toFixed(2)} | ` +
        `mode: ${request.mode} | to: ${request.beneficiaryAccount.accountNumber}`,
    );

    return {
      transactionId,
      transactionRef: request.transactionRef,
      status: 'CREDITED',
      utr,
      message: `${request.mode} transfer initiated and credited successfully`,
      initiatedAt: new Date().toISOString(),
      expectedCreditAt: new Date().toISOString(),
    };
  }

  async checkStatus(transactionId: string): Promise<TransferStatusResponse> {
    const record = this.transactions.get(transactionId);
    if (!record) {
      return {
        transactionId,
        status: 'PENDING',
        lastUpdatedAt: new Date().toISOString(),
      };
    }
    return record;
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealDisbursementBankAdapter implements IDisbursementBankAdapter {
  async initiateTransfer(_request: InitiateTransferRequest): Promise<TransferResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealDisbursementBankAdapter requires bank API credentials. ' +
        'Set BANK_API_BASE_URL, BANK_API_KEY, BANK_ACCOUNT_NUMBER, and DISBURSEMENT_ADAPTER=real.',
    );
  }
  async checkStatus(_transactionId: string): Promise<TransferStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealDisbursementBankAdapter.checkStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createDisbursementBankAdapter(): IDisbursementBankAdapter {
  if (process.env.DISBURSEMENT_ADAPTER === 'real') {
    return new RealDisbursementBankAdapter();
  }
  return new MockDisbursementBankAdapter();
}
