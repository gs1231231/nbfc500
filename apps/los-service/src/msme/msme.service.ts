import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddMSMEDetailDto } from './dto/add-msme-detail.dto';

// Drawing power calculation constants
// Drawing power = (Stock * STOCK_MARGIN%) + (Debtors <= 90 days * DEBTOR_MARGIN%) - Creditors
const STOCK_MARGIN = 0.75;   // 75% of stock value is considered
const DEBTOR_MARGIN = 0.75;  // 75% of debtors <= 90 days considered

const ALLOWED_MSME_CATEGORIES = ['MICRO', 'SMALL', 'MEDIUM'];
const ALLOWED_BUSINESS_TYPES = ['MANUFACTURING', 'SERVICES', 'TRADING'];

@Injectable()
export class MSMEService {
  private readonly logger = new Logger(MSMEService.name);

  constructor(private readonly prisma: PrismaService) {}

  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  // ============================================================
  // MSME Detail Operations
  // ============================================================

  /**
   * Add MSME details to a working capital / business loan application.
   * Captures GST, Udyam registration, business financials and stock statements.
   */
  async addMSMEDetail(orgId: string, dto: AddMSMEDetailDto) {
    if (dto.msmeCategory && !ALLOWED_MSME_CATEGORIES.includes(dto.msmeCategory)) {
      throw new BadRequestException(
        `Invalid msmeCategory "${dto.msmeCategory}". Allowed: ${ALLOWED_MSME_CATEGORIES.join(', ')}`,
      );
    }

    if (dto.businessType && !ALLOWED_BUSINESS_TYPES.includes(dto.businessType)) {
      throw new BadRequestException(
        `Invalid businessType "${dto.businessType}". Allowed: ${ALLOWED_BUSINESS_TYPES.join(', ')}`,
      );
    }

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: dto.applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${dto.applicationId} not found`);
    }

    const msme = await this.prisma.mSMEDetail.create({
      data: {
        organizationId: orgId,
        applicationId: dto.applicationId,
        gstin: dto.gstin ?? null,
        udyamNumber: dto.udyamNumber ?? null,
        msmeCategory: dto.msmeCategory ?? null,
        businessType: dto.businessType ?? null,
        businessVintageMonths: dto.businessVintageMonths ?? null,
        annualTurnoverPaisa: dto.annualTurnoverPaisa ? BigInt(dto.annualTurnoverPaisa) : null,
        gstTurnoverPaisa: dto.gstTurnoverPaisa ? BigInt(dto.gstTurnoverPaisa) : null,
        bankingLimitPaisa: dto.bankingLimitPaisa ?? null,
        drawingPowerPaisa: dto.drawingPowerPaisa ?? null,
        stockStatementDate: dto.stockStatementDate ? new Date(dto.stockStatementDate) : null,
        stockValuePaisa: dto.stockValuePaisa ?? null,
        debtorValuePaisa: dto.debtorValuePaisa ?? null,
        creditorValuePaisa: dto.creditorValuePaisa ?? null,
        currentRatioPct: dto.currentRatioPct ?? null,
      },
    });

    this.logger.log(`Added MSME detail ${msme.id} for application ${dto.applicationId}`);

    return this.serializeMSME(msme);
  }

  /**
   * Get MSME detail by ID.
   */
  async getMSMEDetail(orgId: string, msmeId: string) {
    const msme = await this.prisma.mSMEDetail.findFirst({
      where: { id: msmeId, organizationId: orgId },
    });

    if (!msme) {
      throw new NotFoundException(`MSME detail ${msmeId} not found`);
    }

    return this.serializeMSME(msme);
  }

  /**
   * Calculate drawing power for a working capital loan.
   *
   * Standard banking formula:
   * Drawing Power = (Stock Value * 75%) + (Debtors * 75%) - Creditors
   *
   * This determines how much the borrower can draw from their CC/OD account.
   * Also updates the drawingPowerPaisa field in the MSME detail record.
   */
  async calculateDrawingPower(orgId: string, applicationId: string) {
    const msme = await this.prisma.mSMEDetail.findFirst({
      where: { organizationId: orgId, applicationId },
    });

    if (!msme) {
      throw new UnprocessableEntityException(
        `No MSME details found for application ${applicationId}`,
      );
    }

    if (msme.stockValuePaisa == null) {
      throw new UnprocessableEntityException(
        `Stock value not set — required for drawing power calculation`,
      );
    }

    const stockValuePaisa = msme.stockValuePaisa;
    const debtorValuePaisa = msme.debtorValuePaisa ?? 0;
    const creditorValuePaisa = msme.creditorValuePaisa ?? 0;

    const stockComponent = Math.floor(stockValuePaisa * STOCK_MARGIN);
    const debtorComponent = Math.floor(debtorValuePaisa * DEBTOR_MARGIN);
    const drawingPowerPaisa = Math.max(0, stockComponent + debtorComponent - creditorValuePaisa);

    // Update drawing power in the record
    await this.prisma.mSMEDetail.update({
      where: { id: msme.id },
      data: { drawingPowerPaisa },
    });

    this.logger.log(
      `Drawing power calculated for application ${applicationId}: ${drawingPowerPaisa} paisa`,
    );

    return {
      applicationId,
      msmeDetailId: msme.id,
      stockValuePaisa: Number(stockValuePaisa),
      stockValueRupees: this.paisaToRupees(Number(stockValuePaisa)),
      stockMarginPercent: STOCK_MARGIN * 100,
      stockComponent,
      stockComponentRupees: this.paisaToRupees(stockComponent),
      debtorValuePaisa: Number(debtorValuePaisa),
      debtorValueRupees: this.paisaToRupees(Number(debtorValuePaisa)),
      debtorMarginPercent: DEBTOR_MARGIN * 100,
      debtorComponent,
      debtorComponentRupees: this.paisaToRupees(debtorComponent),
      creditorValuePaisa: Number(creditorValuePaisa),
      creditorValueRupees: this.paisaToRupees(Number(creditorValuePaisa)),
      drawingPowerPaisa,
      drawingPowerRupees: this.paisaToRupees(drawingPowerPaisa),
      formula: '(Stock × 75%) + (Debtors × 75%) − Creditors',
    };
  }

  /**
   * Verify GST registration via mock GST portal check.
   *
   * In production, calls https://api.gst.gov.in/apiendpoint/search?gstin={gstin}
   * Mock: validates format and returns fake registration details.
   */
  async verifyGST(orgId: string, gstin: string) {
    // Validate GSTIN format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin)) {
      throw new BadRequestException(
        `Invalid GSTIN format: "${gstin}". Expected format: 27AAPFU0939F1ZV`,
      );
    }

    this.logger.log(`[Mock GST Portal] Verifying GSTIN: ${gstin} for org ${orgId}`);

    // Mock GST portal response
    const stateCode = gstin.substring(0, 2);
    const panFromGstin = gstin.substring(2, 12);

    const mockGstResponse = {
      gstin,
      tradeName: 'ABC Trading Co.',
      legalName: 'ABC Trading Private Limited',
      registrationType: 'Regular',
      constitutionOfBusiness: 'Private Limited Company',
      gstinStatus: 'Active',
      registrationDate: '01/04/2019',
      lastReturnFiledDate: '20/03/2026',
      stateCode,
      panNumber: panFromGstin,
      annualAggregateTurnover: 'Above 5 Crores',
    };

    return {
      gstin,
      verified: true,
      gstPortalResponse: mockGstResponse,
      message: 'GSTIN verified successfully via GST portal (mock)',
    };
  }

  /**
   * Verify Udyam registration via mock Udyam portal check.
   *
   * In production, calls Udyam Assist Portal API.
   * Mock: validates format and returns fake registration details.
   */
  async verifyUdyam(orgId: string, udyamNumber: string) {
    const udyamRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
    if (!udyamRegex.test(udyamNumber)) {
      throw new BadRequestException(
        `Invalid Udyam number format: "${udyamNumber}". Expected: UDYAM-MH-01-0001234`,
      );
    }

    this.logger.log(`[Mock Udyam Portal] Verifying Udyam number: ${udyamNumber} for org ${orgId}`);

    const parts = udyamNumber.split('-');
    const stateCode = parts[1];
    const districtCode = parts[2];

    // Mock Udyam portal response
    const mockUdyamResponse = {
      udyamRegistrationNumber: udyamNumber,
      enterpriseName: 'ABC Manufacturing Works',
      ownerName: 'Rajesh Kumar',
      enterpriseType: 'MICRO',
      majorActivity: 'Manufacturing',
      nicCode: '25100',
      dateOfIncorporation: '15/06/2018',
      dateOfCommencement: '01/07/2018',
      stateCode,
      districtCode,
      status: 'Active',
      validUpto: '31/03/2027',
    };

    return {
      udyamNumber,
      verified: true,
      udyamPortalResponse: mockUdyamResponse,
      message: 'Udyam registration verified successfully (mock)',
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeMSME(msme: any) {
    return {
      ...msme,
      annualTurnoverPaisa: msme.annualTurnoverPaisa != null ? Number(msme.annualTurnoverPaisa) : null,
      annualTurnoverRupees: msme.annualTurnoverPaisa != null ? this.paisaToRupees(Number(msme.annualTurnoverPaisa)) : null,
      gstTurnoverPaisa: msme.gstTurnoverPaisa != null ? Number(msme.gstTurnoverPaisa) : null,
      gstTurnoverRupees: msme.gstTurnoverPaisa != null ? this.paisaToRupees(Number(msme.gstTurnoverPaisa)) : null,
      drawingPowerRupees: msme.drawingPowerPaisa != null ? this.paisaToRupees(msme.drawingPowerPaisa) : null,
      stockValueRupees: msme.stockValuePaisa != null ? this.paisaToRupees(msme.stockValuePaisa) : null,
      debtorValueRupees: msme.debtorValuePaisa != null ? this.paisaToRupees(msme.debtorValuePaisa) : null,
      creditorValueRupees: msme.creditorValuePaisa != null ? this.paisaToRupees(msme.creditorValuePaisa) : null,
    };
  }
}
