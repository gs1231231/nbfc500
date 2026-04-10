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
} from 'class-validator';
import {
  FEE_CODES,
  FEE_CATEGORIES,
  CALCULATION_TYPES,
  PERCENTAGE_BASES,
  TRIGGER_EVENTS,
  COLLECT_AT_OPTIONS,
  UNIT_TYPES,
} from './create-fee-template.dto';

export class UpdateFeeTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  templateName?: string;

  @IsOptional()
  @IsIn(FEE_CODES)
  feeCode?: string;

  @IsOptional()
  @IsIn(FEE_CATEGORIES)
  feeCategory?: string;

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
  @IsOptional()
  @IsIn(CALCULATION_TYPES)
  calculationType?: string;

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
