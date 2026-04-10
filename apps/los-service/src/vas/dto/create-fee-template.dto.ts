import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsNumber,
  IsIn,
  Min,
  MinLength,
  MaxLength,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export const FEE_CODES = [
  'PROCESSING_FEE',
  'LOGIN_FEE',
  'DOCUMENTATION_CHARGE',
  'LEGAL_FEE',
  'VALUATION_FEE',
  'STAMP_DUTY',
  'INSURANCE_PREMIUM',
  'CIBIL_CHARGE',
  'NACH_CHARGE',
  'FILE_CHARGE',
  'CERSAI_FEE',
  'MOD_CHARGE',
  'SWAP_FEE',
  'PREPAYMENT_PENALTY',
  'FORECLOSURE_CHARGE',
  'BOUNCE_CHARGE',
  'PENAL_INTEREST',
  'LATE_PAYMENT_FEE',
  'CHEQUE_RETURN',
  'MANDATE_REJECTION',
  'SOA_CHARGE',
  'NOC_CHARGE',
  'REPOSSESSION_CHARGE',
  'AUCTION_FEE',
  'LEGAL_NOTICE_FEE',
  'COURIER_CHARGE',
  'VISIT_CHARGE',
  'OTHER',
] as const;

export const FEE_CATEGORIES = [
  'ORIGINATION',
  'SERVICING',
  'PENAL',
  'CLOSURE',
  'COLLECTION',
  'REGULATORY',
  'OTHER',
] as const;

export const CALCULATION_TYPES = [
  'FLAT',
  'PERCENTAGE',
  'SLAB',
  'PER_UNIT',
  'FORMULA',
] as const;

export const PERCENTAGE_BASES = [
  'LOAN_AMOUNT',
  'OUTSTANDING_PRINCIPAL',
  'OVERDUE_AMOUNT',
  'EMI_AMOUNT',
  'DISBURSED_AMOUNT',
] as const;

export const TRIGGER_EVENTS = [
  'DISBURSAL',
  'BOUNCE',
  'PREPAYMENT',
  'FORECLOSURE',
  'NPA',
  'MANDATE_FAIL',
  'MONTHLY',
  'ANNUAL',
  'ON_DEMAND',
] as const;

export const COLLECT_AT_OPTIONS = [
  'DISBURSAL',
  'UPFRONT',
  'POST_DISBURSAL',
  'ON_EVENT',
  'MONTHLY',
] as const;

export const UNIT_TYPES = [
  'GOLD_ITEM',
  'TRANCHE',
  'PROPERTY',
  'DOCUMENT',
] as const;

export class CreateFeeTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  templateName!: string;

  @IsIn(FEE_CODES)
  feeCode!: string;

  @IsIn(FEE_CATEGORIES)
  feeCategory!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Applicability
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minAmountPaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAmountPaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minRateBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRateBps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minTenureMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTenureMonths?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employmentTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  schemeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  loanStatuses?: string[];

  @IsOptional()
  @IsIn(TRIGGER_EVENTS)
  triggerEvent?: string;

  // Calculation
  @IsIn(CALCULATION_TYPES)
  calculationType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmountPaisa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentageValue?: number;

  @IsOptional()
  @IsIn(PERCENTAGE_BASES)
  percentageBase?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCapPaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCapPaisa?: number;

  @IsOptional()
  slabs?: Array<{
    upToPaisa: number | null;
    flatPaisa?: number;
    percent?: number;
  }>;

  @IsOptional()
  @IsInt()
  @Min(0)
  perUnitAmountPaisa?: number;

  @IsOptional()
  @IsIn(UNIT_TYPES)
  unitType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formula?: string;

  // Tax
  @IsOptional()
  @IsBoolean()
  gstApplicable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cessPercent?: number;

  // Collection
  @IsOptional()
  @IsIn(COLLECT_AT_OPTIONS)
  collectAt?: string;

  @IsOptional()
  @IsBoolean()
  deductFromDisbursement?: boolean;

  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @IsOptional()
  @IsString()
  refundCondition?: string;

  // Display
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  showInSanctionLetter?: boolean;

  @IsOptional()
  @IsBoolean()
  showInKFS?: boolean;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountPercent?: number;
}
