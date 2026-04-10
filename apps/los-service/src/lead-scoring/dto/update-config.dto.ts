import { IsString, IsBoolean, IsOptional, IsInt, IsArray, Min, Max } from 'class-validator';

export class UpdateLeadScoreConfigDto {
  @IsOptional()
  @IsString()
  configName?: string;

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

  @IsOptional()
  @IsArray()
  factors?: object[];

  @IsOptional()
  @IsArray()
  grades?: object[];

  @IsOptional()
  autoAssignGrades?: Record<string, string>;

  @IsOptional()
  autoNotifyGrades?: Record<string, string[]>;
}
