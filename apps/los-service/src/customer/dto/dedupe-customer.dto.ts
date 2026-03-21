import {
  IsString,
  IsOptional,
  ValidateIf,
  IsNotEmpty,
  Matches,
  Length,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for customer deduplication check.
 * At least one of panNumber, phone, or aadhaarLast4 must be provided.
 */
export class DedupeCustomerDto {
  @ApiPropertyOptional({
    example: 'ABCDE1234F',
    description: 'PAN number to check for duplicate',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'PAN must be in format ABCDE1234F',
  })
  panNumber?: string;

  @ApiPropertyOptional({
    example: '9876543210',
    description: 'Mobile number to check for duplicate',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Last 4 digits of Aadhaar to check for duplicate',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'aadhaarLast4 must be exactly 4 digits' })
  aadhaarLast4?: string;

  @ValidateIf(
    (o: DedupeCustomerDto) => !o.panNumber && !o.phone && !o.aadhaarLast4,
  )
  @IsNotEmpty({
    message: 'At least one of panNumber, phone, or aadhaarLast4 is required',
  })
  _atLeastOne?: never;
}
