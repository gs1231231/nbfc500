import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

/**
 * Controller for Document upload and verification on Loan Applications.
 *
 * All endpoints are scoped to a specific loan application (:id).
 * organizationId is passed via query param (TODO: replace with JWT auth).
 * verifiedBy is passed via query param (TODO: replace with JWT user ID).
 */
@ApiTags('Documents')
@Controller('api/v1/applications/:id/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ============================================================
  // POST /api/v1/applications/:id/documents
  // ============================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a document for a loan application',
    description:
      'Stores document metadata in the database. ' +
      'Actual S3 upload is skipped — a mock s3Key is generated in the format: ' +
      '{orgId}/{applicationId}/{documentType}/{timestamp}-{fileName}. ' +
      'Validates: application exists, customer belongs to application.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: UploadDocumentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Document metadata stored successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application or customer not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Customer does not belong to this application',
  })
  async uploadDocument(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.uploadDocument(orgId, applicationId, dto);
  }

  // ============================================================
  // GET /api/v1/applications/:id/documents
  // ============================================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List documents for a loan application',
    description:
      'Returns all non-deleted documents associated with the given loan application, ' +
      'ordered by creation date descending.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of documents for the application',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  async listDocuments(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.documentService.listDocuments(orgId, applicationId);
  }

  // ============================================================
  // POST /api/v1/applications/:id/documents/:docId/verify
  // ============================================================

  @Post(':docId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a document as verified',
    description:
      'Marks a document as verified, recording the verifier and timestamp. ' +
      'Fails if the document is already verified.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiParam({ name: 'docId', description: 'Document UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiQuery({
    name: 'verifiedBy',
    required: true,
    description: 'User ID of the officer verifying the document',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Document marked as verified',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application or document not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Document is already verified',
  })
  async verifyDocument(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Query('orgId') orgId: string,
    @Query('verifiedBy') verifiedBy: string,
  ) {
    return this.documentService.verifyDocument(orgId, applicationId, docId, verifiedBy);
  }
}
