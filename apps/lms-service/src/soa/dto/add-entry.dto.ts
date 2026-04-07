import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddSoaEntryDto {
  @ApiProperty({ description: 'ISO date string for the entry', example: '2026-04-08T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  entryDate!: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'EMI_DEMAND',
    enum: [
      'DISBURSEMENT', 'EMI_DEMAND', 'PRINCIPAL_RECEIPT', 'INTEREST_RECEIPT',
      'PENAL_RECEIPT', 'BOUNCE_CHARGE', 'FEE_LEVIED', 'INTEREST_ACCRUAL',
      'PROVISION', 'WRITE_OFF', 'WAIVER', 'PREPAYMENT', 'FORECLOSURE', 'REVERSAL',
    ],
  })
  @IsString()
  @IsNotEmpty()
  transactionType!: string;

  @ApiProperty({ description: 'Description of the transaction', example: 'EMI #3 demand generated' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ description: 'Debit amount in paisa', example: 50000, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  debitPaisa?: number;

  @ApiPropertyOptional({ description: 'Credit amount in paisa', example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  creditPaisa?: number;

  @ApiPropertyOptional({ description: 'Reference ID (payment ID, schedule ID, etc.)', example: 'uuid' })
  @IsString()
  @IsOptional()
  referenceId?: string;
}
