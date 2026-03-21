import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class EvaluateApplicationDto {
  @ApiProperty({
    description: 'UUID of the loan application to evaluate',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;
}
