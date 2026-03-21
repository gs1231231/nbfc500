import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsInt,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { BreRuleCategory, BreRuleAction } from '@prisma/client';

export class CreateBreRuleDto {
  @ApiProperty({ description: 'UUID of the loan product this rule applies to' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Human-readable name of the rule', example: 'Minimum Bureau Score' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description of what the rule checks' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Rule category',
    enum: BreRuleCategory,
    example: BreRuleCategory.ELIGIBILITY,
  })
  @IsEnum(BreRuleCategory)
  category!: BreRuleCategory;

  @ApiProperty({
    description: 'Evaluation priority — lower number evaluated first',
    example: 10,
  })
  @IsInt()
  @Min(1)
  priority!: number;

  @ApiProperty({
    description:
      'Rule condition as JSON object with fields: field, operator, value. ' +
      'Operators: EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN, BETWEEN',
    example: { field: 'bureau.score', operator: 'GTE', value: 650 },
  })
  @IsObject()
  condition!: Record<string, unknown>;

  @ApiProperty({
    description: 'Action to take when the rule condition evaluates to false',
    enum: BreRuleAction,
    example: BreRuleAction.REJECT,
  })
  @IsEnum(BreRuleAction)
  action!: BreRuleAction;

  @ApiProperty({
    description: 'Human-readable reason message surfaced when the rule fails',
    example: 'Bureau score below minimum threshold of 650',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Whether this rule is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'ISO 8601 date from which this rule becomes effective',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 date when this rule expires (null = no expiry)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
