import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { BureauType } from '@prisma/client';
import {
  BureauAdapterConfig,
  BureauCustomerInput,
  BureauPullResult,
  IBureauAdapter,
} from '../interfaces/bureau-adapter.interface';

/**
 * CIBIL API request structure (TransUnion CIBIL v2.0).
 *
 * Production implementation will POST this as XML/JSON to:
 *   https://api.cibil.com/v2/creditreport
 *
 * Credentials are supplied via environment variables:
 *   CIBIL_MEMBER_ID, CIBIL_PASSWORD, CIBIL_SECURITY_CODE
 */
interface CibilEnquiryRequest {
  /** CIBIL-issued member ID (provided during empanelment) */
  memberId: string;
  /** Authentication password */
  password: string;
  /** CIBIL security code for the product */
  securityCode: string;
  enquiry: {
    /** Enquiry purpose code — 05 for loan origination */
    enquiryPurpose: '05' | '20' | '26';
    /** SOFT or HARD pull */
    enquiryType: 'S' | 'H';
    /** Amount being requested (in rupees — CIBIL API uses rupees) */
    enquiryAmountRupees: number;
    subject: {
      /** PAN of the applicant */
      panId: string;
      /** Full name as per PAN */
      fullName: string;
      /** Date of birth in DDMMYYYY format */
      dateOfBirth: string;
      /** 10-digit mobile number */
      phone: string;
      /** Email address (optional but improves match rate) */
      email?: string;
    };
    /** Unique reference number for idempotency */
    memberReferenceNumber: string;
  };
}

/**
 * CibilBureauAdapter — production adapter for TransUnion CIBIL.
 *
 * Currently a stub. Implement the `pull` method by:
 * 1. Building a CibilEnquiryRequest from the customer input.
 * 2. Sending a signed HTTP request to the CIBIL API endpoint.
 * 3. Parsing the XML/JSON response into a BureauPullResult.
 *
 * Reference: TransUnion CIBIL Commercial Bureau API v2.0 documentation.
 */
@Injectable()
export class CibilBureauAdapter implements IBureauAdapter {
  private readonly logger = new Logger(CibilBureauAdapter.name);

  /**
   * Build the CIBIL enquiry request payload from customer data.
   *
   * This method is separated to allow unit testing of request construction
   * without making live HTTP calls.
   */
  buildRequest(
    customer: BureauCustomerInput,
    config: BureauAdapterConfig,
    memberReferenceNumber: string,
  ): CibilEnquiryRequest {
    const memberId = process.env['CIBIL_MEMBER_ID'] ?? '';
    const password = process.env['CIBIL_PASSWORD'] ?? '';
    const securityCode = process.env['CIBIL_SECURITY_CODE'] ?? '';

    if (!memberId || !password || !securityCode) {
      throw new Error(
        'CIBIL credentials not configured. Set CIBIL_MEMBER_ID, CIBIL_PASSWORD, CIBIL_SECURITY_CODE env vars.',
      );
    }

    const dob = customer.dateOfBirth;
    const dd = String(dob.getDate()).padStart(2, '0');
    const mm = String(dob.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dob.getFullYear());
    const dobFormatted = `${dd}${mm}${yyyy}`;

    const pullTypeCode: 'S' | 'H' = config.pullType === 'SOFT' ? 'S' : 'H';

    return {
      memberId,
      password,
      securityCode,
      enquiry: {
        enquiryPurpose: '05',
        enquiryType: pullTypeCode,
        enquiryAmountRupees: 0, // Caller should override if amount is known
        subject: {
          panId: customer.panNumber.toUpperCase(),
          fullName: `${customer.firstName} ${customer.lastName}`.toUpperCase(),
          dateOfBirth: dobFormatted,
          phone: customer.phone,
          ...(customer.email ? { email: customer.email } : {}),
        },
        memberReferenceNumber,
      },
    };
  }

  /**
   * Pull a CIBIL credit report for the given customer.
   *
   * @throws NotImplementedException until the production integration is built.
   */
  async pull(
    customer: BureauCustomerInput,
    config: BureauAdapterConfig,
  ): Promise<BureauPullResult> {
    this.logger.warn(
      'CibilBureauAdapter.pull() called but is not yet implemented.',
    );

    // Demonstrate that request construction works (will throw if creds missing,
    // but the structure is validated)
    const _request = this.buildRequest(
      customer,
      config,
      `REF-${Date.now()}`,
    );

    // TODO: Implement the following steps for production:
    // 1. Serialize _request to CIBIL XML format (or JSON per API version)
    // 2. Sign the request with CIBIL-provided RSA key
    // 3. POST to config.baseUrl ?? 'https://api.cibil.com/v2/creditreport'
    //    with timeout = config.timeoutMs ?? 30_000
    // 4. Parse XML/JSON response into BureauPullResult
    // 5. Map CIBIL account types to internal account type strings
    // 6. Convert all amounts from rupees to paisa (* 100)
    // 7. Return structured BureauPullResult

    void _request; // suppress unused variable warning until implementation
    void BureauType; // used in return type below

    throw new NotImplementedException(
      'CIBIL bureau adapter is not yet implemented. Use BUREAU_ADAPTER=mock for development.',
    );
  }
}
