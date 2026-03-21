import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { KycStatus, Gender, EmploymentType } from '@prisma/client';
import {
  MockAadhaarEkycAdapter,
  IAadhaarEkycAdapter,
} from '@bankos/common';
import { encrypt } from '../customer/crypto.util';
import { VerifyOtpDto } from './dto/verify-otp.dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

function mapGender(raw: 'M' | 'F' | 'T'): Gender {
  if (raw === 'F') return Gender.FEMALE;
  if (raw === 'T') return Gender.OTHER;
  return Gender.MALE;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);
  private readonly aadhaarAdapter: IAadhaarEkycAdapter;

  constructor(private readonly prisma: PrismaService) {
    this.aadhaarAdapter = new MockAadhaarEkycAdapter();
  }

  // ─── 1. Initiate Aadhaar OTP ─────────────────────────────────────────────

  async initiateAadhaarOtp(
    _orgId: string,
    aadhaarNumber: string,
  ): Promise<{ txnId: string; maskedAadhaar: string }> {
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestException('Aadhaar number must be exactly 12 digits');
    }

    const otpResponse = await this.aadhaarAdapter.sendOtp(aadhaarNumber);

    if (!otpResponse.success) {
      throw new BadRequestException(
        otpResponse.message || 'Failed to send OTP',
      );
    }

    this.logger.log(
      `Aadhaar OTP initiated — txnId: ${otpResponse.txnId} | masked: ${maskAadhaar(aadhaarNumber)}`,
    );

    return {
      txnId: otpResponse.txnId,
      maskedAadhaar: maskAadhaar(aadhaarNumber),
    };
  }

  // ─── 2. Verify OTP and Create Lead ───────────────────────────────────────

  async verifyOtpAndCreateLead(
    orgId: string,
    dto: VerifyOtpDto,
  ): Promise<{
    customer: Record<string, unknown>;
    application: Record<string, unknown>;
    isExisting: boolean;
  }> {
    // Step A — verify OTP via adapter
    const verifyResponse = await this.aadhaarAdapter.verifyOtp(
      dto.txnId,
      dto.otp,
      dto.aadhaarNumber,
    );

    if (!verifyResponse.success) {
      throw new UnauthorizedException(
        verifyResponse.message || 'Invalid OTP',
      );
    }

    // Step B — fetch eKYC data
    const ekycResponse = await this.aadhaarAdapter.getEkycData(
      dto.txnId,
      dto.aadhaarNumber,
    );

    if (!ekycResponse.success || !ekycResponse.ekycData) {
      throw new BadRequestException(
        ekycResponse.message || 'Failed to fetch eKYC data',
      );
    }

    const ekyc = ekycResponse.ekycData;

    // Step C — validate product and branch belong to org
    const [product, branch] = await Promise.all([
      this.prisma.loanProduct.findFirst({
        where: { id: dto.productId, organizationId: orgId, isActive: true, deletedAt: null },
      }),
      this.prisma.branch.findFirst({
        where: { id: dto.branchId, organizationId: orgId, isActive: true, deletedAt: null },
      }),
    ]);

    if (!product) {
      throw new BadRequestException(
        `Loan product ${dto.productId} not found or inactive for this organisation`,
      );
    }
    if (!branch) {
      throw new BadRequestException(
        `Branch ${dto.branchId} not found or inactive for this organisation`,
      );
    }

    // Step D — dedupe check: does a customer with this Aadhaar (encrypted) already exist?
    const encryptedAadhaar = encrypt(dto.aadhaarNumber);

    // Encrypted values cannot be queried via LIKE — we search by last-4 pattern
    // and then compare decrypted values in application code.
    // As an optimisation we also check if any customer has the same Aadhaar suffix.
    // For this mock we rely on the encrypted column being deterministic in value (it's not —
    // AES-CBC uses a random IV per call). So we perform a dedupe by scanning customers
    // whose aadhaarNumber is not null and comparing the raw last-4 digits stored in fullName
    // would not work. Instead we use a separate index column approach:
    // The simplest safe approach here is to use the last-4 suffix stored separately,
    // but the schema does not have that column yet.  We therefore fall back to a
    // full-table scan of aadhaarNumber-not-null customers for the org and
    // decrypt+compare in memory — acceptable for a mock/MVP scenario.
    let existingCustomer = await this.findCustomerByAadhaar(
      orgId,
      dto.aadhaarNumber,
    );

    let isExisting = false;
    let customer: Record<string, unknown>;

    if (existingCustomer) {
      isExisting = true;
      customer = this.safeSerializeCustomer(existingCustomer);
      this.logger.log(
        `Dedupe hit — existing customer ${existingCustomer.customerNumber} for org ${orgId}`,
      );
    } else {
      // Step E — create new Customer
      const customerNumber = await this.generateCustomerNumber(orgId);

      // Parse name from eKYC: "Ramesh Kumar Sharma" => firstName + lastName
      const nameParts = ekyc.name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? ekyc.name;
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1]! : '';
      const middleName = nameParts.length > 2
        ? nameParts.slice(1, -1).join(' ')
        : undefined;

      const addr = ekyc.address;
      const addressLine1 = [addr.house, addr.street].filter(Boolean).join(', ');
      const addressLine2 = [addr.location, addr.postOffice].filter(Boolean).join(', ');

      const created = await this.prisma.customer.create({
        data: {
          organizationId: orgId,
          customerNumber,
          customerType: 'INDIVIDUAL',
          firstName,
          middleName,
          lastName,
          fullName: ekyc.name,
          dateOfBirth: new Date(ekyc.dateOfBirth),
          gender: mapGender(ekyc.gender),
          panNumber: '', // PAN not available from Aadhaar eKYC; set to empty — schema requires non-null
          aadhaarNumber: encryptedAadhaar,
          currentAddressLine1: addressLine1 || undefined,
          currentAddressLine2: addressLine2 || undefined,
          currentCity: addr.district,
          currentState: addr.state,
          currentPincode: addr.pincode,
          phone: `9999999999`, // eKYC returns masked phone; placeholder until real flow
          employmentType: EmploymentType.SALARIED, // default; borrower can update later
          kycStatus: KycStatus.VERIFIED,
        },
      });

      existingCustomer = created;
      customer = this.safeSerializeCustomer(created);

      this.logger.log(
        `New customer created: ${customerNumber} (org: ${orgId})`,
      );
    }

    // Step F — create LoanApplication with status = LEAD
    const applicationNumber = await this.generateApplicationNumber(
      orgId,
      dto.productId,
    );

    const application = await this.prisma.loanApplication.create({
      data: {
        organizationId: orgId,
        branchId: dto.branchId,
        applicationNumber,
        customerId: existingCustomer.id,
        productId: dto.productId,
        requestedAmountPaisa: dto.requestedAmountPaisa,
        requestedTenureMonths: dto.requestedTenureMonths,
        status: 'LEAD',
        sourceType: 'WEB',
      },
      include: {
        product: { select: { name: true, code: true, productType: true } },
        branch: { select: { name: true, code: true } },
        customer: { select: { customerNumber: true, fullName: true } },
      },
    });

    this.logger.log(
      `Lead created: ${applicationNumber} for customer ${existingCustomer.customerNumber}`,
    );

    return {
      customer,
      application: this.safeSerializeApplication(application),
      isExisting,
    };
  }

  // ─── 3. Get Lead Status ───────────────────────────────────────────────────

  async getLeadStatus(orgId: string, applicationId: string) {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: {
        customer: true,
        product: { select: { name: true, code: true, productType: true } },
        branch: { select: { name: true, code: true } },
      },
    });

    if (!application) {
      throw new BadRequestException(
        `Application ${applicationId} not found for this organisation`,
      );
    }

    return {
      application: this.safeSerializeApplication(application),
      customer: application.customer
        ? this.safeSerializeCustomer(application.customer)
        : null,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find a customer by raw Aadhaar number.
   * Because AES-CBC uses a random IV, each encrypt() call produces a different
   * ciphertext. We cannot do a direct DB equality check. Instead we fetch all
   * customers with a non-null aadhaarNumber for the org and decrypt+compare.
   * This is acceptable for a mock/MVP; production should use a deterministic
   * HMAC index column instead.
   */
  private async findCustomerByAadhaar(
    orgId: string,
    aadhaarNumber: string,
  ) {
    const { decrypt } = await import('../customer/crypto.util');
    const candidates = await this.prisma.customer.findMany({
      where: {
        organizationId: orgId,
        aadhaarNumber: { not: null },
        deletedAt: null,
      },
    });

    for (const c of candidates) {
      if (!c.aadhaarNumber) continue;
      try {
        const decrypted = decrypt(c.aadhaarNumber);
        if (decrypted === aadhaarNumber) return c;
      } catch {
        // ignore decrypt errors for malformed entries
      }
    }
    return null;
  }

  /** Generates ORG/CUST/NNNNNN — mirrors CustomerService.generateCustomerNumber */
  private async generateCustomerNumber(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { code: true },
    });
    const orgCode = org?.code ?? 'ORG';
    const count = await this.prisma.customer.count({
      where: { organizationId: orgId },
    });
    const sequence = String(count + 1).padStart(6, '0');
    return `${orgCode}/CUST/${sequence}`;
  }

  /** Generates ORG/PROD/YYYY/NNNNNN — mirrors ApplicationService.generateApplicationNumber */
  private async generateApplicationNumber(
    orgId: string,
    productId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const [org, product, count] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      this.prisma.loanProduct.findUniqueOrThrow({ where: { id: productId } }),
      this.prisma.loanApplication.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: yearStart, lt: yearEnd },
        },
      }),
    ]);

    const sequence = String(count + 1).padStart(6, '0');
    return `${org.code}/${product.code}/${year}/${sequence}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private safeSerializeCustomer(c: any): Record<string, unknown> {
    // Omit raw encrypted fields; expose masked aadhaar
    const { panNumber: _pan, aadhaarNumber: _aadhaar, ...rest } = c;
    return {
      ...rest,
      maskedAadhaar: _aadhaar ? `XXXX-XXXX-****` : undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private safeSerializeApplication(app: any): Record<string, unknown> {
    return {
      ...app,
      requestedAmount: app.requestedAmountPaisa / 100,
    };
  }
}
