import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { CreatePayoutDto, ListPayoutsDto } from './dto/commission.dto';

const TDS_RATE = 0.10; // 10% TDS on commission payments to DSAs

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate commission for a specific loan.
   * Commission = disbursedAmount * DSA commissionPercent
   */
  async calculateCommission(orgId: string, loanId: string): Promise<object> {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, organizationId: orgId },
      include: {
        application: {
          include: { dsa: true },
        },
        customer: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    const dsa = loan.application.dsa;
    if (!dsa) {
      return {
        loanId,
        loanNumber: loan.loanNumber,
        message: 'No DSA associated with this loan — no commission applicable',
        commissionPaisa: 0,
        tdsPaisa: 0,
        netPayablePaisa: 0,
      };
    }

    const commissionPercent = Number(dsa.commissionPercent);
    const commissionPaisa = Math.round(
      (loan.disbursedAmountPaisa * commissionPercent) / 100,
    );
    const tdsPaisa = Math.round(commissionPaisa * TDS_RATE);
    const netPayablePaisa = commissionPaisa - tdsPaisa;

    return {
      loanId,
      loanNumber: loan.loanNumber,
      disbursedAmountPaisa: loan.disbursedAmountPaisa,
      dsaId: dsa.id,
      dsaCode: dsa.dsaCode,
      dsaName: dsa.name,
      dsaPan: dsa.panNumber,
      commissionPercent,
      commissionPaisa,
      tdsRatePercent: TDS_RATE * 100,
      tdsPaisa,
      netPayablePaisa,
      note: 'TDS deducted at 10% under Section 194H of Income Tax Act',
    };
  }

  /**
   * Calculate TDS on a given commission amount.
   */
  calculateTds(
    commissionPaisa: number,
    tdsRatePercent = TDS_RATE * 100,
  ): object {
    const rate = tdsRatePercent / 100;
    const tdsPaisa = Math.round(commissionPaisa * rate);
    const netPaisa = commissionPaisa - tdsPaisa;

    return {
      grossCommissionPaisa: commissionPaisa,
      tdsRatePercent: tdsRatePercent,
      tdsPaisa,
      netPayablePaisa: netPaisa,
    };
  }

  /**
   * Create a commission payout for a DSA for a given month.
   * Aggregates all commissions for loans disbursed in that month.
   */
  async createPayout(orgId: string, dto: CreatePayoutDto): Promise<object> {
    // Verify DSA exists
    const dsa = await this.prisma.dSA.findFirst({
      where: { id: dto.dsaId, organizationId: orgId },
    });
    if (!dsa) {
      throw new NotFoundException(`DSA ${dto.dsaId} not found`);
    }

    // Parse month (YYYY-MM)
    const [year, month] = dto.month.split('-').map(Number);
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0, 23, 59, 59);

    // Find all loans disbursed via this DSA in the month
    const loans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        disbursementDate: { gte: fromDate, lte: toDate },
        application: { dsaId: dto.dsaId },
      },
      select: {
        id: true,
        loanNumber: true,
        disbursedAmountPaisa: true,
        disbursementDate: true,
      },
    });

    const commissionPercent = Number(dsa.commissionPercent);

    const loanBreakdown = loans.map((loan) => {
      const grossCommission = Math.round(
        (loan.disbursedAmountPaisa * commissionPercent) / 100,
      );
      const tds = Math.round(grossCommission * TDS_RATE);
      return {
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        disbursedAmountPaisa: loan.disbursedAmountPaisa,
        grossCommissionPaisa: grossCommission,
        tdsPaisa: tds,
        netCommissionPaisa: grossCommission - tds,
      };
    });

    const totalGrossCommission = loanBreakdown.reduce(
      (s, l) => s + l.grossCommissionPaisa,
      0,
    );
    const totalTds = loanBreakdown.reduce((s, l) => s + l.tdsPaisa, 0);
    const totalNetCommission = totalGrossCommission - totalTds;

    const payoutRef = `PAY-DSA-${dto.dsaId.slice(0, 8)}-${dto.month}`;

    // Store payout reference
    if (loans.length > 0) {
      const firstLoan = await this.prisma.loan.findFirst({
        where: { id: loans[0].id },
        select: { branchId: true },
      });

      if (firstLoan) {
        await this.prisma.glEntry.create({
          data: {
            organizationId: orgId,
            branchId: firstLoan.branchId,
            entryDate: new Date(),
            valueDate: new Date(),
            accountCode: 'DSA_COMMISSION',
            accountName: 'DSA Commission Payable',
            debitAmountPaisa: totalGrossCommission,
            creditAmountPaisa: 0,
            narration: `DSA Commission payout for ${dsa.name} (${dsa.dsaCode}) — ${dto.month}. Loans: ${loans.length}`,
            referenceType: 'DSA_PAYOUT',
            referenceId: payoutRef,
          },
        });
      }
    }

    return {
      payoutId: payoutRef,
      organizationId: orgId,
      dsaId: dto.dsaId,
      dsaCode: dsa.dsaCode,
      dsaName: dsa.name,
      dsaPan: dsa.panNumber,
      month: dto.month,
      status: 'PENDING_PAYMENT',
      commissionPercent,
      loansCount: loans.length,
      loanBreakdown,
      totals: {
        grossCommissionPaisa: totalGrossCommission,
        tdsPaisa: totalTds,
        netPayablePaisa: totalNetCommission,
        tdsRatePercent: TDS_RATE * 100,
      },
      remarks: dto.remarks ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * List all commission payouts for an organization.
   */
  async listPayouts(
    orgId: string,
    dto: ListPayoutsDto,
    page = 1,
    limit = 20,
  ): Promise<object> {
    const entries = await this.prisma.glEntry.findMany({
      where: {
        organizationId: orgId,
        referenceType: 'DSA_PAYOUT',
        ...(dto.month
          ? { narration: { contains: dto.month } }
          : {}),
      },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.glEntry.count({
      where: { organizationId: orgId, referenceType: 'DSA_PAYOUT' },
    });

    return {
      data: entries.map((e) => ({
        payoutId: e.referenceId,
        narration: e.narration,
        grossCommissionPaisa: e.debitAmountPaisa,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get all DSAs with their commission rates.
   */
  async listDsaCommissionRates(orgId: string): Promise<object> {
    const dsas = await this.prisma.dSA.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        dsaCode: true,
        name: true,
        dsaType: true,
        commissionPercent: true,
        empanelmentDate: true,
        _count: { select: { loanApplications: true } },
      },
      orderBy: { commissionPercent: 'desc' },
    });

    return {
      data: dsas.map((d) => ({
        dsaId: d.id,
        dsaCode: d.dsaCode,
        name: d.name,
        dsaType: d.dsaType,
        commissionPercent: Number(d.commissionPercent),
        tdsApplicablePercent: TDS_RATE * 100,
        netCommissionPercent:
          Number(d.commissionPercent) * (1 - TDS_RATE),
        totalApplications: d._count.loanApplications,
        empanelmentDate: d.empanelmentDate,
      })),
      total: dsas.length,
    };
  }
}
