import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Stage sub-types ───────────────────────────────────────────────────────────

class AutoActionDto {
  @IsEnum(['NOTIFY', 'BUREAU_PULL', 'BRE_EVALUATE', 'ASSIGN'])
  type!: 'NOTIFY' | 'BUREAU_PULL' | 'BRE_EVALUATE' | 'ASSIGN';

  config: Record<string, unknown> = {};
}

export class WorkflowStageDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  displayOrder!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoActionDto)
  autoActions?: AutoActionDto[];

  @IsOptional()
  @IsEnum(['ROUND_ROBIN', 'SPECIFIC_USER', 'MANUAL', 'KEEP_CURRENT'])
  assignmentRule?: 'ROUND_ROBIN' | 'SPECIFIC_USER' | 'MANUAL' | 'KEEP_CURRENT';

  @IsOptional()
  @IsString()
  assignToRole?: string;

  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;

  @IsOptional()
  @IsBoolean()
  isTerminal?: boolean;
}

// ── Transition sub-types ──────────────────────────────────────────────────────

class TransitionConditionDto {
  @IsEnum(['DOCUMENTS_COMPLETE', 'BUREAU_COMPLETED', 'BRE_COMPLETED', 'CUSTOM_FIELD_FILLED', 'ALL_CONDITIONS_MET'])
  type!:
    | 'DOCUMENTS_COMPLETE'
    | 'BUREAU_COMPLETED'
    | 'BRE_COMPLETED'
    | 'CUSTOM_FIELD_FILLED'
    | 'ALL_CONDITIONS_MET';

  @IsOptional()
  config?: Record<string, unknown>;
}

export class WorkflowTransitionDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  @IsOptional()
  @IsString()
  requiredRole?: string;

  @IsOptional()
  @IsBoolean()
  requiresRemarks?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransitionConditionDto)
  conditions?: TransitionConditionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountLimit?: number;
}

// ── Top-level DTOs ────────────────────────────────────────────────────────────

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageDto)
  stages!: WorkflowStageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions!: WorkflowTransitionDto[];
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageDto)
  stages?: WorkflowStageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions?: WorkflowTransitionDto[];
}

export class TransitionApplicationDto {
  @IsString()
  toStage!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
