import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ApplicationStatus } from '@bankos/common';

export class FilterApplicationDto {
  @ApiPropertyOptional({
    description: 'Filter by application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.LEAD,
  })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Filter by loan product ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter by branch ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by DSA ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  dsaId?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned officer user ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date range - start (ISO 8601 UTC)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date range - end (ISO 8601 UTC)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  createdAtTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by minimum requested amount in paisa',
    example: 100000,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minAmountPaisa?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum requested amount in paisa',
    example: 10000000,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAmountPaisa?: number;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (last seen application ID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of records to return per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
