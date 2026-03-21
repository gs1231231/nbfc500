/**
 * Prompt 44 - CERSAI Adapter
 * Central Registry of Securitisation Asset Reconstruction and Security Interest.
 * Mandatory for secured loans - register charge on collateral asset.
 * RBI guidelines require registration within 30 days of creation.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AssetType =
  | 'IMMOVABLE_PROPERTY'
  | 'MOVABLE_PROPERTY'
  | 'RECEIVABLES'
  | 'INTELLECTUAL_PROPERTY'
  | 'FINANCIAL_ASSET'
  | 'VEHICLE'
  | 'GOLD';

export interface ImmovableAssetDetails {
  type: 'IMMOVABLE_PROPERTY';
  surveyNumber?: string;
  plotNumber?: string;
  khasraNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  areaSqFt?: number;
  /** Market value at time of registration (in paisa) */
  marketValuePaisa: number;
  /** Forced sale value (typically 60-70% of market value) */
  forcedSaleValuePaisa: number;
}

export interface VehicleAssetDetails {
  type: 'VEHICLE';
  registrationNumber: string;
  chassisNumber: string;
  engineNumber: string;
  make: string;
  model: string;
  manufacturingYear: number;
  /** Current market value in paisa */
  marketValuePaisa: number;
}

export interface GoldAssetDetails {
  type: 'GOLD';
  grossWeightGrams: number;
  netWeightGrams: number;
  purity: number; // e.g. 22 for 22K
  marketValuePaisa: number;
  assessedBy: string;
}

export type AssetDetails = ImmovableAssetDetails | VehicleAssetDetails | GoldAssetDetails;

export interface RegisterChargeRequest {
  loanId: string;
  /** NBFC's CERSAI-registered entity code */
  entityCode?: string;
  loanAmount: number; // in paisa
  borrowerDetails: {
    name: string;
    panNumber: string;
    aadhaarMasked?: string;
    address: string;
  };
  assetDetails: AssetDetails;
  /** Charge creation date = disbursement date */
  chargeDateOfCreation: string; // YYYY-MM-DD
  /** Loan maturity date */
  chargeEndDate: string;
}

export interface RegisterChargeResponse {
  chargeId: string;
  loanId: string;
  /** CERSAI-assigned Security Interest Registration Number */
  sirnNumber: string;
  registeredAt: string;
  status: 'REGISTERED' | 'PENDING' | 'REJECTED';
  expiresAt: string;
  message: string;
}

export interface SatisfyChargeResponse {
  chargeId: string;
  loanId: string;
  sirnNumber?: string;
  status: 'SATISFIED' | 'PENDING' | 'FAILED';
  satisfiedAt: string;
  message: string;
}

export interface ChargeStatusResponse {
  chargeId: string;
  loanId: string;
  sirnNumber?: string;
  status: 'REGISTERED' | 'SATISFIED' | 'PENDING' | 'EXPIRED';
  registeredAt?: string;
  satisfiedAt?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface ICersaiAdapter {
  /**
   * Register a security interest / charge on collateral.
   * Must be done within 30 days of loan disbursement.
   */
  registerCharge(request: RegisterChargeRequest): Promise<RegisterChargeResponse>;

  /**
   * Satisfy (release) a charge upon loan closure.
   */
  satisfyCharge(loanId: string, chargeId: string): Promise<SatisfyChargeResponse>;

  /**
   * Query status of a registered charge.
   */
  getChargeStatus(chargeId: string): Promise<ChargeStatusResponse>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockCersaiAdapter implements ICersaiAdapter {
  private readonly charges = new Map<string, ChargeStatusResponse>();

  async registerCharge(request: RegisterChargeRequest): Promise<RegisterChargeResponse> {
    const chargeId = `CERSAI-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const sirnNumber = `SIRN${Date.now()}`;

    const status: ChargeStatusResponse = {
      chargeId,
      loanId: request.loanId,
      sirnNumber,
      status: 'REGISTERED',
      registeredAt: new Date().toISOString(),
    };
    this.charges.set(chargeId, status);

    console.log(
      `[MockCERSAI] Charge registered | chargeId: ${chargeId} | ` +
        `loanId: ${request.loanId} | SIRN: ${sirnNumber} | ` +
        `assetType: ${request.assetDetails.type}`,
    );

    return {
      chargeId,
      loanId: request.loanId,
      sirnNumber,
      registeredAt: new Date().toISOString(),
      status: 'REGISTERED',
      expiresAt: request.chargeEndDate,
      message: 'Security interest registered successfully on CERSAI',
    };
  }

  async satisfyCharge(loanId: string, chargeId: string): Promise<SatisfyChargeResponse> {
    const existing = this.charges.get(chargeId);
    if (existing) {
      existing.status = 'SATISFIED';
      existing.satisfiedAt = new Date().toISOString();
      this.charges.set(chargeId, existing);
    }

    console.log(`[MockCERSAI] Charge satisfied | chargeId: ${chargeId} | loanId: ${loanId}`);

    return {
      chargeId,
      loanId,
      sirnNumber: existing?.sirnNumber,
      status: 'SATISFIED',
      satisfiedAt: new Date().toISOString(),
      message: 'Security interest satisfaction recorded on CERSAI',
    };
  }

  async getChargeStatus(chargeId: string): Promise<ChargeStatusResponse> {
    return (
      this.charges.get(chargeId) ?? {
        chargeId,
        loanId: '',
        status: 'PENDING',
      }
    );
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealCersaiAdapter implements ICersaiAdapter {
  async registerCharge(_request: RegisterChargeRequest): Promise<RegisterChargeResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealCersaiAdapter requires CERSAI entity registration. ' +
        'Set CERSAI_ENTITY_CODE, CERSAI_API_KEY, CERSAI_API_URL, and CERSAI_ADAPTER=real.',
    );
  }
  async satisfyCharge(_loanId: string, _chargeId: string): Promise<SatisfyChargeResponse> {
    throw new Error('NOT_IMPLEMENTED: RealCersaiAdapter.satisfyCharge()');
  }
  async getChargeStatus(_chargeId: string): Promise<ChargeStatusResponse> {
    throw new Error('NOT_IMPLEMENTED: RealCersaiAdapter.getChargeStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createCersaiAdapter(): ICersaiAdapter {
  if (process.env.CERSAI_ADAPTER === 'real') {
    return new RealCersaiAdapter();
  }
  return new MockCersaiAdapter();
}
