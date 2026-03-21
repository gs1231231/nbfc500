import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApplicationDto {
  @ApiPropertyOptional({
    description: 'Updated requested loan amount in paisa (1 INR = 100 paisa)',
    example: 600000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  requestedAmountPaisa?: number;

  @ApiPropertyOptional({
    description: 'Updated requested loan tenure in months',
    example: 36,
    minimum: 1,
    maximum: 360,
  })
  @IsInt()
  @Min(1)
  @Max(360)
  @IsOptional()
  requestedTenureMonths?: number;

  @ApiPropertyOptional({
    description: 'User ID of the officer assigned to this application',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'DSA ID if application sourced through a DSA',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  dsaId?: string;

  @ApiPropertyOptional({
    description: 'Sanctioned loan amount in paisa',
    example: 490000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  sanctionedAmountPaisa?: number;

  @ApiPropertyOptional({
    description: 'Sanctioned loan tenure in months',
    example: 24,
    minimum: 1,
    maximum: 360,
  })
  @IsInt()
  @Min(1)
  @Max(360)
  @IsOptional()
  sanctionedTenureMonths?: number;

  @ApiPropertyOptional({
    description: 'Sanctioned interest rate in basis points (14% = 1400)',
    example: 1400,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  sanctionedInterestRateBps?: number;

  @ApiPropertyOptional({
    description: 'Reason for rejection (if applicable)',
    example: 'Low credit score',
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
