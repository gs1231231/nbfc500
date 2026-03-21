/**
 * Prompt 34 - NACH/eNACH Mandate Adapter
 * National Automated Clearing House mandate management.
 * Covers both physical NACH and eNACH (Aadhaar/Debit-card based).
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NachFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'AS_AND_WHEN_PRESENTED';

export type NachMandateType = 'CREATE' | 'MODIFY' | 'CANCEL' | 'PAUSE';

export interface BankAccountDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CASH_CREDIT' | 'OVERDRAFT';
  bankName: string;
  micr?: string;
}

export interface CreateMandateRequest {
  customerId: string;
  loanId?: string; // optional, for reference
  bankAccount: BankAccountDetails;
  /** Maximum amount per debit instruction in paisa */
  maxAmountPaisa: number;
  frequency: NachFrequency;
  /** Mandate start date */
  startDate: string; // YYYY-MM-DD
  /** Mandate end date - typically loan maturity date */
  endDate: string; // YYYY-MM-DD
  /** Purpose of the mandate */
  utilityCode?: string; // NACH utility code assigned by NPCI
  referenceNumber: string; // lender's own reference
  mandateType?: 'NACH' | 'E_NACH_AADHAAR' | 'E_NACH_DEBIT_CARD';
}

export interface MandateResponse {
  mandateId: string;
  referenceNumber: string;
  status: MandateStatus;
  message: string;
  createdAt: string;
  /** URL to redirect user for eNACH authentication (eNACH only) */
  authUrl?: string;
  /** NPCI-assigned UMRN once mandate is registered */
  umrn?: string;
}

export type MandateStatus =
  | 'INITIATED'
  | 'PENDING_BANK_APPROVAL'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAUSED'
  | 'EXPIRED';

export interface MandateStatusResponse {
  mandateId: string;
  umrn?: string;
  status: MandateStatus;
  rejectionReason?: string;
  lastUpdatedAt: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface INachMandateAdapter {
  /**
   * Register a new NACH/eNACH mandate.
   * For eNACH, returns authUrl for browser redirect.
   */
  createMandate(request: CreateMandateRequest): Promise<MandateResponse>;

  /**
   * Cancel an active mandate with reason.
   */
  cancelMandate(mandateId: string, reason?: string): Promise<MandateStatusResponse>;

  /**
   * Poll mandate status from NPCI / bank.
   */
  checkStatus(mandateId: string): Promise<MandateStatusResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockNachMandateAdapter implements INachMandateAdapter {
  private readonly mandates = new Map<string, MandateStatusResponse>();

  async createMandate(request: CreateMandateRequest): Promise<MandateResponse> {
    const mandateId = `NACH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const umrn = `UMRN${Date.now()}`;

    const statusRecord: MandateStatusResponse = {
      mandateId,
      umrn,
      status: 'ACTIVE',
      lastUpdatedAt: new Date().toISOString(),
    };
    this.mandates.set(mandateId, statusRecord);

    console.log(`[MockNachMandate] Mandate created | mandateId: ${mandateId} | customerId: ${request.customerId} | amount: ₹${(request.maxAmountPaisa / 100).toFixed(2)}`);

    return {
      mandateId,
      referenceNumber: request.referenceNumber,
      status: 'ACTIVE',
      umrn,
      message: 'NACH mandate created and activated successfully',
      createdAt: new Date().toISOString(),
    };
  }

  async cancelMandate(mandateId: string, reason?: string): Promise<MandateStatusResponse> {
    const existing = this.mandates.get(mandateId);
    const updated: MandateStatusResponse = {
      mandateId,
      umrn: existing?.umrn,
      status: 'CANCELLED',
      rejectionReason: reason,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.mandates.set(mandateId, updated);
    console.log(`[MockNachMandate] Mandate cancelled | mandateId: ${mandateId} | reason: ${reason ?? 'N/A'}`);
    return updated;
  }

  async checkStatus(mandateId: string): Promise<MandateStatusResponse> {
    const record = this.mandates.get(mandateId);
    if (!record) {
      return {
        mandateId,
        status: 'INITIATED',
        rejectionReason: 'Mandate not found in mock store',
        lastUpdatedAt: new Date().toISOString(),
      };
    }
    return record;
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealNachMandateAdapter implements INachMandateAdapter {
  async createMandate(_request: CreateMandateRequest): Promise<MandateResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealNachMandateAdapter requires NPCI/bank NACH API credentials. ' +
        'Set NACH_UTILITY_CODE, NACH_SPONSOR_BANK_IFSC, and NACH_ADAPTER=real.',
    );
  }
  async cancelMandate(_mandateId: string, _reason?: string): Promise<MandateStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealNachMandateAdapter.cancelMandate()');
  }
  async checkStatus(_mandateId: string): Promise<MandateStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealNachMandateAdapter.checkStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createNachMandateAdapter(): INachMandateAdapter {
  if (process.env.NACH_ADAPTER === 'real') {
    return new RealNachMandateAdapter();
  }
  return new MockNachMandateAdapter();
}
