import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitReportDto {
  @ApiProperty({ description: 'Report data as JSON object', example: { findings: 'Address verified', result: 'POSITIVE' } })
  @IsObject()
  @IsNotEmpty()
  report!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Final verification outcome', example: 'POSITIVE', enum: ['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'] })
  @IsString()
  @IsOptional()
  outcome?: string;

  @ApiPropertyOptional({ description: 'Photos as array of S3 keys', example: ['s3://bucket/photo1.jpg'] })
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional({ description: 'Geo location of verification site', example: { lat: 28.6139, lng: 77.209 } })
  @IsObject()
  @IsOptional()
  geoLocation?: { lat: number; lng: number };

  @ApiPropertyOptional({ description: 'Any remarks or additional notes', example: 'Customer was present during visit' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
