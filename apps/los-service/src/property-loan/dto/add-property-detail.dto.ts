import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class AddPropertyDetailDto {
  @ApiProperty({ description: 'Application ID this property belongs to', example: 'uuid-application-id' })
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({
    description: 'Type of property',
    example: 'RESIDENTIAL_FLAT',
    enum: ['RESIDENTIAL_FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL', 'INDUSTRIAL'],
  })
  @IsString()
  @IsNotEmpty()
  propertyType!: string;

  @ApiProperty({ description: 'Full address of the property', example: 'Flat 402, Sunrise Towers, Andheri East' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ description: 'City where property is located', example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ description: 'State where property is located', example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ description: 'PIN code', example: '400069' })
  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @ApiPropertyOptional({ description: 'Area in square feet', example: 850.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  areaSquareFeet?: number;

  @ApiPropertyOptional({ description: 'Market value in paisa', example: 500000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  marketValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Forced sale value in paisa (typically 70% of market value)', example: 350000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  forcedSaleValuePaisa?: number;

  @ApiPropertyOptional({ description: 'Property registration number', example: 'REG/2024/MH/001' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Name of title holder(s)', example: 'Rajesh Kumar' })
  @IsOptional()
  @IsString()
  titleHolder?: string;

  @ApiPropertyOptional({
    description: 'Title status',
    example: 'CLEAR',
    enum: ['CLEAR', 'DEFECTIVE', 'UNDER_DISPUTE'],
  })
  @IsOptional()
  @IsString()
  titleStatus?: string;

  @ApiPropertyOptional({ description: 'Is the property free of encumbrance?', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  encumbranceFree?: boolean;

  @ApiPropertyOptional({ description: 'Construction stage (for under-construction properties)', enum: ['NOT_STARTED', 'FOUNDATION', 'STRUCTURE', 'FINISHING', 'COMPLETED'] })
  @IsOptional()
  @IsString()
  constructionStage?: string;

  @ApiPropertyOptional({ description: 'Construction progress percentage (0-100)', example: 65 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  constructionProgress?: number;

  @ApiPropertyOptional({ description: 'Builder name (for under-construction properties)', example: 'Lodha Group' })
  @IsOptional()
  @IsString()
  builderName?: string;

  @ApiPropertyOptional({ description: 'Project name', example: 'Lodha Palava' })
  @IsOptional()
  @IsString()
  projectName?: string;
}

export class UpdateConstructionProgressDto {
  @ApiProperty({
    description: 'Construction stage',
    example: 'STRUCTURE',
    enum: ['NOT_STARTED', 'FOUNDATION', 'STRUCTURE', 'FINISHING', 'COMPLETED'],
  })
  @IsString()
  @IsNotEmpty()
  constructionStage!: string;

  @ApiProperty({ description: 'Construction progress percentage (0-100)', example: 65 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  constructionProgress!: number;
}
