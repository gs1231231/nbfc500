/**
 * Prompt 33 - PAN Verification Adapter
 * NSDL / NSDL e-Gov PAN verification API.
 * Mock returns valid; real adapter requires NSDL API credentials.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/** PAN category as returned by Income Tax / NSDL */
export type PanCategory =
  | 'INDIVIDUAL'
  | 'HUF'
  | 'FIRM'
  | 'COMPANY'
  | 'AOP_BOI'
  | 'LOCAL_AUTHORITY'
  | 'ARTIFICIAL_JURIDICAL_PERSON'
  | 'GOVERNMENT'
  | 'TRUST';

export interface PanVerificationRequest {
  panNumber: string;
  /** Optional - cross-check name against PAN database */
  fullName?: string;
  /** Optional - cross-check date of birth for individual PANs */
  dateOfBirth?: string; // YYYY-MM-DD
}

export interface PanVerificationResponse {
  panNumber: string;
  valid: boolean;
  /** Name as registered with Income Tax department */
  name?: string;
  /** PAN category (individual, company, trust, etc.) */
  category?: PanCategory;
  /** Whether PAN is linked to Aadhaar (as per IT dept) */
  aadhaarLinked?: boolean;
  /** Whether PAN is operative or inoperative */
  status: 'ACTIVE' | 'INACTIVE' | 'INVALID' | 'DEACTIVATED';
  /** Detailed message */
  message: string;
  verifiedAt: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IPanVerificationAdapter {
  /**
   * Verify a PAN number against the NSDL database.
   * Returns name, category, and validity status.
   */
  verify(request: PanVerificationRequest): Promise<PanVerificationResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockPanVerificationAdapter implements IPanVerificationAdapter {
  async verify(request: PanVerificationRequest): Promise<PanVerificationResponse> {
    const { panNumber } = request;

    // Basic format validation: 5 alpha + 4 numeric + 1 alpha
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(panNumber.toUpperCase())) {
      return {
        panNumber,
        valid: false,
        status: 'INVALID',
        message: 'PAN format is invalid',
        verifiedAt: new Date().toISOString(),
      };
    }

    // 4th character encodes entity type
    const entityChar = panNumber[3].toUpperCase();
    const categoryMap: Record<string, PanCategory> = {
      P: 'INDIVIDUAL',
      H: 'HUF',
      F: 'FIRM',
      C: 'COMPANY',
      A: 'AOP_BOI',
      T: 'TRUST',
      B: 'AOP_BOI',
      L: 'LOCAL_AUTHORITY',
      J: 'ARTIFICIAL_JURIDICAL_PERSON',
      G: 'GOVERNMENT',
    };
    const category: PanCategory = categoryMap[entityChar] ?? 'INDIVIDUAL';

    return {
      panNumber: panNumber.toUpperCase(),
      valid: true,
      name: request.fullName ?? 'Ramesh Kumar Sharma',
      category,
      aadhaarLinked: true,
      status: 'ACTIVE',
      message: 'PAN verified successfully',
      verifiedAt: new Date().toISOString(),
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealPanVerificationAdapter implements IPanVerificationAdapter {
  async verify(_request: PanVerificationRequest): Promise<PanVerificationResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealPanVerificationAdapter requires NSDL API credentials. ' +
        'Set NSDL_API_KEY, NSDL_CLIENT_ID, and PAN_ADAPTER=real in environment.',
    );
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createPanVerificationAdapter(): IPanVerificationAdapter {
  if (process.env.PAN_ADAPTER === 'real') {
    return new RealPanVerificationAdapter();
  }
  return new MockPanVerificationAdapter();
}
