import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns high-level counts for today's activity:
   *   - todayApplications: applications created today
   *   - sanctionedCount:   applications currently in SANCTIONED status
   *   - disbursedCount:    applications currently in DISBURSED status
   *   - pendingApproval:   applications currently in UNDERWRITING status (awaiting approval)
   */
  async getStats(orgId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayApplications, sanctionedCount, disbursedCount, pendingApproval] =
      await Promise.all([
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'SANCTIONED',
          },
        }),
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'DISBURSED',
          },
        }),
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'UNDERWRITING',
          },
        }),
      ]);

    return {
      todayApplications,
      sanctionedCount,
      disbursedCount,
      pendingApproval,
    };
  }

  /**
   * Returns applications grouped by status with counts.
   */
  async getPipeline(orgId: string) {
    const grouped = await this.prisma.loanApplication.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      _count: { id: true },
    });

    return grouped.map((row) => ({
      status: row.status,
      count: row._count.id,
    }));
  }

  /**
   * Returns loans grouped by NPA classification with count and total outstanding principal.
   */
  async getNpaSummary(orgId: string) {
    const grouped = await this.prisma.loan.groupBy({
      by: ['npaClassification'],
      where: {
        organizationId: orgId,
      },
      _count: { id: true },
      _sum: { outstandingPrincipalPaisa: true },
    });

    return grouped.map((row) => ({
      npaClassification: row.npaClassification,
      count: row._count.id,
      totalOutstandingPaisa: row._sum.outstandingPrincipalPaisa ?? 0,
    }));
  }

  /**
   * Calculates Collection Efficiency for the current calendar month.
   *
   * CE% = (total collected this month / total due this month) * 100
   *
   * "Total due" = sum of emiAmountPaisa for schedules whose dueDate falls in the
   * current month (across all statuses, since partially paid and overdue are still "due").
   *
   * "Total collected" = sum of amountPaisa for SUCCESS payments made this month.
   */
  async getCollectionEfficiency(orgId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Total EMI due in this calendar month
    const dueAgg = await this.prisma.loanSchedule.aggregate({
      _sum: { emiAmountPaisa: true },
      where: {
        loan: { organizationId: orgId },
        dueDate: { gte: monthStart, lt: monthEnd },
      },
    });

    // Total payments collected (SUCCESS) this month
    const collectedAgg = await this.prisma.payment.aggregate({
      _sum: { amountPaisa: true },
      where: {
        organizationId: orgId,
        status: 'SUCCESS',
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
    });

    const totalDue = dueAgg._sum.emiAmountPaisa ?? 0;
    const totalCollected = collectedAgg._sum.amountPaisa ?? 0;

    const collectionEfficiencyPercent =
      totalDue > 0
        ? Math.round((totalCollected / totalDue) * 10000) / 100
        : 0;

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalDuePaisa: totalDue,
      totalCollectedPaisa: totalCollected,
      collectionEfficiencyPercent,
    };
  }
}
