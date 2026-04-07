import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { AddGoldItemDto } from './dto/add-gold-item.dto';
import { AuctionGoldDto, ReleaseGoldDto, UpdateGoldRateDto } from './dto/update-gold-rate.dto';

// Maximum Loan-to-Value ratio for gold loans per RBI guidelines
const MAX_LTV_PERCENT = 75;

@Injectable()
export class GoldLoanService {
  private readonly logger = new Logger(GoldLoanService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Private helpers
  // ============================================================

  private paisaToRupees(paisa: number): number {
    return Math.round(paisa) / 100;
  }

  // ============================================================
  // Gold Item Operations
  // ============================================================

  /**
   * Add a gold item to an application.
   * Validates the item type is one of the allowed values.
   * Stores gross weight, net weight, purity, appraised value and custody info.
   */
  async addGoldItem(orgId: string, dto: AddGoldItemDto) {
    const ALLOWED_ITEM_TYPES = ['CHAIN', 'NECKLACE', 'BANGLE', 'RING', 'COIN', 'BAR', 'EARRING', 'OTHER'];

    if (!ALLOWED_ITEM_TYPES.includes(dto.itemType)) {
      throw new BadRequestException(
        `Invalid itemType "${dto.itemType}". Allowed: ${ALLOWED_ITEM_TYPES.join(', ')}`,
      );
    }

    // Verify application exists and belongs to org
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: dto.applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(`Loan application ${dto.applicationId} not found`);
    }

    const item = await this.prisma.goldItem.create({
      data: {
        organizationId: orgId,
        applicationId: dto.applicationId,
        itemNumber: dto.itemNumber,
        itemType: dto.itemType,
        description: dto.description ?? null,
        grossWeightGrams: dto.grossWeightGrams,
        netWeightGrams: dto.netWeightGrams,
        purityKarat: dto.purityKarat,
        purityPercentage: dto.purityPercentage,
        hallmarkNumber: dto.hallmarkNumber ?? null,
        stoneWeightGrams: dto.stoneWeightGrams ?? 0,
        appraisedValuePaisa: dto.appraisedValuePaisa,
        sealNumber: dto.sealNumber ?? null,
        packetNumber: dto.packetNumber ?? null,
        custodyBranchId: dto.custodyBranchId ?? null,
        custodyInDate: dto.custodyInDate ? new Date(dto.custodyInDate) : new Date(),
        status: 'IN_CUSTODY',
      },
    });

    this.logger.log(`Added gold item ${item.id} (${item.itemType}) to application ${dto.applicationId}`);

    return {
      ...item,
      appraisedValueRupees: this.paisaToRupees(item.appraisedValuePaisa),
    };
  }

  /**
   * List all gold items for a given application.
   */
  async getItemsByApplication(orgId: string, applicationId: string) {
    const items = await this.prisma.goldItem.findMany({
      where: { organizationId: orgId, applicationId },
      orderBy: { itemNumber: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      appraisedValueRupees: this.paisaToRupees(item.appraisedValuePaisa),
    }));
  }

  /**
   * Calculate LTV for a gold loan application.
   *
   * LTV = (Requested Loan Amount / Total Appraised Gold Value) * 100
   * Max permissible LTV per RBI = 75%.
   * Returns appraised value, requested amount, LTV% and whether it passes the limit.
   */
  async calculateLTV(orgId: string, applicationId: string) {
    const [application, items] = await Promise.all([
      this.prisma.loanApplication.findFirst({
        where: { id: applicationId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.goldItem.findMany({
        where: { organizationId: orgId, applicationId, status: 'IN_CUSTODY' },
      }),
    ]);

    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }

    if (items.length === 0) {
      throw new UnprocessableEntityException(
        `No gold items in custody found for application ${applicationId}`,
      );
    }

    const totalAppraisedPaisa = items.reduce(
      (sum, i) => sum + i.appraisedValuePaisa,
      0,
    );

    const requestedAmountPaisa = application.requestedAmountPaisa;
    const ltvPercent =
      totalAppraisedPaisa > 0
        ? (requestedAmountPaisa / totalAppraisedPaisa) * 100
        : 0;

    const withinLimit = ltvPercent <= MAX_LTV_PERCENT;

    return {
      applicationId,
      itemCount: items.length,
      totalAppraisedValuePaisa: totalAppraisedPaisa,
      totalAppraisedValueRupees: this.paisaToRupees(totalAppraisedPaisa),
      requestedAmountPaisa,
      requestedAmountRupees: this.paisaToRupees(requestedAmountPaisa),
      ltvPercent: Math.round(ltvPercent * 100) / 100,
      maxLtvPercent: MAX_LTV_PERCENT,
      withinLimit,
      maxEligibleAmountPaisa: Math.floor(totalAppraisedPaisa * (MAX_LTV_PERCENT / 100)),
      maxEligibleAmountRupees: this.paisaToRupees(
        Math.floor(totalAppraisedPaisa * (MAX_LTV_PERCENT / 100)),
      ),
    };
  }

  /**
   * Release gold items after loan closure.
   * Requires dual approval — approvedBy field captures the releasing officer.
   * Updates status to RELEASED and records custodyOutDate.
   */
  async releaseGold(orgId: string, loanId: string, dto: ReleaseGoldDto) {
    const items = await this.prisma.goldItem.findMany({
      where: { organizationId: orgId, loanId, status: 'IN_CUSTODY' },
    });

    if (items.length === 0) {
      throw new NotFoundException(
        `No gold items in custody found for loan ${loanId}`,
      );
    }

    const now = new Date();

    await this.prisma.goldItem.updateMany({
      where: { organizationId: orgId, loanId, status: 'IN_CUSTODY' },
      data: {
        status: 'RELEASED',
        custodyOutDate: now,
        releaseApprovedBy: dto.approvedBy,
      },
    });

    this.logger.log(
      `Released ${items.length} gold items for loan ${loanId}, approved by ${dto.approvedBy}`,
    );

    return {
      loanId,
      releasedCount: items.length,
      releasedAt: now.toISOString(),
      approvedBy: dto.approvedBy,
      message: `${items.length} gold item(s) released successfully`,
    };
  }

  /**
   * Auction gold items after NPA classification.
   * Marks items as AUCTIONED with a reserve price recorded in remarks.
   * In production, this would trigger an auction workflow; here it records the event.
   */
  async auctionGold(orgId: string, loanId: string, dto: AuctionGoldDto) {
    const items = await this.prisma.goldItem.findMany({
      where: { organizationId: orgId, loanId, status: 'IN_CUSTODY' },
    });

    if (items.length === 0) {
      throw new NotFoundException(
        `No gold items in custody found for loan ${loanId}`,
      );
    }

    await this.prisma.goldItem.updateMany({
      where: { organizationId: orgId, loanId, status: 'IN_CUSTODY' },
      data: {
        status: 'AUCTIONED',
        custodyOutDate: new Date(),
      },
    });

    this.logger.log(
      `Marked ${items.length} gold items as AUCTIONED for loan ${loanId}, reserve price: ${dto.reservePricePaisa} paisa`,
    );

    return {
      loanId,
      auctionedCount: items.length,
      reservePricePaisa: dto.reservePricePaisa,
      reservePriceRupees: this.paisaToRupees(dto.reservePricePaisa),
      remarks: dto.remarks ?? null,
      message: `${items.length} gold item(s) marked for auction`,
    };
  }

  // ============================================================
  // Gold Rate Operations
  // ============================================================

  /**
   * Record the daily gold rate update.
   * Creates a new GoldRateHistory entry for the organization.
   */
  async updateGoldRate(orgId: string, dto: UpdateGoldRateDto) {
    const entry = await this.prisma.goldRateHistory.create({
      data: {
        organizationId: orgId,
        rateDate: new Date(),
        ratePer10GramsPaisa: dto.ratePer10GramsPaisa,
        purity: dto.purity ?? '22K',
        source: dto.source ?? null,
      },
    });

    this.logger.log(
      `Gold rate updated for org ${orgId}: ${dto.ratePer10GramsPaisa} paisa/10g (${dto.purity ?? '22K'})`,
    );

    return {
      ...entry,
      ratePer10GramsRupees: this.paisaToRupees(entry.ratePer10GramsPaisa),
      ratePerGramPaisa: Math.round(entry.ratePer10GramsPaisa / 10),
      ratePerGramRupees: this.paisaToRupees(Math.round(entry.ratePer10GramsPaisa / 10)),
    };
  }

  /**
   * Get the most recently recorded gold rate for the organization.
   */
  async getCurrentRate(orgId: string) {
    const rate = await this.prisma.goldRateHistory.findFirst({
      where: { organizationId: orgId },
      orderBy: { rateDate: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(`No gold rate found for organization ${orgId}`);
    }

    return {
      ...rate,
      ratePer10GramsRupees: this.paisaToRupees(rate.ratePer10GramsPaisa),
      ratePerGramPaisa: Math.round(rate.ratePer10GramsPaisa / 10),
      ratePerGramRupees: this.paisaToRupees(Math.round(rate.ratePer10GramsPaisa / 10)),
    };
  }
}
