/**
 * Prompt 42 - GST Portal Adapter
 * GSTN verification API for business loan applicants.
 * Validates GSTIN, fetches trade name, filing status, and turnover data.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GstinStatus = 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PENDING_VERIFICATION';
export type GstTaxpayerType = 'REGULAR' | 'COMPOSITION' | 'CASUAL' | 'NON_RESIDENT' | 'INPUT_SERVICE_DISTRIBUTOR';

export interface GstinVerificationRequest {
  gstin: string;
  /** Optional: fetch return filing history (requires GST API key with extended access) */
  includeFiling?: boolean;
}

export interface GstReturnFiling {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR9';
  period: string; // e.g. "012024" for Jan 2024
  status: 'FILED' | 'NOT_FILED' | 'FILED_LATE';
  filedOn?: string;
}

export interface GstinVerificationResponse {
  gstin: string;
  valid: boolean;
  tradeName: string;
  legalName: string;
  status: GstinStatus;
  taxpayerType: GstTaxpayerType;
  stateCode: string;
  stateName: string;
  registrationDate: string;
  cancellationDate?: string;
  principalAddress?: string;
  natureOfBusiness?: string[];
  filingHistory?: GstReturnFiling[];
  message: string;
  verifiedAt: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IGstPortalAdapter {
  /**
   * Verify a GSTIN and fetch taxpayer details from GSTN.
   */
  verifyGstin(request: GstinVerificationRequest): Promise<GstinVerificationResponse>;
}

// ─── Validation Utility ────────────────────────────────────────────────────────

function isValidGstinFormat(gstin: string): boolean {
  // GSTIN: 2-digit state + 10-char PAN + 1 entity + Z + checksum
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh (New)',
};

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockGstPortalAdapter implements IGstPortalAdapter {
  async verifyGstin(request: GstinVerificationRequest): Promise<GstinVerificationResponse> {
    const gstin = request.gstin.toUpperCase();

    if (!isValidGstinFormat(gstin)) {
      return {
        gstin,
        valid: false,
        tradeName: '',
        legalName: '',
        status: 'PENDING_VERIFICATION',
        taxpayerType: 'REGULAR',
        stateCode: '',
        stateName: '',
        registrationDate: '',
        message: 'Invalid GSTIN format',
        verifiedAt: new Date().toISOString(),
      };
    }

    const stateCode = gstin.slice(0, 2);
    const stateName = STATE_CODES[stateCode] ?? 'Unknown State';

    const filingHistory: GstReturnFiling[] = request.includeFiling
      ? [
          { returnType: 'GSTR3B', period: '022025', status: 'FILED', filedOn: '2025-03-20' },
          { returnType: 'GSTR1', period: '022025', status: 'FILED', filedOn: '2025-03-11' },
          { returnType: 'GSTR3B', period: '012025', status: 'FILED', filedOn: '2025-02-20' },
          { returnType: 'GSTR1', period: '012025', status: 'FILED_LATE', filedOn: '2025-02-15' },
        ]
      : undefined;

    return {
      gstin,
      valid: true,
      tradeName: 'ABC ENTERPRISES',
      legalName: 'ABC ENTERPRISES PRIVATE LIMITED',
      status: 'ACTIVE',
      taxpayerType: 'REGULAR',
      stateCode,
      stateName,
      registrationDate: '2019-07-01',
      principalAddress: '123, Industrial Area, Phase II',
      natureOfBusiness: ['Wholesale Business', 'Retail Business'],
      filingHistory,
      message: 'GSTIN verified successfully',
      verifiedAt: new Date().toISOString(),
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealGstPortalAdapter implements IGstPortalAdapter {
  async verifyGstin(_request: GstinVerificationRequest): Promise<GstinVerificationResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealGstPortalAdapter requires GSTN API credentials. ' +
        'Set GST_API_KEY, GST_CLIENT_ID, GST_CLIENT_SECRET, and GST_ADAPTER=real.',
    );
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createGstPortalAdapter(): IGstPortalAdapter {
  if (process.env.GST_ADAPTER === 'real') {
    return new RealGstPortalAdapter();
  }
  return new MockGstPortalAdapter();
}
