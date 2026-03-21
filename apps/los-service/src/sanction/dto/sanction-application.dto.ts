import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SanctionApplicationDto {
  @ApiProperty({
    description: 'Sanctioned loan amount in paisa (1 INR = 100 paisa)',
    example: 50000000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sanctionedAmountPaisa!: number;

  @ApiProperty({
    description: 'Sanctioned loan tenure in months',
    example: 24,
    minimum: 1,
    maximum: 360,
  })
  @IsInt()
  @Min(1)
  sanctionedTenureMonths!: number;

  @ApiProperty({
    description:
      'Sanctioned annual interest rate in basis points (e.g. 1400 = 14%)',
    example: 1400,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  sanctionedInterestRateBps!: number;

  @ApiPropertyOptional({
    description:
      'List of sanction conditions that must be fulfilled before disbursement',
    example: [
      'Submit original PAN card',
      'Provide latest 3-month salary slips',
    ],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];
}
