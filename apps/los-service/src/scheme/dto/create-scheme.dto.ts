import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsIn,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SCHEME_TYPES = [
  'FESTIVE',
  'PROMOTIONAL',
  'BALANCE_TRANSFER',
  'TOP_UP',
  'CORPORATE_TIE_UP',
  'SEASONAL',
  'LOYALTY',
  'GOVERNMENT',
] as const;

export const CASHBACK_CONDITIONS = [
  'AT_DISBURSAL',
  'AFTER_3_EMI_PAID',
  'AFTER_6_EMI_PAID',
  'AFTER_12_EMI_PAID',
] as const;

export class CreateSchemeDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  schemeCode!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  schemeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(SCHEME_TYPES)
  schemeType!: string;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Eligibility
  @IsOptional()
  @IsInt()
  @Min(300)
  minCibilScore?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  maxCibilScore?: number;

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
  @Min(1)
  minTenureMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTenureMonths?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleEmploymentTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCustomerTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minAgeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAgeDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleBranches?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleDsas?: string[];

  @IsOptional()
  eligibilityCriteria?: Record<string, unknown>;

  // Benefits
  @IsOptional()
  @IsInt()
  interestRateDiscountBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedInterestRateBps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  processingFeeDiscountPercent?: number;

  @IsOptional()
  @IsBoolean()
  processingFeeWaiver?: boolean;

  @IsOptional()
  @IsBoolean()
  stampDutyWaiver?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  insuranceDiscount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashbackAmountPaisa?: number;

  @IsOptional()
  @IsIn(CASHBACK_CONDITIONS)
  cashbackCondition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  topUpEligibleAfterMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  balanceTransferMaxDays?: number;

  @IsOptional()
  additionalBenefits?: Record<string, unknown>;

  // Limits & Budget
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDisbursementCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDisbursementAmountPaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerBranchCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerDsaCount?: number;

  // Approval
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsString()
  approvalAuthority?: string;
}
