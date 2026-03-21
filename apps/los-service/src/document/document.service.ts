import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Generates a mock S3 key for the document.
   * In production this would be a pre-signed S3 URL or the actual S3 object key.
   *
   * Format: {orgId}/{applicationId}/{documentType}/{timestamp}-{fileName}
   */
  private generateMockS3Key(
    orgId: string,
    applicationId: string,
    documentType: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${orgId}/${applicationId}/${documentType}/${timestamp}-${safeName}`;
  }

  // ============================================================
  // Service methods
  // ============================================================

  /**
   * Stores document metadata for a loan application.
   *
   * Skips actual S3 upload — generates a mock s3Key in the format:
   * {orgId}/{applicationId}/{documentType}/{timestamp}-{fileName}
   *
   * Validates:
   * 1. Application belongs to the organization and is not deleted.
   * 2. Customer belongs to the organization.
   */
  async uploadDocument(
    orgId: string,
    applicationId: string,
    dto: UploadDocumentDto,
  ) {
    // 1. Validate application exists and belongs to org
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found`,
      );
    }

    // 2. Validate customer belongs to org
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    // 3. Ensure the customer belongs to this application
    if (application.customerId !== dto.customerId) {
      throw new BadRequestException(
        `Customer ${dto.customerId} does not belong to application ${applicationId}`,
      );
    }

    // 4. Generate mock S3 key (skip actual S3 upload)
    const s3Key = this.generateMockS3Key(
      orgId,
      applicationId,
      dto.documentType,
      dto.fileName,
    );

    // 5. Create document record
    const document = await this.prisma.document.create({
      data: {
        organizationId: orgId,
        applicationId,
        customerId: dto.customerId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        s3Key,
        fileSizeBytes: dto.fileSizeBytes,
        isVerified: false,
      },
    });

    this.logger.log(
      `Uploaded document ${document.id} (${dto.documentType}) for application ${applicationId}`,
    );

    return document;
  }

  /**
   * Lists all non-deleted documents for a given loan application.
   */
  async listDocuments(orgId: string, applicationId: string) {
    // Validate application exists and belongs to org
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found`,
      );
    }

    const documents = await this.prisma.document.findMany({
      where: {
        applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: documents,
      total: documents.length,
    };
  }

  /**
   * Marks a document as verified.
   *
   * Validates:
   * 1. Application belongs to the organization.
   * 2. Document belongs to the application and is not already verified.
   */
  async verifyDocument(
    orgId: string,
    applicationId: string,
    docId: string,
    verifiedBy: string,
  ) {
    // 1. Validate application
    const application = await this.prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found`,
      );
    }

    // 2. Fetch document
    const document = await this.prisma.document.findFirst({
      where: {
        id: docId,
        applicationId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Document ${docId} not found for application ${applicationId}`,
      );
    }

    if (document.isVerified) {
      throw new BadRequestException(
        `Document ${docId} is already verified`,
      );
    }

    // 3. Mark as verified
    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(
      `Document ${docId} verified by ${verifiedBy} for application ${applicationId}`,
    );

    return updated;
  }
}
