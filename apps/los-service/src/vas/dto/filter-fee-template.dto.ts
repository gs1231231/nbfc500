import { IsOptional, IsString, IsBoolean, IsUUID, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { FEE_CATEGORIES, FEE_CODES } from './create-fee-template.dto';

export class FilterFeeTemplateDto {
  @IsOptional()
  @IsIn(FEE_CODES)
  feeCode?: string;

  @IsOptional()
  @IsIn(FEE_CATEGORIES)
  feeCategory?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  calculationType?: string;

  @IsOptional()
  @IsString()
  triggerEvent?: string;
}
