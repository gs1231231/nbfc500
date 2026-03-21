import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisburseLoanDto {
  @ApiProperty({
    description: 'Disbursement amount in paisa (1 INR = 100 paisa)',
    example: 50000000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  disbursementAmountPaisa!: number;

  @ApiProperty({
    description: 'Date of disbursement in ISO 8601 format (UTC)',
    example: '2026-03-21T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  disbursementDate!: string;

  @ApiProperty({
    description: 'Bank account number to which the loan is disbursed',
    example: '1234567890123456',
  })
  @IsString()
  @IsNotEmpty()
  bankAccountNumber!: string;

  @ApiProperty({
    description:
      'IFSC code of the beneficiary bank branch (4 alpha + 0 + 6 alphanumeric = 11 chars)',
    example: 'HDFC0001234',
    pattern: '^[A-Z]{4}0[A-Z0-9]{6}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message:
      'ifscCode must be a valid IFSC code: 4 uppercase letters + 0 + 6 alphanumeric characters',
  })
  ifscCode!: string;
}
