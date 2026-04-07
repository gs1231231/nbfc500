import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

export interface BulkResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

@Injectable()
export class BulkService {
  private readonly logger = new Logger(BulkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bulk approve multiple loan applications.
   */
  async bulkApprove(
    orgId: string,
    applicationIds: string[],
    userId: string,
  ): Promise<BulkResult> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const appId of applicationIds) {
      try {
        const app = await this.prisma.loanApplication.findFirst({
          where: { id: appId, organizationId: orgId, deletedAt: null },
        });
        if (!app) {
          failed.push({ id: appId, reason: 'Application not found' });
          continue;
        }
        if (!['CREDIT_REVIEW', 'UNDER_REVIEW', 'SUBMITTED'].includes(app.status)) {
          failed.push({ id: appId, reason: `Cannot approve from status ${app.status}` });
          continue;
        }
        await this.prisma.loanApplication.update({
          where: { id: appId },
          data: { status: 'SANCTIONED', currentWorkflowStage: 'SANCTIONED' },
        });
        this.logger.log(`Bulk approved application ${appId} by ${userId}`);
        succeeded.push(appId);
      } catch (err: any) {
        failed.push({ id: appId, reason: err.message ?? 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Bulk create disbursement requests for multiple applications.
   */
  async bulkDisburse(
    orgId: string,
    applicationIds: string[],
  ): Promise<BulkResult> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const appId of applicationIds) {
      try {
        const app = await this.prisma.loanApplication.findFirst({
          where: { id: appId, organizationId: orgId, deletedAt: null },
        });
        if (!app) {
          failed.push({ id: appId, reason: 'Application not found' });
          continue;
        }
        if (app.status !== 'SANCTIONED') {
          failed.push({ id: appId, reason: `Must be SANCTIONED to disburse, current: ${app.status}` });
          continue;
        }
        await this.prisma.loanApplication.update({
          where: { id: appId },
          data: { status: 'DISBURSED', currentWorkflowStage: 'DISBURSED' },
        });
        this.logger.log(`Bulk disbursement requested for application ${appId}`);
        succeeded.push(appId);
      } catch (err: any) {
        failed.push({ id: appId, reason: err.message ?? 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Present NACH mandates for all EMIs due on a given date.
   */
  async bulkNachPresent(
    orgId: string,
    date: string,
  ): Promise<{ presented: number; date: string }> {
    const dueDate = new Date(date);
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const schedules = await this.prisma.loanSchedule.findMany({
      where: {
        loan: { organizationId: orgId, loanStatus: 'ACTIVE' },
        dueDate: { gte: dueDate, lt: nextDay },
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Bulk NACH presentation: ${schedules.length} EMI(s) for ${date} in org ${orgId}`,
    );

    // In production: trigger payment gateway NACH presentation for each schedule
    // Mock: log and return count
    return { presented: schedules.length, date };
  }

  /**
   * Bulk assign multiple applications to a single officer.
   */
  async bulkAssign(
    orgId: string,
    applicationIds: string[],
    assigneeId: string,
  ): Promise<BulkResult> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const appId of applicationIds) {
      try {
        const app = await this.prisma.loanApplication.findFirst({
          where: { id: appId, organizationId: orgId, deletedAt: null },
        });
        if (!app) {
          failed.push({ id: appId, reason: 'Application not found' });
          continue;
        }
        await this.prisma.loanApplication.update({
          where: { id: appId },
          data: { assignedToId: assigneeId },
        });
        this.logger.log(`Application ${appId} assigned to ${assigneeId}`);
        succeeded.push(appId);
      } catch (err: any) {
        failed.push({ id: appId, reason: err.message ?? 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }
}
