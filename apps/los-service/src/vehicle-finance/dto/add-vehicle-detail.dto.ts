import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddVehicleDetailDto {
  @ApiProperty({ description: 'Application ID this vehicle belongs to', example: 'uuid-application-id' })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({
    description: 'Type of vehicle',
    example: 'CAR',
    enum: ['TWO_WHEELER', 'CAR', 'COMMERCIAL', 'TRACTOR', 'CONSTRUCTION'],
  })
  @IsString()
  @IsNotEmpty()
  vehicleType!: string;

  @ApiPropertyOptional({ description: 'Is this a new vehicle?', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isNewVehicle?: boolean;

  @ApiProperty({ description: 'Vehicle make / manufacturer', example: 'Maruti Suzuki' })
  @IsString()
  @IsNotEmpty()
  make!: string;

  @ApiProperty({ description: 'Vehicle model', example: 'Swift Dzire' })
  @IsString()
  @IsNotEmpty()
  model!: string;

  @ApiPropertyOptional({ description: 'Vehicle variant', example: 'VXI AMT' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiProperty({ description: 'Year of manufacture', example: 2026 })
  @IsInt()
  @Min(1950)
  @Type(() => Number)
  yearOfManufacture!: number;

  @ApiPropertyOptional({ description: 'Vehicle registration number', example: 'MH01AB1234' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Engine number', example: 'K12MENG123456' })
  @IsOptional()
  @IsString()
  engineNumber?: string;

  @ApiPropertyOptional({ description: 'Chassis number', example: 'MA3EWDE1S00123456' })
  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @ApiPropertyOptional({ description: 'Vehicle color', example: 'Arctic White' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Ex-showroom price in paisa', example: 75000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  exShowroomPaisa?: number;

  @ApiPropertyOptional({ description: 'On-road price in paisa (includes insurance, RTO, accessories)', example: 85000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  onRoadPricePaisa?: number;

  @ApiPropertyOptional({ description: 'Insurance declared value in paisa', example: 80000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  insuranceValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Dealer name', example: 'ABC Motors' })
  @IsOptional()
  @IsString()
  dealerName?: string;

  @ApiPropertyOptional({ description: 'Dealer code', example: 'DLR-MH-001' })
  @IsOptional()
  @IsString()
  dealerCode?: string;

  @ApiPropertyOptional({ description: 'Invoice number', example: 'INV/2026/001' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Invoice date', example: '2026-04-08T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;
}
