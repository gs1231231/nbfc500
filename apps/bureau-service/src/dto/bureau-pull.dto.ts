import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BureauType } from '@prisma/client';

export class BureauPullDto {
  @ApiProperty({
    description: 'UUID of the loan application for which to pull the bureau report',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiPropertyOptional({
    description:
      'Preferred bureau to query. Defaults to CIBIL if not supplied.',
    enum: BureauType,
    example: BureauType.CIBIL,
    default: BureauType.CIBIL,
  })
  @IsOptional()
  @IsEnum(BureauType)
  bureauPreference?: BureauType = BureauType.CIBIL;
}

export class GetReportParamsDto {
  @ApiProperty({
    description: 'UUID of the loan application',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;
}

export class BureauPullRequestDto {
  @ApiProperty({
    description: 'UUID of the organization (tenant)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  orgId!: string;

  @ApiProperty({
    description: 'UUID of the loan application for which to pull the bureau report',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiPropertyOptional({
    description: 'Preferred bureau to query. Defaults to CIBIL.',
    enum: BureauType,
    example: BureauType.CIBIL,
    default: BureauType.CIBIL,
  })
  @IsOptional()
  @IsEnum(BureauType)
  bureauPreference?: BureauType = BureauType.CIBIL;

  @ApiPropertyOptional({
    description: 'Organization ID from request header (set by controller)',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
