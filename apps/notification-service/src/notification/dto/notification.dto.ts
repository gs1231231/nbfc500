import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum NotificationChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

export class SendNotificationDto {
  @ApiProperty({
    description: 'UUID of the customer to notify',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({
    description: 'Delivery channel for the notification',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel!: NotificationChannel;

  @ApiProperty({
    description: 'Template code identifying the message template to use',
    example: 'emi_reminder',
    enum: ['emi_reminder', 'payment_received', 'loan_sanctioned'],
  })
  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @ApiPropertyOptional({
    description:
      'Key-value variables to interpolate into the template. ' +
      'Keys must match {{variable}} placeholders in the template.',
    example: {
      customerName: 'Ramesh Kumar',
      emiAmount: '5000',
      dueDate: '25-Mar-2026',
    },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
