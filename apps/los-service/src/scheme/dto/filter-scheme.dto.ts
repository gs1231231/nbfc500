import { IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterSchemeDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  schemeType?: string;

  /**
   * current=true: only return schemes where validFrom <= now <= validTo
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  current?: boolean;
}
