import { IsString, MinLength } from 'class-validator';

export class WaiveFeeDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
