import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ApplyDiscountDto {
  @IsInt()
  @Min(1)
  discountPaisa!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
