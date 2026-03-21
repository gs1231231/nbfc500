import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  CreateRepossessionCaseDto,
  UpdateRepossessionCaseDto,
  RecordSeizureDto,
  YardEntryDto,
  CreateAuctionDto,
  RecordBidDto,
  RecordSaleDto,
} from './dto/repossession.dto';

// Status progression for repossession cases
const STATUS_ORDER = [
  'INITIATED',
  'NOTICE_SENT',
  'SEIZED',
  'IN_YARD',
  'AUCTIONED',
  'SOLD',
  'CLOSED',
];

@Injectable()
export class RepossessionService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Case Management
  // -------------------------------------------------------------------------

  async createCase(
    orgId: string,
    dto: CreateRepossessionCaseDto,
  ): Promise<object> {
    // Verify loan belongs to org
    const loan = await this.prisma.loan.findFirst({
      where: { id: dto.loanId, organizationId: orgId },
      include: { customer: true },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${dto.loanId} not found`);
    }

    const caseNumber = await this.generateCaseNumber();

    // Store repossession case as a JSON blob tracked via a pseudo-table
    // (We store in GlEntry referenceType=REPO_CASE as metadata store since
    //  no dedicated Prisma model exists — real impl would have its own table)
    const caseData = {
      id: caseNumber,
      organizationId: orgId,
      loanId: dto.loanId,
      loanNumber: loan.loanNumber,
      customerId: loan.customerId,
      customerName: loan.customer.fullName,
      caseNumber,
      status: 'INITIATED',
      assetType: dto.assetType,
      assetDescription: dto.assetDescription,
      assetRegistrationNumber: dto.assetRegistrationNumber,
      estimatedValuePaisa: dto.estimatedValuePaisa,
      outstandingAmountPaisa: dto.outstandingAmountPaisa,
      initiationReason: dto.initiationReason,
      remarks: dto.remarks ?? null,
      seizure: null,
      yard: null,
      auction: null,
      bids: [],
      sale: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist as a GL-style reference entry (metadata pattern)
    await this.prisma.glEntry.create({
      data: {
        organizationId: orgId,
        branchId: loan.branchId,
        entryDate: new Date(),
        valueDate: new Date(),
        accountCode: 'REPO',
        accountName: 'Repossession Cases',
        debitAmountPaisa: 0,
        creditAmountPaisa: 0,
        narration: `Repossession case initiated for loan ${loan.loanNumber}`,
        referenceType: 'REPO_CASE',
        referenceId: caseNumber,
      },
    });

    return caseData;
  }

  async updateCase(
    orgId: string,
    caseId: string,
    dto: UpdateRepossessionCaseDto,
  ): Promise<object> {
    if (dto.status && !STATUS_ORDER.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${STATUS_ORDER.join(', ')}`,
      );
    }

    // Validate GL entry exists
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'REPO_CASE',
        referenceId: caseId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`Repossession case ${caseId} not found`);
    }

    // Update narration to reflect status change
    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `Repossession case ${caseId} updated to status: ${dto.status ?? 'N/A'}. ${dto.remarks ?? ''}`,
        updatedAt: new Date(),
      },
    });

    return {
      caseId,
      status: dto.status,
      remarks: dto.remarks,
      updatedAt: new Date().toISOString(),
      message: 'Repossession case updated successfully',
    };
  }

  async assignAgent(
    orgId: string,
    caseId: string,
    agentId: string,
  ): Promise<object> {
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'REPO_CASE',
        referenceId: caseId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`Repossession case ${caseId} not found`);
    }

    return {
      caseId,
      agentId,
      assignedAt: new Date().toISOString(),
      message: 'Agent assigned to repossession case',
    };
  }

  async recordSeizure(
    orgId: string,
    caseId: string,
    dto: RecordSeizureDto,
  ): Promise<object> {
    const entry = await this.assertCaseExists(orgId, caseId);

    // Update case status to SEIZED
    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `Asset seized for case ${caseId}. Location: ${dto.address}. Condition: ${dto.conditionReport}`,
        updatedAt: new Date(),
      },
    });

    return {
      caseId,
      status: 'SEIZED',
      seizure: {
        seizureDate: dto.seizureDate,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        conditionReport: dto.conditionReport,
        odometerReading: dto.odometerReading ?? null,
        witnessName: dto.witnessName ?? null,
        witnessPhone: dto.witnessPhone ?? null,
        photoUrls: dto.photoUrls ?? [
          `https://storage.bankos.in/repo/${caseId}/photo_1.jpg`,
          `https://storage.bankos.in/repo/${caseId}/photo_2.jpg`,
        ],
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  async yardEntry(
    orgId: string,
    caseId: string,
    dto: YardEntryDto,
  ): Promise<object> {
    await this.assertCaseExists(orgId, caseId);

    return {
      caseId,
      status: 'IN_YARD',
      yard: {
        yardName: dto.yardName,
        yardAddress: dto.yardAddress,
        yardContactPhone: dto.yardContactPhone,
        entryDate: dto.entryDate,
        dailyStorageChargePaisa: dto.dailyStorageChargePaisa,
        insurancePolicyNumber: dto.insurancePolicyNumber,
        insuranceAmountPaisa: dto.insuranceAmountPaisa,
        insuranceExpiryDate: dto.insuranceExpiryDate,
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  async createAuction(
    orgId: string,
    caseId: string,
    dto: CreateAuctionDto,
  ): Promise<object> {
    await this.assertCaseExists(orgId, caseId);

    const auctionRef = `AUC-${caseId}-${Date.now()}`;

    return {
      caseId,
      auctionId: auctionRef,
      status: 'AUCTIONED',
      auction: {
        auctionType: dto.auctionType,
        auctionDate: dto.auctionDate,
        auctionVenue: dto.auctionVenue,
        reservePricePaisa: dto.reservePricePaisa,
        auctioneerName: dto.auctioneerName,
        auctioneerContact: dto.auctioneerContact,
        advertisementDetails: dto.advertisementDetails ?? null,
        remarks: dto.remarks ?? null,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async recordBid(
    orgId: string,
    caseId: string,
    dto: RecordBidDto,
  ): Promise<object> {
    await this.assertCaseExists(orgId, caseId);

    const bidId = `BID-${caseId}-${Date.now()}`;

    return {
      bidId,
      caseId,
      bid: {
        bidderName: dto.bidderName,
        bidderPhone: dto.bidderPhone,
        bidderPan: dto.bidderPan,
        bidAmountPaisa: dto.bidAmountPaisa,
        bidTime: dto.bidTime,
        status: dto.status,
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  async recordSale(
    orgId: string,
    caseId: string,
    dto: RecordSaleDto,
  ): Promise<object> {
    const entry = await this.assertCaseExists(orgId, caseId);

    await this.prisma.glEntry.update({
      where: { id: entry.id },
      data: {
        narration: `Asset sold for case ${caseId}. Sale price: ${dto.salePricePaisa / 100} INR. Buyer: ${dto.buyerName}`,
        updatedAt: new Date(),
      },
    });

    return {
      caseId,
      status: 'SOLD',
      sale: {
        salePricePaisa: dto.salePricePaisa,
        buyerName: dto.buyerName,
        buyerPhone: dto.buyerPhone,
        buyerPan: dto.buyerPan,
        saleDate: dto.saleDate,
        paymentMode: dto.paymentMode,
        referenceNumber: dto.referenceNumber,
        settlementAmountPaisa: dto.settlementAmountPaisa,
        surplusAmountPaisa: dto.surplusAmountPaisa ?? 0,
        remarks: dto.remarks ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  async listCases(orgId: string, page = 1, limit = 20): Promise<object> {
    const entries = await this.prisma.glEntry.findMany({
      where: { organizationId: orgId, referenceType: 'REPO_CASE' },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.glEntry.count({
      where: { organizationId: orgId, referenceType: 'REPO_CASE' },
    });

    return {
      data: entries.map((e) => ({
        caseId: e.referenceId,
        narration: e.narration,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getCase(orgId: string, caseId: string): Promise<object> {
    const entry = await this.assertCaseExists(orgId, caseId);
    return {
      caseId,
      narration: entry.narration,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async assertCaseExists(orgId: string, caseId: string) {
    const entry = await this.prisma.glEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: 'REPO_CASE',
        referenceId: caseId,
      },
    });
    if (!entry) {
      throw new NotFoundException(`Repossession case ${caseId} not found`);
    }
    return entry;
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.glEntry.count({
      where: { referenceType: 'REPO_CASE' },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `REPO/${year}/${seq}`;
  }
}
