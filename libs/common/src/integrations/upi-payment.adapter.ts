/**
 * Prompt 36 - UPI Payment Adapter
 * Generate UPI payment links and QR codes for EMI collection.
 * Supports BharatPe, Razorpay, PayU style link generation.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateUpiLinkRequest {
  /** Merchant/lender VPA (e.g. nbfc@ybl) */
  merchantVpa: string;
  /** Amount in paisa */
  amountPaisa: number;
  /** Transaction note shown to payer */
  txnNote: string;
  /** Lender's internal reference */
  transactionRef: string;
  /** Payer's name (optional hint) */
  payerName?: string;
  /** Optional expiry in minutes (default: 30) */
  expiryMinutes?: number;
}

export interface UpiPaymentLink {
  /** Raw UPI deep link: upi://pay?... */
  upiUrl: string;
  /** Short URL via PSP link shortener */
  shortUrl?: string;
  /** Base64 encoded PNG QR code */
  qrCodeBase64?: string;
  transactionRef: string;
  amountPaisa: number;
  expiresAt: string;
}

export type UpiPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

export interface UpiPaymentStatusResponse {
  transactionRef: string;
  /** PSP / bank-assigned transaction ID */
  rrn?: string; // RRN - Retrieval Reference Number
  status: UpiPaymentStatus;
  paidAmountPaisa?: number;
  payerVpa?: string;
  paidAt?: string;
  failureReason?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IUpiPaymentAdapter {
  /**
   * Generate a UPI payment link for EMI or overdue collection.
   */
  generateLink(request: GenerateUpiLinkRequest): Promise<UpiPaymentLink>;

  /**
   * Check payment status by transaction reference.
   */
  checkPaymentStatus(transactionRef: string): Promise<UpiPaymentStatusResponse>;
}

// ─── UPI URL Builder Utility ───────────────────────────────────────────────────

function buildUpiUrl(params: {
  pa: string;  // payee VPA
  pn: string;  // payee name
  am: string;  // amount in rupees
  tn: string;  // transaction note
  tr: string;  // transaction reference
  cu?: string; // currency (default INR)
}): string {
  const base = 'upi://pay';
  const query = new URLSearchParams({
    pa: params.pa,
    pn: params.pn,
    am: params.am,
    tn: params.tn,
    tr: params.tr,
    cu: params.cu ?? 'INR',
  });
  return `${base}?${query.toString()}`;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockUpiPaymentAdapter implements IUpiPaymentAdapter {
  private readonly payments = new Map<string, UpiPaymentStatusResponse>();

  async generateLink(request: GenerateUpiLinkRequest): Promise<UpiPaymentLink> {
    const amountRupees = (request.amountPaisa / 100).toFixed(2);
    const expiryMinutes = request.expiryMinutes ?? 30;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    const upiUrl = buildUpiUrl({
      pa: request.merchantVpa,
      pn: 'BankOS NBFC',
      am: amountRupees,
      tn: request.txnNote,
      tr: request.transactionRef,
    });

    // Store pending payment
    this.payments.set(request.transactionRef, {
      transactionRef: request.transactionRef,
      status: 'SUCCESS', // mock: auto-success
      paidAmountPaisa: request.amountPaisa,
      paidAt: new Date().toISOString(),
    });

    console.log(`[MockUpiPayment] Link generated | ref: ${request.transactionRef} | amount: ₹${amountRupees} | vpa: ${request.merchantVpa}`);

    return {
      upiUrl,
      shortUrl: `https://upipay.mock/${request.transactionRef}`,
      qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 1x1 pixel placeholder
      transactionRef: request.transactionRef,
      amountPaisa: request.amountPaisa,
      expiresAt,
    };
  }

  async checkPaymentStatus(transactionRef: string): Promise<UpiPaymentStatusResponse> {
    const record = this.payments.get(transactionRef);
    return record ?? { transactionRef, status: 'PENDING' };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealUpiPaymentAdapter implements IUpiPaymentAdapter {
  async generateLink(_request: GenerateUpiLinkRequest): Promise<UpiPaymentLink> {
    throw new Error(
      'NOT_IMPLEMENTED: RealUpiPaymentAdapter requires PSP API credentials. ' +
        'Set UPI_MERCHANT_ID, UPI_API_KEY, UPI_MERCHANT_VPA, and UPI_ADAPTER=real.',
    );
  }
  async checkPaymentStatus(_transactionRef: string): Promise<UpiPaymentStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealUpiPaymentAdapter.checkPaymentStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createUpiPaymentAdapter(): IUpiPaymentAdapter {
  if (process.env.UPI_ADAPTER === 'real') {
    return new RealUpiPaymentAdapter();
  }
  return new MockUpiPaymentAdapter();
}
