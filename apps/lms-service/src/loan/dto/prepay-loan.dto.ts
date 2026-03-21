import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class PrepayLoanDto {
  @IsDateString()
  prepaymentDate!: string;

  @IsNumber()
  @Min(0)
  penaltyPercent!: number;

  @IsOptional()
  @IsDateString()
  lastEmiDate?: string;
}
