import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@bankos/common';

export class TransitionApplicationDto {
  @ApiProperty({
    description: 'Target status to transition the application to',
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLICATION,
  })
  @IsEnum(ApplicationStatus)
  toStatus!: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Optional remarks explaining the reason for this transition',
    example: 'Customer submitted all required documents',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  remarks?: string;
}
