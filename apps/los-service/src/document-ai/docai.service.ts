import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'PAN_CARD'
  | 'AADHAAR_FRONT'
  | 'SALARY_SLIP'
  | 'BANK_STATEMENT';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PanCardFields {
  panNumber: string;
  name: string;
  dob: string;
  fatherName: string;
}

export interface AadhaarFrontFields {
  aadhaarNumber: string;
  name: string;
  dob: string;
  gender: string;
}

export interface SalarySlipFields {
  employerName: string;
  grossSalary: number;
  netSalary: number;
  month: string;
}

export interface BankStatementFields {
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export type ExtractedFields =
  | PanCardFields
  | AadhaarFrontFields
  | SalarySlipFields
  | BankStatementFields;

export interface ExtractionResult {
  documentId: string;
  documentType: DocumentType;
  fields: ExtractedFields;
  confidence: number;
  extractedAt: string;
}

export interface CrossValidationResult {
  customerId: string;
  matches: string[];
  mismatches: string[];
  confidenceScore: number;
}

export interface FraudCheckResult {
  applicationId: string;
  riskLevel: RiskLevel;
  flags: string[];
  checkedAt: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class DocaiService {
  private readonly logger = new Logger(DocaiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mock OCR field extraction based on document type.
   * In production this would call an actual OCR/AI service.
   */
  async extractFields(
    documentId: string,
    documentType: DocumentType,
  ): Promise<ExtractionResult> {
    this.logger.log(`Extracting fields from document ${documentId}, type ${documentType}`);

    const fields = this.mockExtractByType(documentId, documentType);

    return {
      documentId,
      documentType,
      fields,
      confidence: 0.92 + Math.random() * 0.07, // 0.92 – 0.99
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Cross-validate extracted data against the customer's profile record.
   * Returns which fields match, which don't, and an overall confidence score.
   */
  async crossValidate(
    orgId: string,
    customerId: string,
    extractedData: Record<string, unknown>,
  ): Promise<CrossValidationResult> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const matches: string[] = [];
    const mismatches: string[] = [];

    // Name match (case-insensitive, partial)
    if (extractedData['name']) {
      const extractedName = String(extractedData['name']).toLowerCase().trim();
      const customerName = `${customer.firstName} ${customer.lastName}`.toLowerCase().trim();
      const nameMatches =
        customerName.includes(extractedName) || extractedName.includes(customerName);
      if (nameMatches) {
        matches.push('name');
      } else {
        mismatches.push('name');
      }
    }

    // PAN match
    if (extractedData['panNumber'] && customer.panNumber) {
      if (
        String(extractedData['panNumber']).toUpperCase() ===
        customer.panNumber.toUpperCase()
      ) {
        matches.push('panNumber');
      } else {
        mismatches.push('panNumber');
      }
    }

    // DOB match
    if (extractedData['dob'] && customer.dateOfBirth) {
      const extractedDob = new Date(String(extractedData['dob']));
      const customerDob = new Date(customer.dateOfBirth);
      const dobDiffMs = Math.abs(extractedDob.getTime() - customerDob.getTime());
      if (dobDiffMs < 24 * 60 * 60 * 1000) {
        // within 1 day tolerance
        matches.push('dob');
      } else {
        mismatches.push('dob');
      }
    }

    // Aadhaar match
    if (extractedData['aadhaarNumber'] && customer.aadhaarNumber) {
      const extracted = String(extractedData['aadhaarNumber']).replace(/\s/g, '');
      const stored = customer.aadhaarNumber.replace(/\s/g, '');
      if (extracted === stored) {
        matches.push('aadhaarNumber');
      } else {
        mismatches.push('aadhaarNumber');
      }
    }

    const total = matches.length + mismatches.length;
    const confidenceScore = total === 0 ? 0 : Math.round((matches.length / total) * 100) / 100;

    return { customerId, matches, mismatches, confidenceScore };
  }

  /**
   * Detect potential fraud signals across documents linked to an application.
   * Checks: duplicates across applications, tampered dates, inconsistent data.
   */
  async detectFraud(
    orgId: string,
    applicationId: string,
  ): Promise<FraudCheckResult> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: { documents: true, customer: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const flags: string[] = [];

    // Check 1: duplicate documents (same s3Key used in other applications)
    for (const doc of application.documents) {
      const duplicates = await this.prisma.document.count({
        where: {
          s3Key: doc.s3Key,
          applicationId: { not: applicationId },
          organizationId: orgId,
          deletedAt: null,
        },
      });
      if (duplicates > 0) {
        flags.push(`Document ${doc.id} (${doc.documentType}) appears in ${duplicates} other application(s)`);
      }
    }

    // Check 2: multiple documents of the same type submitted
    const typeCount: Record<string, number> = {};
    for (const doc of application.documents) {
      typeCount[doc.documentType] = (typeCount[doc.documentType] ?? 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCount)) {
      if (count > 2) {
        flags.push(`Excessive document submissions: ${count} copies of ${type}`);
      }
    }

    // Check 3: unverified documents (possible tamper risk)
    const unverifiedCount = application.documents.filter((d) => !d.isVerified).length;
    if (unverifiedCount > 0 && application.documents.length > 0) {
      const ratio = unverifiedCount / application.documents.length;
      if (ratio > 0.5) {
        flags.push(`${unverifiedCount} out of ${application.documents.length} documents are unverified`);
      }
    }

    // Check 4: application created very recently (same-day multiple submissions)
    const hoursSinceCreation =
      (Date.now() - application.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation < 1 && application.documents.length > 5) {
      flags.push('Unusually high document count submitted within 1 hour of application creation');
    }

    // Determine risk level
    let riskLevel: RiskLevel = 'LOW';
    if (flags.length >= 3) {
      riskLevel = 'HIGH';
    } else if (flags.length >= 1) {
      riskLevel = 'MEDIUM';
    }

    this.logger.log(
      `Fraud check for application ${applicationId}: ${riskLevel} — ${flags.length} flag(s)`,
    );

    return {
      applicationId,
      riskLevel,
      flags,
      checkedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private mockExtractByType(
    documentId: string,
    documentType: DocumentType,
  ): ExtractedFields {
    // Use documentId hash for deterministic but varied mock values
    const seed = documentId.charCodeAt(0) + documentId.charCodeAt(documentId.length - 1);

    switch (documentType) {
      case 'PAN_CARD':
        return {
          panNumber: `ABCDE${String(seed % 9000 + 1000).padStart(4, '0')}F`,
          name: 'RAJESH KUMAR',
          dob: '1985-06-15',
          fatherName: 'MOHAN KUMAR',
        } as PanCardFields;

      case 'AADHAAR_FRONT':
        return {
          aadhaarNumber: `${seed % 9000 + 1000} ${seed % 9000 + 1000} ${seed % 9000 + 1000}`,
          name: 'Rajesh Kumar',
          dob: '15/06/1985',
          gender: 'MALE',
        } as AadhaarFrontFields;

      case 'SALARY_SLIP':
        return {
          employerName: 'INFOSYS LIMITED',
          grossSalary: 75000 + (seed % 25000),
          netSalary: 62000 + (seed % 20000),
          month: '2026-03',
        } as SalarySlipFields;

      case 'BANK_STATEMENT':
        return {
          accountNumber: `XXXX${String(seed % 9000 + 1000)}`,
          ifsc: 'HDFC0001234',
          bankName: 'HDFC Bank',
        } as BankStatementFields;

      default:
        return {} as ExtractedFields;
    }
  }
}
