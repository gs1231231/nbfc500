/**
 * Prompt 32 - Aadhaar eKYC Adapter
 * UIDAI eKYC API - OTP-based identity verification.
 * Mock adapter returns success; real adapter requires AUA/KUA credentials.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AadhaarOtpRequest {
  aadhaarNumber: string;
  /** Optional - pre-filled to speed up the OTP flow */
  mobileNumber?: string;
}

export interface AadhaarOtpResponse {
  success: boolean;
  txnId: string; // must be passed to verifyOtp()
  message: string;
}

export interface AadhaarVerifyOtpRequest {
  txnId: string;
  otp: string;
  aadhaarNumber: string;
}

export interface AadhaarVerifyOtpResponse {
  success: boolean;
  txnId: string;
  message: string;
}

export interface AadhaarEkycData {
  /** eKYC response attributes as returned by UIDAI */
  aadhaarNumber: string; // last 4 digits only (masked)
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'M' | 'F' | 'T';
  address: {
    careOf: string;
    district: string;
    landmark?: string;
    house?: string;
    location?: string;
    pincode: string;
    postOffice: string;
    state: string;
    street?: string;
    subDistrict?: string;
    vtc?: string;
  };
  phone: string; // masked - last 2 digits only
  email?: string; // masked - available only if registered
  photo?: string; // base64 JPEG - only in XML eKYC, not OTP eKYC
  /** Validity of the eKYC token - typically 6 months */
  validUntil: string;
}

export interface AadhaarEkycResponse {
  success: boolean;
  txnId: string;
  ekycData?: AadhaarEkycData;
  errorCode?: string;
  message: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IAadhaarEkycAdapter {
  /**
   * Trigger OTP to Aadhaar-linked mobile number via UIDAI.
   * Returns a txnId that must be used in verifyOtp().
   */
  sendOtp(aadhaarNumber: string): Promise<AadhaarOtpResponse>;

  /**
   * Verify OTP and confirm identity. Returns success/failure.
   */
  verifyOtp(txnId: string, otp: string, aadhaarNumber: string): Promise<AadhaarVerifyOtpResponse>;

  /**
   * Fetch eKYC data after successful OTP verification.
   * txnId from verifyOtp() is required.
   */
  getEkycData(txnId: string, aadhaarNumber: string): Promise<AadhaarEkycResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockAadhaarEkycAdapter implements IAadhaarEkycAdapter {
  private readonly otpStore = new Map<string, { aadhaarNumber: string; otp: string }>();

  async sendOtp(aadhaarNumber: string): Promise<AadhaarOtpResponse> {
    const txnId = `MOCK-TXN-${Date.now()}`;
    // Store mock OTP (always '123456' for testing)
    this.otpStore.set(txnId, { aadhaarNumber, otp: '123456' });
    console.log(`[MockAadhaarEkyc] OTP sent for Aadhaar ${aadhaarNumber.slice(-4).padStart(12, '*')} | txnId: ${txnId} | Mock OTP: 123456`);
    return { success: true, txnId, message: 'OTP sent successfully to registered mobile' };
  }

  async verifyOtp(txnId: string, otp: string, aadhaarNumber: string): Promise<AadhaarVerifyOtpResponse> {
    const stored = this.otpStore.get(txnId);
    if (!stored || stored.aadhaarNumber !== aadhaarNumber) {
      return { success: false, txnId, message: 'Invalid transaction ID' };
    }
    if (stored.otp !== otp && otp !== '123456') {
      return { success: false, txnId, message: 'Invalid OTP' };
    }
    console.log(`[MockAadhaarEkyc] OTP verified for txnId: ${txnId}`);
    return { success: true, txnId, message: 'OTP verified successfully' };
  }

  async getEkycData(txnId: string, aadhaarNumber: string): Promise<AadhaarEkycResponse> {
    const masked = `XXXX-XXXX-${aadhaarNumber.slice(-4)}`;
    return {
      success: true,
      txnId,
      ekycData: {
        aadhaarNumber: masked,
        name: 'Ramesh Kumar Sharma',
        dateOfBirth: '1988-06-15',
        gender: 'M',
        address: {
          careOf: 'S/O Suresh Sharma',
          district: 'Mumbai',
          house: 'A-204',
          landmark: 'Near City Mall',
          location: 'Andheri West',
          pincode: '400053',
          postOffice: 'Andheri',
          state: 'Maharashtra',
          street: 'Link Road',
        },
        phone: 'XXXXXXXX90',
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      message: 'eKYC data fetched successfully',
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealAadhaarEkycAdapter implements IAadhaarEkycAdapter {
  async sendOtp(_aadhaarNumber: string): Promise<AadhaarOtpResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealAadhaarEkycAdapter requires AUA/KUA credentials from UIDAI. ' +
        'Set UIDAI_AUA_CODE, UIDAI_ASA_LICENSE_KEY, and AADHAAR_ADAPTER=real.',
    );
  }
  async verifyOtp(_txnId: string, _otp: string, _aadhaarNumber: string): Promise<AadhaarVerifyOtpResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAadhaarEkycAdapter.verifyOtp()');
  }
  async getEkycData(_txnId: string, _aadhaarNumber: string): Promise<AadhaarEkycResponse> {
    throw new Error('NOT_IMPLEMENTED: RealAadhaarEkycAdapter.getEkycData()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createAadhaarEkycAdapter(): IAadhaarEkycAdapter {
  if (process.env.AADHAAR_ADAPTER === 'real') {
    return new RealAadhaarEkycAdapter();
  }
  return new MockAadhaarEkycAdapter();
}
