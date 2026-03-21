import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@bankos/common';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Customer ID who owns this document',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({
    description: 'Type of document being uploaded',
    enum: DocumentType,
    example: DocumentType.PAN_CARD,
  })
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType!: DocumentType;

  @ApiProperty({
    description: 'Original file name',
    example: 'pan_card.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 204800,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  fileSizeBytes!: number;
}
