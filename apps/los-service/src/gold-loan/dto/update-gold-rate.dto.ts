import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGoldRateDto {
  @ApiProperty({
    description: 'Gold rate per 10 grams in paisa',
    example: 600000,
  })
  @IsInt()
  @Min(1)
  ratePer10GramsPaisa!: number;

  @ApiPropertyOptional({
    description: 'Purity for which this rate applies',
    example: '22K',
    default: '22K',
  })
  @IsOptional()
  @IsString()
  purity?: string;

  @ApiPropertyOptional({
    description: 'Source of the rate (e.g. MCX, IBJA, Manual)',
    example: 'MCX',
  })
  @IsOptional()
  @IsString()
  source?: string;
}

export class ReleaseGoldDto {
  @ApiProperty({ description: 'User ID approving the gold release', example: 'uuid-user-id' })
  @IsString()
  @IsNotEmpty()
  approvedBy!: string;

  @ApiPropertyOptional({ description: 'Remarks for the release', example: 'Loan closed, gold released to customer' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AuctionGoldDto {
  @ApiProperty({ description: 'Reserve price for auction in paisa', example: 5500000 })
  @IsInt()
  @Min(1)
  reservePricePaisa!: number;

  @ApiPropertyOptional({ description: 'Remarks for auction', example: 'NPA auction per RBI guidelines' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
