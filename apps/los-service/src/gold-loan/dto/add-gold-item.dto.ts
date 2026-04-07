import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class AddGoldItemDto {
  @ApiProperty({
    description: 'Application ID this gold item belongs to',
    example: 'uuid-application-id',
  })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({
    description: 'Item sequence number within the application',
    example: 1,
  })
  @IsInt()
  @Min(1)
  itemNumber!: number;

  @ApiProperty({
    description: 'Type of gold item',
    example: 'NECKLACE',
    enum: ['CHAIN', 'NECKLACE', 'BANGLE', 'RING', 'COIN', 'BAR', 'EARRING', 'OTHER'],
  })
  @IsString()
  @IsNotEmpty()
  itemType!: string;

  @ApiPropertyOptional({ description: 'Description of the item', example: '22K gold necklace' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Gross weight in grams', example: 12.5 })
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  grossWeightGrams!: number;

  @ApiProperty({ description: 'Net weight in grams (gross minus stone weight)', example: 11.8 })
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  netWeightGrams!: number;

  @ApiProperty({ description: 'Purity in karats (e.g. 22)', example: 22.0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purityKarat!: number;

  @ApiProperty({ description: 'Purity as percentage (e.g. 91.6 for 22K)', example: 91.6 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purityPercentage!: number;

  @ApiPropertyOptional({ description: 'BIS hallmark number if present', example: 'BIS123456' })
  @IsOptional()
  @IsString()
  hallmarkNumber?: string;

  @ApiPropertyOptional({ description: 'Stone weight in grams', example: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stoneWeightGrams?: number;

  @ApiProperty({ description: 'Appraised value in paisa', example: 6000000 })
  @IsInt()
  @Min(0)
  appraisedValuePaisa!: number;

  @ApiPropertyOptional({ description: 'Seal/tag number affixed after custody', example: 'SEAL001' })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({ description: 'Packet/vault packet number', example: 'PKT-2026-001' })
  @IsOptional()
  @IsString()
  packetNumber?: string;

  @ApiPropertyOptional({ description: 'Branch ID where gold is held in custody', example: 'uuid-branch-id' })
  @IsOptional()
  @IsString()
  custodyBranchId?: string;

  @ApiPropertyOptional({ description: 'Date when gold was taken into custody', example: '2026-04-08T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  custodyInDate?: string;
}
