import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ForeCloseLoanDto {
  @IsDateString()
  closureDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
