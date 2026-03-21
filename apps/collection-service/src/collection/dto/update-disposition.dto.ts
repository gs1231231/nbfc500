import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CollectionDisposition } from '@prisma/client';

export class UpdateDispositionDto {
  @IsEnum(CollectionDisposition)
  disposition!: CollectionDisposition;

  /** Promise-to-pay date — required when disposition is PTP */
  @IsOptional()
  @IsDateString()
  ptpDate?: string;

  /** Promise-to-pay amount in paisa — required when disposition is PTP */
  @IsOptional()
  @IsInt()
  @Min(1)
  ptpAmountPaisa?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
