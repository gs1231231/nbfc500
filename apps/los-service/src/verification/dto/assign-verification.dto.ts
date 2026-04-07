import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignVerificationDto {
  @ApiProperty({ description: 'Agent or user ID to assign verification to', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  agentId!: string;
}
