import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsObject } from 'class-validator';

export class SimulateDto {
  @ApiProperty({
    description: 'UUID of the loan product to simulate rules against',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description:
      'Flat evaluation context with field-value pairs to test against rules. ' +
      'Supported fields: customer.age, bureau.score, bureau.totalEmiPaisa, ' +
      'bureau.hasWriteOff, bureau.maxDpdLast12Months, bureau.enquiriesLast3Months, ' +
      'application.requestedAmountPaisa, calculated.proposedEmiPaisa, calculated.foir',
    example: {
      'customer.age': 32,
      'bureau.score': 720,
      'bureau.totalEmiPaisa': 500000,
      'bureau.hasWriteOff': false,
      'bureau.maxDpdLast12Months': 0,
      'bureau.enquiriesLast3Months': 2,
      'application.requestedAmountPaisa': 50000000,
      'calculated.proposedEmiPaisa': 120000,
      'calculated.foir': 42.5,
    },
  })
  @ApiPropertyOptional()
  @IsObject()
  testContext!: Record<string, number | string | boolean>;
}
