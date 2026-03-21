import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// ─────────────────────────────────────────────
// CoLendingPartner DTOs
// ─────────────────────────────────────────────

export class CreatePartnerDto {
  @ApiProperty({ description: 'Full legal name of the bank partner', example: 'State Bank of India' })
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @ApiProperty({ description: 'Short code identifying the bank', example: 'SBI' })
  @IsString()
  @IsNotEmpty()
  bankCode!: string;

  @ApiPropertyOptional({ description: 'API endpoint for the bank partner system', example: 'https://api.sbi.co.in/colending' })
  @IsOptional()
  @IsUrl()
  apiEndpoint?: string;

  @ApiProperty({
    description: 'Default share percentage for the bank (0-100)',
    example: 80,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  defaultBankSharePercent!: number;

  @ApiProperty({
    description: 'Default share percentage for the NBFC (0-100). Must total 100 with bank share.',
    example: 20,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  defaultNbfcSharePercent!: number;

  @ApiProperty({
    description: "Bank's interest rate in basis points (e.g. 850 = 8.50%)",
    example: 850,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  bankInterestRateBps!: number;

  @ApiProperty({
    description: "NBFC's interest rate in basis points (e.g. 1400 = 14.00%)",
    example: 1400,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  nbfcInterestRateBps!: number;

  @ApiProperty({
    description: 'Maximum exposure limit in paisa (e.g. 1000000000 = ₹1 crore)',
    example: 1000000000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  maxExposurePaisa!: number;

  @ApiPropertyOptional({
    description: 'DLG (Default Loss Guarantee) cap as a percentage of portfolio (default: 5)',
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  dlgCapPercent?: number;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional({ description: 'API endpoint for the bank partner system' })
  @IsOptional()
  @IsUrl()
  apiEndpoint?: string;

  @ApiPropertyOptional({ description: 'Default share percentage for the bank (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  defaultBankSharePercent?: number;

  @ApiPropertyOptional({ description: 'Default share percentage for the NBFC (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  defaultNbfcSharePercent?: number;

  @ApiPropertyOptional({ description: "Bank's interest rate in basis points" })
  @IsOptional()
  @IsInt()
  @Min(0)
  bankInterestRateBps?: number;

  @ApiPropertyOptional({ description: "NBFC's interest rate in basis points" })
  @IsOptional()
  @IsInt()
  @Min(0)
  nbfcInterestRateBps?: number;

  @ApiPropertyOptional({ description: 'Maximum exposure limit in paisa' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxExposurePaisa?: number;

  @ApiPropertyOptional({ description: 'DLG cap percentage' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  dlgCapPercent?: number;

  @ApiPropertyOptional({ description: 'Whether the partner is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─────────────────────────────────────────────
// Allocation DTOs
// ─────────────────────────────────────────────

export class AllocateDto {
  @ApiProperty({
    description: 'UUID of the loan application to allocate for co-lending',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;
}
