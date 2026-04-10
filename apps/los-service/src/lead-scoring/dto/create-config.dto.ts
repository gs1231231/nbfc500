import { IsString, IsBoolean, IsOptional, IsInt, IsArray, Min, Max } from 'class-validator';

export class CreateLeadScoreConfigDto {
  @IsString()
  configName!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  totalMaxScore?: number;

  @IsArray()
  factors!: object[];

  @IsArray()
  grades!: object[];

  @IsOptional()
  autoAssignGrades?: Record<string, string>;

  @IsOptional()
  autoNotifyGrades?: Record<string, string[]>;
}
