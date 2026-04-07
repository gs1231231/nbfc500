import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { IsEnum, IsObject } from 'class-validator';
import { DocaiService, DocumentType } from './docai.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class ExtractDocumentDto {
  @IsEnum(['PAN_CARD', 'AADHAAR_FRONT', 'SALARY_SLIP', 'BANK_STATEMENT'])
  documentType!: DocumentType;
}

class CrossValidateDto {
  @IsObject()
  extractedData!: Record<string, unknown>;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/v1/document-ai')
@UseGuards(JwtAuthGuard, OrgGuard)
export class DocaiController {
  constructor(private readonly docaiService: DocaiService) {}

  /**
   * POST /api/v1/document-ai/extract/:documentId
   * Run mock OCR extraction on a document.
   */
  @Post('extract/:documentId')
  @HttpCode(HttpStatus.OK)
  async extract(
    @Param('documentId') documentId: string,
    @Body() dto: ExtractDocumentDto,
  ) {
    return this.docaiService.extractFields(documentId, dto.documentType);
  }

  /**
   * POST /api/v1/document-ai/validate/:customerId
   * Cross-validate extracted fields against the customer record.
   */
  @Post('validate/:customerId')
  @HttpCode(HttpStatus.OK)
  async validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: CrossValidateDto,
  ) {
    return this.docaiService.crossValidate(user.orgId, customerId, dto.extractedData);
  }

  /**
   * POST /api/v1/document-ai/fraud-check/:applicationId
   * Run fraud detection checks on all documents of an application.
   */
  @Post('fraud-check/:applicationId')
  @HttpCode(HttpStatus.OK)
  async fraudCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.docaiService.detectFraud(user.orgId, applicationId);
  }
}
