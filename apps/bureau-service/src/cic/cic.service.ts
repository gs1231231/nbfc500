import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { BureauType, LoanStatus, ProductType } from '@prisma/client';

/** Number of months within which a closed loan is still reportable */
const CLOSED_LOAN_REPORTING_WINDOW_MONTHS = 36;

/**
 * Maps Prisma ProductType enum to TUEF product type codes.
 * Reference: CIBIL data dictionary v3.1
 */
const PRODUCT_TYPE_CODE_MAP: Record<ProductType, string> = {
  PERSONAL_LOAN: '05',
  BUSINESS_LOAN: '51',
  VEHICLE_FINANCE: '08',
  LAP: '10',
  HOME_LOAN: '01',
  GOLD_LOAN: '12',
  EDUCATION_LOAN: '07',
  MSME_LOAN: '51',
  SUPPLY_CHAIN_FINANCE: '54',
  MICROFINANCE: '59',
};

/** Simplified TUEF fixed-width field widths (in characters) */
const FIELD_WIDTHS = {
  SEGMENT_TAG: 2,
  MEMBER_ID: 10,
  DATE: 8,
  RECORD_COUNT: 6,
  FULL_NAME: 26,
  DOB: 8,
  PAN: 10,
  ADDRESS: 40,
  CITY: 20,
  STATE: 2,
  PINCODE: 6,
  LOAN_NUMBER: 20,
  PRODUCT_CODE: 2,
  AMOUNT: 9,
  EMI: 9,
  DPD: 3,
};

/**
 * Result of a CIBIL submission generation.
 */
export interface CicSubmissionResult {
  recordCount: number;
  validationErrors: CicValidationError[];
  fileContent: string;
  month: number;
  year: number;
  bureauType: BureauType;
  generatedAt: string;
}

export interface CicValidationError {
  loanId: string;
  loanNumber: string;
  field: string;
  message: string;
}

/**
 * Stored record for listing past submissions.
 */
export interface SubmissionRecord {
  id: string;
  orgId: string;
  bureauType: BureauType;
  month: number;
  year: number;
  recordCount: number;
  validationErrorCount: number;
  generatedAt: string;
  filePreview: string;
}

/** In-memory store for past submissions (scoped to process lifetime) */
const submissionLog: SubmissionRecord[] = [];

/**
 * Pad a string to the specified width, truncating if necessary.
 * Left-pads numbers, right-pads strings.
 */
function padField(value: string | number, width: number, numeric = false): string {
  const str = String(value ?? '');
  if (numeric) {
    return str.slice(0, width).padStart(width, '0');
  }
  return str.slice(0, width).padEnd(width, ' ');
}

/**
 * Format a Date as DDMMYYYY for TUEF output.
 */
function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString();
  return `${d}${m}${y}`;
}

/**
 * Convert paisa (integer) to rupees rounded to the nearest rupee.
 */
function paisaToRupees(paisa: number | bigint): number {
  return Math.round(Number(paisa) / 100);
}

/**
 * CicService — generates TUEF-format data submission files for credit bureaus.
 *
 * TUEF (Trans Union Enquiry Format) is a fixed-width ASCII format used by
 * CIBIL for member data submissions. This implementation produces a simplified
 * version suitable for NBFC data reporting.
 */
@Injectable()
export class CicService {
  private readonly logger = new Logger(CicService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a TUEF-format submission file for all active and recently closed
   * loans belonging to the given organization.
   *
   * Includes loans that are:
   *  - Currently ACTIVE
   *  - CLOSED within the last 36 months
   *
   * File format:
   *  - Line 1: Header (TUEF header with member ID, date, record count)
   *  - Lines 2..N: One TUEF record per loan (borrower segment + account segment)
   *
   * @param orgId       Organization (tenant) UUID
   * @param bureauType  Which bureau this file is intended for
   * @param month       Submission month (1-12)
   * @param year        Submission year (YYYY)
   */
  async generateSubmission(
    orgId: string,
    bureauType: BureauType,
    month: number,
    year: number,
  ): Promise<CicSubmissionResult> {
    this.logger.log(
      `Generating ${bureauType} submission for org ${orgId}, period ${month}/${year}`,
    );

    // Determine the cutoff date for recently-closed loans
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - CLOSED_LOAN_REPORTING_WINDOW_MONTHS);

    // Fetch qualifying loans with customer and product info
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { loanStatus: LoanStatus.ACTIVE },
          {
            loanStatus: {
              in: [
                LoanStatus.CLOSED,
                LoanStatus.FORECLOSED,
                LoanStatus.SETTLED,
                LoanStatus.WRITTEN_OFF,
              ],
            },
            closureDate: { gte: cutoffDate },
          },
        ],
      },
      include: {
        customer: true,
        product: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(`Found ${loans.length} qualifying loans for submission`);

    const validationErrors: CicValidationError[] = [];
    const tuefRecords: string[] = [];

    for (const loan of loans) {
      const customer = loan.customer;
      const loanErrors: CicValidationError[] = [];

      // ----- Validate required fields -----
      if (!customer.panNumber || customer.panNumber.length !== 10) {
        loanErrors.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          field: 'panNumber',
          message: 'PAN number missing or invalid (must be 10 characters)',
        });
      }

      if (!customer.dateOfBirth) {
        loanErrors.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          field: 'dateOfBirth',
          message: 'Date of birth is required for TUEF submission',
        });
      }

      if (!customer.fullName) {
        loanErrors.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          field: 'fullName',
          message: 'Customer full name is required for TUEF submission',
        });
      }

      // Collect errors but continue building file — validator can decide what to omit
      validationErrors.push(...loanErrors);

      // ----- Build Borrower Name Segment (BN) -----
      const bnSegment = [
        padField('BN', FIELD_WIDTHS.SEGMENT_TAG),
        padField(customer.fullName ?? '', FIELD_WIDTHS.FULL_NAME),
        padField(
          customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '00000000',
          FIELD_WIDTHS.DOB,
          true,
        ),
        padField(customer.panNumber ?? '', FIELD_WIDTHS.PAN),
      ].join('');

      // ----- Build Borrower Address Segment (BA) -----
      const addressLine = [
        customer.currentAddressLine1 ?? customer.permanentAddressLine1 ?? '',
        customer.currentAddressLine2 ?? customer.permanentAddressLine2 ?? '',
      ]
        .filter(Boolean)
        .join(' ');

      const city =
        customer.currentCity ?? customer.permanentCity ?? '';
      const state =
        customer.currentState ?? customer.permanentState ?? '';
      const pincode =
        customer.currentPincode ?? customer.permanentPincode ?? '';

      const baSegment = [
        padField('BA', FIELD_WIDTHS.SEGMENT_TAG),
        padField(addressLine, FIELD_WIDTHS.ADDRESS),
        padField(city, FIELD_WIDTHS.CITY),
        padField(state.substring(0, 2).toUpperCase(), FIELD_WIDTHS.STATE),
        padField(pincode, FIELD_WIDTHS.PINCODE, true),
      ].join('');

      // ----- Build Account Segment (AC) -----
      const productCode =
        PRODUCT_TYPE_CODE_MAP[loan.product.productType] ?? '99';

      const currentBalancePaisa =
        loan.outstandingPrincipalPaisa + loan.outstandingInterestPaisa;

      const acSegment = [
        padField('AC', FIELD_WIDTHS.SEGMENT_TAG),
        padField(loan.loanNumber, FIELD_WIDTHS.LOAN_NUMBER),
        padField(productCode, FIELD_WIDTHS.PRODUCT_CODE),
        padField(formatDate(loan.disbursementDate), FIELD_WIDTHS.DATE),
        padField(paisaToRupees(loan.disbursedAmountPaisa), FIELD_WIDTHS.AMOUNT, true),
        padField(paisaToRupees(currentBalancePaisa), FIELD_WIDTHS.AMOUNT, true),
        padField(paisaToRupees(loan.totalOverduePaisa), FIELD_WIDTHS.AMOUNT, true),
        padField(paisaToRupees(loan.emiAmountPaisa), FIELD_WIDTHS.EMI, true),
        padField(loan.dpd, FIELD_WIDTHS.DPD, true),
        padField(loan.loanStatus, 12),
      ].join('');

      // Combine into one TUEF record per loan
      tuefRecords.push(`${bnSegment}${baSegment}${acSegment}`);
    }

    const recordCount = tuefRecords.length;
    const submissionDate = new Date();

    // ----- Build TUEF Header -----
    // Format: TH + member_id(10) + submission_date(8) + record_count(6)
    const memberId = padField(orgId.replace(/-/g, '').substring(0, 10), FIELD_WIDTHS.MEMBER_ID);
    const header = [
      'TH',
      memberId,
      formatDate(submissionDate),
      padField(recordCount, FIELD_WIDTHS.RECORD_COUNT, true),
      padField(bureauType, 10),
    ].join('');

    // ----- Assemble final file content -----
    const fileContent = [header, ...tuefRecords].join('\n');

    this.logger.log(
      `Generated ${bureauType} submission: ${recordCount} records, ` +
        `${validationErrors.length} validation errors`,
    );

    const result: CicSubmissionResult = {
      recordCount,
      validationErrors,
      fileContent,
      month,
      year,
      bureauType,
      generatedAt: submissionDate.toISOString(),
    };

    // Persist to in-memory log for listing later
    submissionLog.push({
      id: `${orgId}-${bureauType}-${year}-${month}-${Date.now()}`,
      orgId,
      bureauType,
      month,
      year,
      recordCount,
      validationErrorCount: validationErrors.length,
      generatedAt: submissionDate.toISOString(),
      filePreview: fileContent.substring(0, 200),
    });

    return result;
  }

  /**
   * List all past submissions generated for the given organization.
   * Returns an in-memory log (persisted for the lifetime of the process).
   *
   * @param orgId Organization (tenant) UUID
   */
  listSubmissions(orgId: string): SubmissionRecord[] {
    return submissionLog
      .filter((s) => s.orgId === orgId)
      .sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
      );
  }
}
