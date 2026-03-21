import { IsString, IsInt, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'MOCK-TXN-1700000000000',
    description: 'Transaction ID returned by the send-otp endpoint',
  })
  @IsString()
  txnId!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP sent to the Aadhaar-linked mobile number',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp!: string;

  @ApiProperty({
    example: '234567891234',
    description: 'Aadhaar number — exactly 12 digits, must match the one used in send-otp',
  })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'aadhaarNumber must be exactly 12 digits' })
  aadhaarNumber!: string;

  @ApiProperty({
    example: 'uuid-of-loan-product',
    description: 'UUID of the loan product to apply for',
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    example: 'uuid-of-branch',
    description: 'UUID of the branch where the application is being created',
  })
  @IsString()
  branchId!: string;

  @ApiProperty({
    example: 500000,
    description: 'Requested loan amount in paisa (1 INR = 100 paisa)',
  })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  requestedAmountPaisa!: number;

  @ApiProperty({
    example: 24,
    description: 'Requested loan tenure in months',
  })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  requestedTenureMonths!: number;
}
