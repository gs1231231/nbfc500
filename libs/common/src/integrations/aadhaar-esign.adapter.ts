/**
 * Prompt 39 - Aadhaar eSign Adapter
 * Electronic signature on loan agreements via UIDAI Aadhaar eSign.
 * Compliant with Information Technology Act Section 3A and RBI guidelines.
 * Mock adapter; real requires ASP (Application Service Provider) credentials.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ESignDocumentFormat = 'PDF' | 'XML';
export type ESignAlgorithm = 'SHA256withRSA' | 'SHA256withECDSA';

export interface ESignInitiateRequest {
  /** Internal document ID */
  documentId: string;
  /** Aadhaar number of the signer */
  aadhaarNumber: string;
  /** Base64-encoded PDF or XML document content */
  documentContent: string;
  documentFormat: ESignDocumentFormat;
  /** Signing algorithm */
  algorithm?: ESignAlgorithm;
  /** Page number and coordinate for signature placement */
  signaturePlacement?: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Purpose of signing shown to Aadhaar holder */
  signingPurpose: string;
  /** Redirect URL after eSign flow completes */
  redirectUrl: string;
}

export interface ESignInitiateResponse {
  success: boolean;
  txnId: string;
  documentId: string;
  /** URL to redirect the borrower to for Aadhaar OTP authentication */
  eSignUrl: string;
  /** Time by which the eSign must be completed */
  expiresAt: string;
  message: string;
}

export interface ESignVerifyRequest {
  txnId: string;
  /** OTP entered by the borrower (for OTP-based eSign) */
  otp?: string;
  /** Aadhaar number */
  aadhaarNumber: string;
}

export interface ESignVerifyResponse {
  success: boolean;
  txnId: string;
  documentId: string;
  /** Base64-encoded signed PDF/XML */
  signedDocumentContent?: string;
  /** Digital Signature Certificate details */
  signerDetails?: {
    name: string;
    aadhaarMasked: string; // XXXX-XXXX-1234
    signedAt: string;
    certificateSerial: string;
    certificateValidity: string;
  };
  errorCode?: string;
  message: string;
}

export interface ESignStatusResponse {
  txnId: string;
  documentId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  completedAt?: string;
  message: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IAadhaarESignAdapter {
  /**
   * Initiate the eSign flow for a document.
   * Returns a URL to redirect the borrower to for Aadhaar OTP.
   */
  initiate(request: ESignInitiateRequest): Promise<ESignInitiateResponse>;

  /**
   * Verify OTP and complete eSign. Returns signed document.
   */
  verify(request: ESignVerifyRequest): Promise<ESignVerifyResponse>;

  /**
   * Get the current status of an eSign transaction.
   */
  getStatus(txnId: string): Promise<ESignStatusResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockAadhaarESignAdapter implements IAadhaarESignAdapter {
  private readonly transactions = new Map<string, ESignStatusResponse>();

  async initiate(request: ESignInitiateRequest): Promise<ESignInitiateResponse> {
    const txnId = `ESIGN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

    this.transactions.set(txnId, {
      txnId,
      documentId: request.documentId,
      status: 'PENDING',
      message: 'eSign initiated',
    });

    console.log(`[MockESign] Initiated | txnId: ${txnId} | documentId: ${request.documentId} | aadhaar: ${request.aadhaarNumber.slice(-4).padStart(12, '*')}`);

    return {
      success: true,
      txnId,
      documentId: request.documentId,
      eSignUrl: `https://esign.mock.uidai.gov.in/auth?txnId=${txnId}&redirectUrl=${encodeURIComponent(request.redirectUrl)}`,
      expiresAt,
      message: 'eSign session initiated. Redirect borrower to eSignUrl.',
    };
  }

  async verify(request: ESignVerifyRequest): Promise<ESignVerifyResponse> {
    const { txnId, aadhaarNumber } = request;

    const statusRecord = this.transactions.get(txnId);
    if (!statusRecord) {
      return { success: false, txnId, documentId: '', message: 'Transaction not found' };
    }

    // Mark as completed
    statusRecord.status = 'COMPLETED';
    statusRecord.completedAt = new Date().toISOString();
    this.transactions.set(txnId, statusRecord);

    console.log(`[MockESign] Verified | txnId: ${txnId} | documentId: ${statusRecord.documentId}`);

    return {
      success: true,
      txnId,
      documentId: statusRecord.documentId,
      signedDocumentContent: 'MOCK_SIGNED_DOCUMENT_BASE64',
      signerDetails: {
        name: 'Ramesh Kumar Sharma',
        aadhaarMasked: `XXXX-XXXX-${aadhaarNumber.slice(-4)}`,
        signedAt: new Date().toISOString(),
        certificateSerial: `CERT${Date.now()}`,
        certificateValidity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      message: 'Document signed successfully',
    };
  }

  async getStatus(txnId: string): Promise<ESignStatusResponse> {
    return (
      this.transactions.get(txnId) ?? {
        txnId,
        documentId: '',
        status: 'PENDING',
        message: 'Transaction not found',
      }
    );
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealAadhaarESignAdapter implements IAadhaarESignAdapter {
  async initiate(_request: ESignInitiateRequest): Promise<ESignInitiateResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealAadhaarESignAdapter requires UIDAI ASP credentials. ' +
        'Set ESIGN_ASP_ID, ESIGN_ASP_LICENSE_KEY, ESIGN_GATEWAY_URL, and ESIGN_ADAPTER=real.',
    );
  }
  async verify(_request: ESignVerifyRequest): Promise<ESignVerifyResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAadhaarESignAdapter.verify()');
  }
  async getStatus(_txnId: string): Promise<ESignStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAadhaarESignAdapter.getStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createAadhaarESignAdapter(): IAadhaarESignAdapter {
  if (process.env.ESIGN_ADAPTER === 'real') {
    return new RealAadhaarESignAdapter();
  }
  return new MockAadhaarESignAdapter();
}
