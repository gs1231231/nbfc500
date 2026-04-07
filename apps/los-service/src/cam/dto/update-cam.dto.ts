import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional } from 'class-validator';

export class UpdateCamDto {
  @ApiPropertyOptional({ description: 'Customer profile section', example: {} })
  @IsObject()
  @IsOptional()
  customerProfile?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Income assessment section', example: {} })
  @IsObject()
  @IsOptional()
  incomeAssessment?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Banking analysis section', example: {} })
  @IsObject()
  @IsOptional()
  bankingAnalysis?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Bureau analysis section', example: {} })
  @IsObject()
  @IsOptional()
  bureauAnalysis?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Obligation mapping section', example: {} })
  @IsObject()
  @IsOptional()
  obligationMapping?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Collateral assessment section', example: {} })
  @IsObject()
  @IsOptional()
  collateralAssessment?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Risk assessment section', example: {} })
  @IsObject()
  @IsOptional()
  riskAssessment?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'List of deviations noted', example: [] })
  @IsArray()
  @IsOptional()
  deviations?: unknown[];
}
