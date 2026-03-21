import {
  IsString,
  IsEnum,
  IsEmail,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsNotEmpty,
  ValidateIf,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  CustomerType,
  Gender,
  EmploymentType,
} from '@bankos/common';

export class CreateCustomerDto {
  @ApiPropertyOptional({
    enum: CustomerType,
    default: CustomerType.INDIVIDUAL,
    description: 'Type of customer entity',
  })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType = CustomerType.INDIVIDUAL;

  @ApiProperty({ example: 'Ravi', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional({ example: 'Kumar', description: 'Middle name' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ example: 'Sharma', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Date of birth in ISO 8601 format',
  })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender, description: 'Gender' })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({
    example: 'ABCDE1234F',
    description: 'PAN number (required if Aadhaar is not provided)',
  })
  @ValidateIf((o: CreateCustomerDto) => !o.aadhaarNumber)
  @IsNotEmpty({ message: 'At least one of PAN or Aadhaar is required' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'PAN must be in format ABCDE1234F',
  })
  panNumber?: string;

  @ApiPropertyOptional({
    example: '234567891234',
    description: 'Aadhaar number (12 digits, required if PAN is not provided)',
  })
  @ValidateIf((o: CreateCustomerDto) => !o.panNumber)
  @IsNotEmpty({ message: 'At least one of PAN or Aadhaar is required' })
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar must be exactly 12 digits' })
  aadhaarNumber?: string;

  @ApiPropertyOptional({
    example: 'ravi.sharma@example.com',
    description: 'Email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Mobile number (10 digits, starting with 6-9)',
  })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number',
  })
  phone!: string;

  @ApiPropertyOptional({
    example: '9123456780',
    description: 'Alternate mobile number',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Alternate phone must be a valid 10-digit Indian mobile number',
  })
  alternatePhone?: string;

  // Current address
  @ApiPropertyOptional({ example: '12, MG Road', description: 'Current address line 1' })
  @IsOptional()
  @IsString()
  currentAddressLine1?: string;

  @ApiPropertyOptional({ example: 'Near City Mall', description: 'Current address line 2' })
  @IsOptional()
  @IsString()
  currentAddressLine2?: string;

  @ApiPropertyOptional({ example: 'Mumbai', description: 'Current city' })
  @IsOptional()
  @IsString()
  currentCity?: string;

  @ApiPropertyOptional({ example: 'Maharashtra', description: 'Current state' })
  @IsOptional()
  @IsString()
  currentState?: string;

  @ApiPropertyOptional({ example: '400001', description: 'Current pincode (6 digits)' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{5}$/, { message: 'Pincode must be 6 digits' })
  currentPincode?: string;

  // Permanent address
  @ApiPropertyOptional({ example: '5, Laxmi Nagar', description: 'Permanent address line 1' })
  @IsOptional()
  @IsString()
  permanentAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Permanent address line 2' })
  @IsOptional()
  @IsString()
  permanentAddressLine2?: string;

  @ApiPropertyOptional({ example: 'Delhi', description: 'Permanent city' })
  @IsOptional()
  @IsString()
  permanentCity?: string;

  @ApiPropertyOptional({ example: 'Delhi', description: 'Permanent state' })
  @IsOptional()
  @IsString()
  permanentState?: string;

  @ApiPropertyOptional({ example: '110001', description: 'Permanent pincode (6 digits)' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{5}$/, { message: 'Pincode must be 6 digits' })
  permanentPincode?: string;

  @ApiProperty({ enum: EmploymentType, description: 'Employment type' })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiPropertyOptional({ example: 'HDFC Bank', description: 'Employer name' })
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Monthly income in paisa (1 INR = 100 paisa)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value !== undefined ? parseInt(value as string, 10) : undefined))
  monthlyIncomePaisa?: number;
}
