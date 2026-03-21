import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { isValidPan, isValidPhone, isValidAadhaar } from '@bankos/common';
import { KycStatus, Prisma } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { DedupeCustomerDto } from './dto/dedupe-customer.dto';
import { encrypt, decrypt, maskPan, maskAadhaar } from './crypto.util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  search?: string;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface DedupeResult {
  isDuplicate: boolean;
  existingCustomerId?: string;
  matchedOn: ('pan' | 'phone' | 'aadhaarLast4')[];
}

export interface Customer360View {
  customer: Record<string, unknown>;
  kycDocuments: Record<string, unknown>[];
  loanApplications: Record<string, unknown>[];
  activeLoans: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  bureauHistory: Record<string, unknown>[];
  collectionTasks: Record<string, unknown>[];
  totalRelationshipValuePaisa: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  async create(orgId: string, dto: CreateCustomerDto, createdBy?: string) {
    // Validate at least one of PAN or Aadhaar is supplied
    if (!dto.panNumber && !dto.aadhaarNumber) {
      throw new BadRequestException(
        'At least one of PAN or Aadhaar number is required',
      );
    }

    // Validate PAN format
    if (dto.panNumber && !isValidPan(dto.panNumber)) {
      throw new BadRequestException(
        `Invalid PAN format: ${dto.panNumber}. Expected format: ABCDE1234F`,
      );
    }

    // Validate Aadhaar format + Verhoeff checksum
    if (dto.aadhaarNumber && !isValidAadhaar(dto.aadhaarNumber)) {
      throw new BadRequestException(
        'Invalid Aadhaar number: failed Verhoeff checksum validation',
      );
    }

    // Validate phone
    if (!isValidPhone(dto.phone)) {
      throw new BadRequestException(
        `Invalid phone number: ${dto.phone}. Must be 10 digits starting with 6-9`,
      );
    }

    // Check phone uniqueness within org
    const phoneConflict = await this.prisma.customer.findFirst({
      where: { organizationId: orgId, phone: dto.phone, deletedAt: null },
      select: { id: true, customerNumber: true },
    });
    if (phoneConflict) {
      throw new ConflictException(
        `A customer with phone ${dto.phone} already exists in this organisation (${phoneConflict.customerNumber})`,
      );
    }

    // Encrypt sensitive fields
    const encryptedPan = dto.panNumber ? encrypt(dto.panNumber) : null;
    const encryptedAadhaar = dto.aadhaarNumber
      ? encrypt(dto.aadhaarNumber)
      : null;

    // Auto-generate customerNumber: ORG/CUST/NNNNNN
    const customerNumber = await this.generateCustomerNumber(orgId);

    const fullName = [dto.firstName, dto.middleName, dto.lastName]
      .filter(Boolean)
      .join(' ');

    const customer = await this.prisma.customer.create({
      data: {
        organizationId: orgId,
        customerNumber,
        customerType: dto.customerType ?? 'INDIVIDUAL',
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        panNumber: encryptedPan ?? '',
        aadhaarNumber: encryptedAadhaar,
        email: dto.email,
        phone: dto.phone,
        alternatePhone: dto.alternatePhone,
        currentAddressLine1: dto.currentAddressLine1,
        currentAddressLine2: dto.currentAddressLine2,
        currentCity: dto.currentCity,
        currentState: dto.currentState,
        currentPincode: dto.currentPincode,
        permanentAddressLine1: dto.permanentAddressLine1,
        permanentAddressLine2: dto.permanentAddressLine2,
        permanentCity: dto.permanentCity,
        permanentState: dto.permanentState,
        permanentPincode: dto.permanentPincode,
        employmentType: dto.employmentType,
        employerName: dto.employerName,
        monthlyIncomePaisa: dto.monthlyIncomePaisa,
        kycStatus: KycStatus.PENDING,
        createdBy,
        updatedBy: createdBy,
      },
    });

    this.logger.log(
      `Customer created: ${customer.customerNumber} (org: ${orgId})`,
    );

    return this.maskCustomer(customer);
  }

  // -------------------------------------------------------------------------
  // findAll — cursor-based pagination with search
  // -------------------------------------------------------------------------

  async findAll(
    orgId: string,
    params: CursorPaginationParams,
  ): Promise<CursorPaginatedResult<Record<string, unknown>>> {
    const limit = Math.min(params.limit ?? 20, 100);
    const { cursor, search } = params;

    // Build search where clause
    const searchWhere: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { customerNumber: { contains: search, mode: 'insensitive' } },
            // PAN is encrypted; we cannot do a DB-side LIKE on it,
            // so we match on customerNumber / phone / name only.
          ],
        }
      : {};

    const where: Prisma.CustomerWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...searchWhere,
    };

    // Get total count for informational purposes
    const total = await this.prisma.customer.count({ where });

    // Fetch limit + 1 to determine hasMore
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // skip the cursor record itself
          }
        : {}),
    });

    const hasMore = customers.length > limit;
    const pageData = hasMore ? customers.slice(0, limit) : customers;
    const nextCursor =
      hasMore && pageData.length > 0
        ? (pageData[pageData.length - 1]?.id ?? null)
        : null;

    return {
      data: pageData.map((c) => this.maskCustomer(c)),
      nextCursor,
      hasMore,
      total,
    };
  }

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  async findOne(orgId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }
    return this.maskCustomer(customer);
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  async update(
    orgId: string,
    id: string,
    dto: UpdateCustomerDto,
    updatedBy?: string,
  ) {
    // Confirm exists
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    // Validate new PAN if provided
    if (dto.panNumber && !isValidPan(dto.panNumber)) {
      throw new BadRequestException(
        `Invalid PAN format: ${dto.panNumber}`,
      );
    }

    // Validate new Aadhaar if provided
    if (dto.aadhaarNumber && !isValidAadhaar(dto.aadhaarNumber)) {
      throw new BadRequestException(
        'Invalid Aadhaar number: failed Verhoeff checksum validation',
      );
    }

    // Validate new phone if provided
    if (dto.phone) {
      if (!isValidPhone(dto.phone)) {
        throw new BadRequestException(
          `Invalid phone number: ${dto.phone}`,
        );
      }
      // Check uniqueness (exclude self)
      const phoneConflict = await this.prisma.customer.findFirst({
        where: {
          organizationId: orgId,
          phone: dto.phone,
          deletedAt: null,
          NOT: { id },
        },
        select: { customerNumber: true },
      });
      if (phoneConflict) {
        throw new ConflictException(
          `Phone ${dto.phone} is already used by customer ${phoneConflict.customerNumber}`,
        );
      }
    }

    const updateData: Prisma.CustomerUpdateInput = {
      updatedBy,
      updatedAt: new Date(),
    };

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.middleName !== undefined) updateData.middleName = dto.middleName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;

    // Recompute fullName if any name field changed
    const newFirst = dto.firstName ?? existing.firstName;
    const newMiddle =
      dto.middleName !== undefined ? dto.middleName : existing.middleName;
    const newLast = dto.lastName ?? existing.lastName;
    updateData.fullName = [newFirst, newMiddle, newLast]
      .filter(Boolean)
      .join(' ');

    if (dto.dateOfBirth !== undefined)
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.panNumber !== undefined)
      updateData.panNumber = encrypt(dto.panNumber);
    if (dto.aadhaarNumber !== undefined)
      updateData.aadhaarNumber = encrypt(dto.aadhaarNumber);
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.alternatePhone !== undefined)
      updateData.alternatePhone = dto.alternatePhone;
    if (dto.currentAddressLine1 !== undefined)
      updateData.currentAddressLine1 = dto.currentAddressLine1;
    if (dto.currentAddressLine2 !== undefined)
      updateData.currentAddressLine2 = dto.currentAddressLine2;
    if (dto.currentCity !== undefined) updateData.currentCity = dto.currentCity;
    if (dto.currentState !== undefined)
      updateData.currentState = dto.currentState;
    if (dto.currentPincode !== undefined)
      updateData.currentPincode = dto.currentPincode;
    if (dto.permanentAddressLine1 !== undefined)
      updateData.permanentAddressLine1 = dto.permanentAddressLine1;
    if (dto.permanentAddressLine2 !== undefined)
      updateData.permanentAddressLine2 = dto.permanentAddressLine2;
    if (dto.permanentCity !== undefined)
      updateData.permanentCity = dto.permanentCity;
    if (dto.permanentState !== undefined)
      updateData.permanentState = dto.permanentState;
    if (dto.permanentPincode !== undefined)
      updateData.permanentPincode = dto.permanentPincode;
    if (dto.employmentType !== undefined)
      updateData.employmentType = dto.employmentType;
    if (dto.employerName !== undefined)
      updateData.employerName = dto.employerName;
    if (dto.monthlyIncomePaisa !== undefined)
      updateData.monthlyIncomePaisa = dto.monthlyIncomePaisa;

    const updated = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });

    return this.maskCustomer(updated);
  }

  // -------------------------------------------------------------------------
  // dedupe
  // -------------------------------------------------------------------------

  async dedupe(orgId: string, dto: DedupeCustomerDto): Promise<DedupeResult> {
    if (!dto.panNumber && !dto.phone && !dto.aadhaarLast4) {
      throw new BadRequestException(
        'At least one of panNumber, phone, or aadhaarLast4 is required',
      );
    }

    const matchedOn: ('pan' | 'phone' | 'aadhaarLast4')[] = [];
    let existingCustomerId: string | undefined;

    // Check phone match (plaintext in DB)
    if (dto.phone) {
      const byPhone = await this.prisma.customer.findFirst({
        where: { organizationId: orgId, phone: dto.phone, deletedAt: null },
        select: { id: true },
      });
      if (byPhone) {
        matchedOn.push('phone');
        existingCustomerId = byPhone.id;
      }
    }

    // Check PAN match — PAN is encrypted; we must decrypt all and compare.
    // For performance, this is acceptable for NBFCs (typically <100k customers).
    // A production-grade approach would use deterministic encryption (AES-SIV)
    // or store a HMAC of the PAN for indexed lookup.
    if (dto.panNumber && !existingCustomerId) {
      const customers = await this.prisma.customer.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          NOT: { panNumber: '' },
        },
        select: { id: true, panNumber: true },
      });
      for (const c of customers) {
        try {
          const plainPan = decrypt(c.panNumber);
          if (plainPan === dto.panNumber) {
            matchedOn.push('pan');
            existingCustomerId = c.id;
            break;
          }
        } catch {
          // Ignore decrypt errors for individual records
        }
      }
    }

    // Check Aadhaar last4 — compare against last 4 chars of decrypted Aadhaar
    if (dto.aadhaarLast4 && !existingCustomerId) {
      const customers = await this.prisma.customer.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          aadhaarNumber: { not: null },
        },
        select: { id: true, aadhaarNumber: true },
      });
      for (const c of customers) {
        if (!c.aadhaarNumber) continue;
        try {
          const plainAadhaar = decrypt(c.aadhaarNumber);
          if (plainAadhaar.slice(-4) === dto.aadhaarLast4) {
            matchedOn.push('aadhaarLast4');
            existingCustomerId = c.id;
            break;
          }
        } catch {
          // Ignore decrypt errors for individual records
        }
      }
    }

    return {
      isDuplicate: matchedOn.length > 0,
      existingCustomerId,
      matchedOn,
    };
  }

  // -------------------------------------------------------------------------
  // get360View
  // -------------------------------------------------------------------------

  async get360View(orgId: string, customerId: string): Promise<Customer360View> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id ${customerId} not found`);
    }

    // Fetch all related data in parallel
    const [
      kycDocuments,
      loanApplications,
      loans,
      bureauHistory,
    ] = await Promise.all([
      // KYC documents
      this.prisma.document.findMany({
        where: { customerId, organizationId: orgId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),

      // All loan applications
      this.prisma.loanApplication.findMany({
        where: {
          customerId,
          organizationId: orgId,
          deletedAt: null,
        },
        include: {
          product: { select: { name: true, code: true, productType: true } },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // All loans with schedules summary
      this.prisma.loan.findMany({
        where: { customerId, organizationId: orgId },
        include: {
          product: { select: { name: true, code: true, productType: true } },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Bureau history
      this.prisma.bureauRequest.findMany({
        where: { customerId, organizationId: orgId },
        include: { bureauResponse: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Active loans only
    const activeLoans = loans.filter((l) => l.loanStatus === 'ACTIVE');

    // Get payments for all loans
    const loanIds = loans.map((l) => l.id);
    const [payments, collectionTasks] = await Promise.all([
      loanIds.length > 0
        ? this.prisma.payment.findMany({
            where: { loanId: { in: loanIds }, organizationId: orgId },
            orderBy: { paymentDate: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),

      loanIds.length > 0
        ? this.prisma.collectionTask.findMany({
            where: { loanId: { in: loanIds }, organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    /**
     * Total Relationship Value = sum of outstanding principal across all active loans
     * (disbursed amount proxy for inactive loans summed as historical value).
     */
    const totalRelationshipValuePaisa = activeLoans.reduce(
      (sum, loan) => sum + loan.outstandingPrincipalPaisa,
      0,
    );

    return {
      customer: this.maskCustomer(customer),
      kycDocuments: kycDocuments as unknown as Record<string, unknown>[],
      loanApplications: loanApplications as unknown as Record<string, unknown>[],
      activeLoans: activeLoans as unknown as Record<string, unknown>[],
      payments: payments as unknown as Record<string, unknown>[],
      bureauHistory: bureauHistory as unknown as Record<string, unknown>[],
      collectionTasks: collectionTasks as unknown as Record<string, unknown>[],
      totalRelationshipValuePaisa,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Generates a unique customer number in format: ORG/CUST/NNNNNN
   * Finds the highest existing sequence for the org and increments.
   */
  private async generateCustomerNumber(orgId: string): Promise<string> {
    // Get org code
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { code: true },
    });
    const orgCode = org?.code ?? 'ORG';

    // Count existing customers to derive sequence
    const count = await this.prisma.customer.count({
      where: { organizationId: orgId },
    });
    const sequence = String(count + 1).padStart(6, '0');
    return `${orgCode}/CUST/${sequence}`;
  }

  /**
   * Masks PAN and Aadhaar in a customer record before returning to API caller.
   * Decrypts the stored encrypted values and returns masked versions.
   */
  private maskCustomer(customer: {
    panNumber: string;
    aadhaarNumber?: string | null;
    [key: string]: unknown;
  }): Record<string, unknown> {
    const result: Record<string, unknown> = { ...customer };

    // Mask PAN
    if (customer.panNumber && customer.panNumber !== '') {
      try {
        const plainPan = decrypt(customer.panNumber);
        result['panNumber'] = maskPan(plainPan);
      } catch {
        result['panNumber'] = 'XXXXXXXXXX';
      }
    } else {
      result['panNumber'] = null;
    }

    // Mask Aadhaar
    if (customer.aadhaarNumber) {
      try {
        const plainAadhaar = decrypt(customer.aadhaarNumber);
        result['aadhaarNumber'] = maskAadhaar(plainAadhaar);
      } catch {
        result['aadhaarNumber'] = 'XXXX-XXXX-XXXX';
      }
    }

    return result;
  }
}
