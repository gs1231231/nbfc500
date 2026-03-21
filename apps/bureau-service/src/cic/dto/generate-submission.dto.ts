import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
} from 'class-validator';
import { BureauType } from '@prisma/client';

export class GenerateSubmissionDto {
  @ApiProperty({
    description: 'Bureau to submit data to',
    enum: BureauType,
    example: BureauType.CIBIL,
  })
  @IsEnum(BureauType)
  @IsNotEmpty()
  bureauType!: BureauType;

  @ApiProperty({
    description: 'Month of submission (1-12)',
    example: 3,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    description: 'Year of submission (e.g. 2026)',
    example: 2026,
    minimum: 2000,
    maximum: 2100,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
