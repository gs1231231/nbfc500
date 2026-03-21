/**
 * Prompt 43 - Vahan RTO Adapter
 * Ministry of Road Transport and Highways (MoRTH) Vahan database.
 * Vehicle Registration Certificate (RC) verification for vehicle finance and LAP.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VehicleClass =
  | 'MOTOR_CYCLE'
  | 'MOTOR_CAR'
  | 'LIGHT_MOTOR_VEHICLE'
  | 'MEDIUM_GOODS_VEHICLE'
  | 'HEAVY_GOODS_VEHICLE'
  | 'AGRICULTURAL_TRACTOR'
  | 'INVALID_CARRIAGE'
  | 'OMNIBUS'
  | 'TAXI';

export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'CNG' | 'LPG' | 'HYBRID';

export interface VehicleVerificationRequest {
  registrationNumber: string;
  /** Optional: owner's name for cross-validation */
  ownerName?: string;
  /** Optional: chassis number for double-check */
  chassisNumber?: string;
}

export interface RcEncumbrance {
  financierName: string;
  hypothecationStartDate: string;
  hypothecationEndDate?: string;
}

export interface VehicleVerificationResponse {
  registrationNumber: string;
  valid: boolean;
  ownerName: string;
  ownerFatherName?: string;
  vehicleClass: VehicleClass;
  vehicleCategory: string; // LMV, HMV, etc.
  fuelType: FuelType;
  make: string;          // e.g. MARUTI
  model: string;         // e.g. SWIFT
  variant?: string;
  color: string;
  engineNumber: string;
  chassisNumber: string;
  /** Registration date */
  registrationDate: string;
  /** Vehicle manufacturing year */
  manufacturingYear: number;
  /** RC validity (typically 15 years for private) */
  rcExpiryDate: string;
  /** Insurance validity */
  insuranceValidUpto?: string;
  insuranceCompany?: string;
  /** Pollution Under Control validity */
  pucValidUpto?: string;
  /** Fitness certificate (for commercial vehicles) */
  fitnessValidUpto?: string;
  /** Hypothecation details if under finance */
  encumbrances: RcEncumbrance[];
  /** State of registration */
  stateName: string;
  rtoName: string;
  /** HSRP / BH series */
  isBlackPlate: boolean;
  message: string;
  verifiedAt: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IVahanRtoAdapter {
  /**
   * Verify vehicle registration certificate via Vahan database.
   */
  verifyVehicle(request: VehicleVerificationRequest): Promise<VehicleVerificationResponse>;
}

// ─── Registration Number Parsing ───────────────────────────────────────────────

function parseStateFromReg(regNumber: string): { stateName: string; rtoName: string } {
  const stateMap: Record<string, string> = {
    MH: 'Maharashtra', DL: 'Delhi', KA: 'Karnataka', TN: 'Tamil Nadu',
    GJ: 'Gujarat', RJ: 'Rajasthan', UP: 'Uttar Pradesh', HR: 'Haryana',
    PB: 'Punjab', WB: 'West Bengal', AP: 'Andhra Pradesh', TS: 'Telangana',
    KL: 'Kerala', MP: 'Madhya Pradesh', BR: 'Bihar', OD: 'Odisha',
  };
  const prefix = regNumber.slice(0, 2).toUpperCase();
  return {
    stateName: stateMap[prefix] ?? 'Unknown',
    rtoName: `${stateMap[prefix] ?? 'Unknown'} RTO`,
  };
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockVahanRtoAdapter implements IVahanRtoAdapter {
  async verifyVehicle(request: VehicleVerificationRequest): Promise<VehicleVerificationResponse> {
    const regNumber = request.registrationNumber.toUpperCase().replace(/\s/g, '');

    // Basic format check: STATE(2) + DISTRICT(2) + SERIES(1-2) + NUMBER(4)
    const regRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
    if (!regRegex.test(regNumber)) {
      return {
        registrationNumber: regNumber,
        valid: false,
        ownerName: '',
        vehicleClass: 'MOTOR_CAR',
        vehicleCategory: 'LMV',
        fuelType: 'PETROL',
        make: '',
        model: '',
        color: '',
        engineNumber: '',
        chassisNumber: '',
        registrationDate: '',
        manufacturingYear: 0,
        rcExpiryDate: '',
        encumbrances: [],
        stateName: '',
        rtoName: '',
        isBlackPlate: false,
        message: 'Invalid registration number format',
        verifiedAt: new Date().toISOString(),
      };
    }

    const { stateName, rtoName } = parseStateFromReg(regNumber);

    return {
      registrationNumber: regNumber,
      valid: true,
      ownerName: request.ownerName ?? 'RAMESH KUMAR SHARMA',
      ownerFatherName: 'SURESH KUMAR SHARMA',
      vehicleClass: 'MOTOR_CAR',
      vehicleCategory: 'LMV',
      fuelType: 'PETROL',
      make: 'MARUTI SUZUKI',
      model: 'SWIFT',
      variant: 'VXI',
      color: 'WHITE',
      engineNumber: `ENG${Date.now().toString().slice(-10)}`,
      chassisNumber: request.chassisNumber ?? `CHS${Date.now().toString().slice(-10)}`,
      registrationDate: '2021-06-15',
      manufacturingYear: 2021,
      rcExpiryDate: '2036-06-14',
      insuranceValidUpto: '2025-06-14',
      insuranceCompany: 'BAJAJ ALLIANZ GENERAL INSURANCE',
      pucValidUpto: '2025-09-14',
      encumbrances: [], // no hypothecation
      stateName,
      rtoName,
      isBlackPlate: false,
      message: 'Vehicle RC verified successfully',
      verifiedAt: new Date().toISOString(),
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealVahanRtoAdapter implements IVahanRtoAdapter {
  async verifyVehicle(_request: VehicleVerificationRequest): Promise<VehicleVerificationResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealVahanRtoAdapter requires MoRTH Vahan API credentials. ' +
        'Set VAHAN_API_KEY, VAHAN_CLIENT_ID, VAHAN_GATEWAY_URL, and VAHAN_ADAPTER=real.',
    );
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createVahanRtoAdapter(): IVahanRtoAdapter {
  if (process.env.VAHAN_ADAPTER === 'real') {
    return new RealVahanRtoAdapter();
  }
  return new MockVahanRtoAdapter();
}
