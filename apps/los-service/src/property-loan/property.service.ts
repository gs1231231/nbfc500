import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddPropertyDetailDto, UpdateConstructionProgressDto } from './dto/add-property-detail.dto';

// Max LTV ratios per property type (% of market value / forced sale value)
const MAX_LTV_RESIDENTIAL = 75; // 75% for residential
const MAX_LTV_COMMERCIAL = 65;  // 65% for commercial/industrial

const ALLOWED_PROPERTY_TYPES = ['RESIDENTIAL_FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL', 'INDUSTRIAL'];
const ALLOWED_CONSTRUCTION_STAGES = ['NOT_STARTED', 'FOUNDATION', 'STRUCTURE', 'FINISHING', 'COMPLETED'];

@Injectable()
export class PropertyService {
  private readonly logger = new Logger(PropertyService.name);

  constructor(private readonly prisma: PrismaService) {}

  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  // ============================================================
  // Property Detail Operations
  // ============================================================

  /**
   * Add property details to a loan application.
   * Used for Home Loan, LAP (Loan Against Property) origination.
   */
  async addPropertyDetail(orgId: string, dto: AddPropertyDetailDto) {
    if (!ALLOWED_PROPERTY_TYPES.includes(dto.propertyType)) {
      throw new BadRequestException(
        `Invalid propertyType "${dto.propertyType}". Allowed: ${ALLOWED_PROPERTY_TYPES.join(', ')}`,
      );
    }

    if (dto.titleStatus && !['CLEAR', 'DEFECTIVE', 'UNDER_DISPUTE'].includes(dto.titleStatus)) {
      throw new BadRequestException(
        `Invalid titleStatus "${dto.titleStatus}". Allowed: CLEAR, DEFECTIVE, UNDER_DISPUTE`,
      );
    }

    if (dto.constructionStage && !ALLOWED_CONSTRUCTION_STAGES.includes(dto.constructionStage)) {
      throw new BadRequestException(
        `Invalid constructionStage "${dto.constructionStage}". Allowed: ${ALLOWED_CONSTRUCTION_STAGES.join(', ')}`,
      );
    }

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: dto.applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${dto.applicationId} not found`);
    }

    const property = await this.prisma.propertyDetail.create({
      data: {
        organizationId: orgId,
        applicationId: dto.applicationId,
        propertyType: dto.propertyType,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        areaSquareFeet: dto.areaSquareFeet ?? null,
        marketValuePaisa: dto.marketValuePaisa ?? null,
        forcedSaleValuePaisa: dto.forcedSaleValuePaisa ?? null,
        registrationNumber: dto.registrationNumber ?? null,
        titleHolder: dto.titleHolder ?? null,
        titleStatus: dto.titleStatus ?? null,
        encumbranceFree: dto.encumbranceFree ?? false,
        constructionStage: dto.constructionStage ?? null,
        constructionProgress: dto.constructionProgress ?? null,
        builderName: dto.builderName ?? null,
        projectName: dto.projectName ?? null,
        cersaiStatus: 'PENDING',
      },
    });

    this.logger.log(`Added property detail ${property.id} for application ${dto.applicationId}`);

    return this.serializeProperty(property);
  }

  /**
   * Get property detail by ID.
   */
  async getPropertyDetail(orgId: string, propertyId: string) {
    const property = await this.prisma.propertyDetail.findFirst({
      where: { id: propertyId, organizationId: orgId },
    });

    if (!property) {
      throw new NotFoundException(`Property detail ${propertyId} not found`);
    }

    return this.serializeProperty(property);
  }

  /**
   * Update construction progress for tranche disbursement.
   *
   * Under-construction properties often have tranche-based disbursement
   * tied to construction milestones. This records the latest stage/progress
   * so the disbursement module can release the next tranche.
   */
  async updateConstructionProgress(
    orgId: string,
    propertyId: string,
    dto: UpdateConstructionProgressDto,
  ) {
    const property = await this.prisma.propertyDetail.findFirst({
      where: { id: propertyId, organizationId: orgId },
    });

    if (!property) {
      throw new NotFoundException(`Property detail ${propertyId} not found`);
    }

    if (!ALLOWED_CONSTRUCTION_STAGES.includes(dto.constructionStage)) {
      throw new BadRequestException(
        `Invalid constructionStage "${dto.constructionStage}". Allowed: ${ALLOWED_CONSTRUCTION_STAGES.join(', ')}`,
      );
    }

    if (dto.constructionProgress < 0 || dto.constructionProgress > 100) {
      throw new BadRequestException(`constructionProgress must be between 0 and 100`);
    }

    const updated = await this.prisma.propertyDetail.update({
      where: { id: propertyId },
      data: {
        constructionStage: dto.constructionStage,
        constructionProgress: dto.constructionProgress,
      },
    });

    this.logger.log(
      `Construction progress updated for property ${propertyId}: ${dto.constructionStage} (${dto.constructionProgress}%)`,
    );

    return {
      ...this.serializeProperty(updated),
      message: `Construction progress updated to ${dto.constructionProgress}% (${dto.constructionStage})`,
    };
  }

  /**
   * File CERSAI registration after loan disbursement.
   *
   * CERSAI (Central Registry of Securitisation Asset Reconstruction and Security Interest)
   * registration is mandatory for property loans under SARFAESI Act.
   * In production, calls CERSAI API. Here we mark status as FILED.
   */
  async fileCersai(orgId: string, loanId: string) {
    const property = await this.prisma.propertyDetail.findFirst({
      where: { organizationId: orgId, loanId },
    });

    if (!property) {
      throw new NotFoundException(`Property detail for loan ${loanId} not found`);
    }

    if (property.cersaiStatus === 'CONFIRMED') {
      throw new UnprocessableEntityException(
        `CERSAI registration already confirmed for loan ${loanId}`,
      );
    }

    // Mock CERSAI API call — generates a mock CERSAI ID
    const mockCersaiId = `CERSAI-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    this.logger.log(`[Mock CERSAI API] Filing registration for loan ${loanId}, property ${property.id}`);

    const updated = await this.prisma.propertyDetail.update({
      where: { id: property.id },
      data: {
        cersaiId: mockCersaiId,
        cersaiStatus: 'FILED',
      },
    });

    return {
      ...this.serializeProperty(updated),
      message: 'CERSAI registration filed successfully',
      cersaiId: mockCersaiId,
    };
  }

  /**
   * Release CERSAI registration after loan closure.
   *
   * Must be done within 30 days of loan closure per CERSAI regulations.
   * Marks status as PENDING (pending confirmation from CERSAI portal).
   */
  async releaseCersai(orgId: string, loanId: string) {
    const property = await this.prisma.propertyDetail.findFirst({
      where: { organizationId: orgId, loanId },
    });

    if (!property) {
      throw new NotFoundException(`Property detail for loan ${loanId} not found`);
    }

    if (property.cersaiStatus === 'PENDING') {
      throw new UnprocessableEntityException(
        `CERSAI was not filed — cannot release`,
      );
    }

    this.logger.log(`[Mock CERSAI API] Releasing registration for loan ${loanId}, property ${property.id}`);

    const updated = await this.prisma.propertyDetail.update({
      where: { id: property.id },
      data: {
        cersaiStatus: 'PENDING', // resets to PENDING — reflects release request submitted
        cersaiId: null,
      },
    });

    return {
      ...this.serializeProperty(updated),
      message: 'CERSAI release request submitted. Confirmation typically takes 1-3 business days.',
    };
  }

  /**
   * Calculate LTV for a property loan application.
   *
   * Uses forced sale value (FSV) as the basis for LTV:
   * LTV = (Requested Loan Amount / FSV) * 100
   * Falls back to market value if FSV not set.
   * Max LTV: 75% for residential, 65% for commercial/industrial.
   */
  async calculateLTV(orgId: string, applicationId: string) {
    const [application, property] = await Promise.all([
      this.prisma.loanApplication.findFirst({
        where: { id: applicationId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.propertyDetail.findFirst({
        where: { organizationId: orgId, applicationId },
      }),
    ]);

    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }

    if (!property) {
      throw new UnprocessableEntityException(
        `No property details found for application ${applicationId}`,
      );
    }

    const valuationBasis = property.forcedSaleValuePaisa ?? property.marketValuePaisa;

    if (!valuationBasis) {
      throw new UnprocessableEntityException(
        `Neither market value nor forced sale value is set — required for LTV calculation`,
      );
    }

    const isCommercial = ['COMMERCIAL', 'INDUSTRIAL'].includes(property.propertyType);
    const maxLtv = isCommercial ? MAX_LTV_COMMERCIAL : MAX_LTV_RESIDENTIAL;
    const requestedAmountPaisa = application.requestedAmountPaisa;
    const ltvPercent = (requestedAmountPaisa / valuationBasis) * 100;
    const withinLimit = ltvPercent <= maxLtv;

    return {
      applicationId,
      propertyId: property.id,
      propertyType: property.propertyType,
      valuationBasis: property.forcedSaleValuePaisa ? 'FORCED_SALE_VALUE' : 'MARKET_VALUE',
      valuationPaisa: valuationBasis,
      valuationRupees: this.paisaToRupees(valuationBasis),
      marketValuePaisa: property.marketValuePaisa,
      marketValueRupees: property.marketValuePaisa ? this.paisaToRupees(property.marketValuePaisa) : null,
      forcedSaleValuePaisa: property.forcedSaleValuePaisa,
      forcedSaleValueRupees: property.forcedSaleValuePaisa ? this.paisaToRupees(property.forcedSaleValuePaisa) : null,
      requestedAmountPaisa,
      requestedAmountRupees: this.paisaToRupees(requestedAmountPaisa),
      ltvPercent: Math.round(ltvPercent * 100) / 100,
      maxLtvPercent: maxLtv,
      withinLimit,
      maxEligibleAmountPaisa: Math.floor(valuationBasis * (maxLtv / 100)),
      maxEligibleAmountRupees: this.paisaToRupees(Math.floor(valuationBasis * (maxLtv / 100))),
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeProperty(property: any) {
    return {
      ...property,
      marketValueRupees: property.marketValuePaisa != null ? this.paisaToRupees(property.marketValuePaisa) : null,
      forcedSaleValueRupees: property.forcedSaleValuePaisa != null ? this.paisaToRupees(property.forcedSaleValuePaisa) : null,
    };
  }
}
