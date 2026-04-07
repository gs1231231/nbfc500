import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class RequestVerificationDto {
  @ApiProperty({ description: 'Loan application ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({ description: 'Customer ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({
    description: 'Type of verification',
    example: 'TVR',
    enum: ['TVR', 'FI', 'TECHNICAL_VALUATION', 'LEGAL_VERIFICATION', 'RCU', 'PD', 'REFERENCE_CHECK'],
  })
  @IsString()
  @IsNotEmpty()
  verificationType!: string;

  @ApiPropertyOptional({ description: 'Vendor name', example: 'ABC Verification Agency' })
  @IsString()
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({ description: 'SLA deadline ISO date string', example: '2026-04-15T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  slaDeadline?: string;
}
