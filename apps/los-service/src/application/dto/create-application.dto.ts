import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType } from '@bankos/common';

export class CreateApplicationDto {
  @ApiProperty({
    description: 'Branch ID where the application is being created',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({
    description: 'Customer ID for whom the application is being created',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({
    description: 'Loan product ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: 'Requested loan amount in paisa (1 INR = 100 paisa)',
    example: 500000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  requestedAmountPaisa!: number;

  @ApiProperty({
    description: 'Requested loan tenure in months',
    example: 24,
    minimum: 1,
    maximum: 360,
  })
  @IsInt()
  @Min(1)
  @Max(360)
  requestedTenureMonths!: number;

  @ApiPropertyOptional({
    description: 'Source type for this application',
    enum: SourceType,
    example: SourceType.BRANCH,
  })
  @IsEnum(SourceType)
  @IsOptional()
  sourceType?: SourceType;

  @ApiPropertyOptional({
    description: 'DSA ID if application sourced through a DSA',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  dsaId?: string;

  @ApiPropertyOptional({
    description: 'User ID of the officer assigned to this application',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;
}
