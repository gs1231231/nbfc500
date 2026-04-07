import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class AddMSMEDetailDto {
  @ApiProperty({ description: 'Application ID this MSME detail belongs to', example: 'uuid-application-id' })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiPropertyOptional({
    description: 'GST Identification Number (15-character alphanumeric)',
    example: '27AAPFU0939F1ZV',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  gstin?: string;

  @ApiPropertyOptional({
    description: 'Udyam Registration Number',
    example: 'UDYAM-MH-01-0001234',
    pattern: '^UDYAM-[A-Z]{2}-\\d{2}-\\d{7}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, {
    message: 'udyamNumber must be in format UDYAM-XX-99-9999999',
  })
  udyamNumber?: string;

  @ApiPropertyOptional({
    description: 'MSME category',
    example: 'MICRO',
    enum: ['MICRO', 'SMALL', 'MEDIUM'],
  })
  @IsOptional()
  @IsString()
  msmeCategory?: string;

  @ApiPropertyOptional({
    description: 'Business type',
    example: 'MANUFACTURING',
    enum: ['MANUFACTURING', 'SERVICES', 'TRADING'],
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ description: 'Business vintage in months', example: 36 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  businessVintageMonths?: number;

  @ApiPropertyOptional({ description: 'Annual turnover in paisa (from audited financials)', example: 120000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  annualTurnoverPaisa?: number;

  @ApiPropertyOptional({ description: 'GST-declared turnover in paisa', example: 100000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  gstTurnoverPaisa?: number;

  @ApiPropertyOptional({ description: 'Banking limit (existing CC/OD limit) in paisa', example: 5000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  bankingLimitPaisa?: number;

  @ApiPropertyOptional({ description: 'Drawing power in paisa (based on stock + debtors - creditors)', example: 4000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  drawingPowerPaisa?: number;

  @ApiPropertyOptional({ description: 'Date of stock statement', example: '2026-03-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  stockStatementDate?: string;

  @ApiPropertyOptional({ description: 'Stock value in paisa (as per stock statement)', example: 8000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Book debtor value in paisa (receivables)', example: 3000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  debtorValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Creditor value in paisa (payables to be deducted)', example: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  creditorValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Current ratio as percentage (currentAssets/currentLiabilities * 100)', example: 150.50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentRatioPct?: number;
}
