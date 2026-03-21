import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountPaisa!: number;

  @IsDateString()
  paymentDate!: string;

  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
