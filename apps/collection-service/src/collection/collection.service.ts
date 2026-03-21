import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@bankos/database';
import {
  CollectionTaskType,
  CollectionTaskStatus,
  CollectionDisposition,
  LoanStatus,
} from '@prisma/client';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateDispositionDto } from './dto/update-disposition.dto';

// ---------------------------------------------------------------------------
// Collection strategy configuration (hardcoded per RBI/NBFC norms)
// ---------------------------------------------------------------------------

interface StrategyAction {
  dayOffset: number; // days from first overdue date to trigger this action
  taskType: CollectionTaskType;
}

interface CollectionStrategy {
  name: string;
  minDpd: number;
  maxDpd: number;
  actions: StrategyAction[];
}

const COLLECTION_STRATEGIES: CollectionStrategy[] = [
  {
    name: 'Strategy A',
    minDpd: 1,
    maxDpd: 30,
    actions: [
      { dayOffset: 1, taskType: CollectionTaskType.SMS },
      { dayOffset: 3, taskType: CollectionTaskType.WHATSAPP },
      { dayOffset: 7, taskType: CollectionTaskType.IVR },
      { dayOffset: 10, taskType: CollectionTaskType.TELECALL },
      { dayOffset: 15, taskType: CollectionTaskType.WHATSAPP },
      { dayOffset: 25, taskType: CollectionTaskType.FIELD_VISIT },
    ],
  },
  {
    name: 'Strategy B',
    minDpd: 31,
    maxDpd: 60,
    actions: [
      { dayOffset: 1, taskType: CollectionTaskType.TELECALL },
      { dayOffset: 5, taskType: CollectionTaskType.FIELD_VISIT },
      { dayOffset: 15, taskType: CollectionTaskType.LEGAL_NOTICE },
      { dayOffset: 30, taskType: CollectionTaskType.LEGAL_NOTICE },
    ],
  },
  {
    name: 'Strategy C',
    minDpd: 61,
    maxDpd: 90,
    actions: [
      { dayOffset: 1, taskType: CollectionTaskType.LEGAL_NOTICE },
      { dayOffset: 7, taskType: CollectionTaskType.TELECALL },
      { dayOffset: 15, taskType: CollectionTaskType.FIELD_VISIT },
      { dayOffset: 25, taskType: CollectionTaskType.AGENCY_ALLOCATION },
    ],
  },
];

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

export interface DpdBucket {
  label: string;
  minDpd: number;
  maxDpd: number;
  loanCount: number;
  totalOverduePaisa: number;
}

export interface CollectionDashboard {
  asOfDate: Date;
  totalOverdueLoans: number;
  totalOverduePaisa: number;
  buckets: DpdBucket[];
  pendingTasksCount: number;
  completedTasksToday: number;
  collectionEfficiencyPercent: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scheduled daily allocation job — runs at 01:00 IST (19:30 UTC previous day).
   * Iterates all organizations and runs allocation for each.
   */
  @Cron('30 19 * * *', { name: 'daily-collection-allocation', timeZone: 'UTC' })
  async scheduledDailyAllocation(): Promise<void> {
    this.logger.log('Starting scheduled daily collection allocation job');

    const organizations = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const org of organizations) {
      try {
        const result = await this.runDailyAllocation(org.id);
        this.logger.log(
          `Allocation for org ${org.name}: created=${result.createdTasksCount}, loans=${result.processedLoansCount}`,
        );
      } catch (error) {
        this.logger.error(
          `Allocation failed for org ${org.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  /**
   * Runs daily collection task allocation for a given organization.
   *
   * For each overdue active loan in the org:
   *   1. Determine DPD from loan.dpd.
   *   2. Match the applicable strategy based on DPD range.
   *   3. Find if today's action (dayOffset === DPD) exists in strategy.
   *   4. If a matching action exists and no identical task was created today, create CollectionTask.
   *
   * @param orgId - Organization ID to run allocation for.
   */
  async runDailyAllocation(
    orgId: string,
  ): Promise<{ processedLoansCount: number; createdTasksCount: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Fetch all active overdue loans (dpd > 0) for the org
    const overdueLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        loanStatus: LoanStatus.ACTIVE,
        dpd: { gt: 0 },
      },
    });

    let createdTasksCount = 0;

    for (const loan of overdueLoans) {
      try {
        const dpd = loan.dpd;

        // Match strategy based on DPD range
        const strategy = COLLECTION_STRATEGIES.find(
          (s) => dpd >= s.minDpd && dpd <= s.maxDpd,
        );

        if (!strategy) {
          // DPD > 90 (NPA territory) — no automated strategy; handled separately
          continue;
        }

        // Find action whose dayOffset matches today's DPD
        const todayAction = strategy.actions.find((a) => a.dayOffset === dpd);

        if (!todayAction) {
          // No action scheduled for today's DPD position
          continue;
        }

        // Idempotency: check if a task of this type was already created today for this loan
        const existingTask = await this.prisma.collectionTask.findFirst({
          where: {
            loanId: loan.id,
            taskType: todayAction.taskType,
            scheduledDate: {
              gte: today,
              lt: tomorrowStart,
            },
          },
        });

        if (existingTask) {
          this.logger.debug(
            `Task ${todayAction.taskType} already exists for loan ${loan.loanNumber} today — skipping`,
          );
          continue;
        }

        await this.prisma.collectionTask.create({
          data: {
            organizationId: loan.organizationId,
            loanId: loan.id,
            dpdAtCreation: dpd,
            taskType: todayAction.taskType,
            scheduledDate: today,
            status: CollectionTaskStatus.PENDING,
          },
        });

        createdTasksCount++;
      } catch (error) {
        this.logger.error(
          `Failed to allocate task for loan ${loan.loanNumber}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return {
      processedLoansCount: overdueLoans.length,
      createdTasksCount,
    };
  }

  /**
   * Lists collection tasks with optional filters.
   *
   * @param query - Filter params: status, assignedToId, loanId, page, limit.
   * @returns Paginated list of collection tasks with associated loan data.
   */
  async listTasks(query: ListTasksDto) {
    const { status, assignedToId, loanId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (loanId) where.loanId = loanId;

    const [tasks, totalItems] = await Promise.all([
      this.prisma.collectionTask.findMany({
        where,
        include: {
          loan: {
            select: {
              loanNumber: true,
              outstandingPrincipalPaisa: true,
              totalOverduePaisa: true,
              dpd: true,
              npaClassification: true,
              customer: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { scheduledDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.collectionTask.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasPreviousPage: page > 1,
        hasNextPage: page * limit < totalItems,
      },
    };
  }

  /**
   * Records a disposition against a collection task.
   *
   * Validates PTP requires ptpDate and ptpAmountPaisa.
   * Marks task as COMPLETED and records completedDate.
   *
   * @param taskId - Collection task ID.
   * @param dto    - Disposition details.
   * @returns Updated collection task.
   */
  async updateDisposition(taskId: string, dto: UpdateDispositionDto) {
    const task = await this.prisma.collectionTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Collection task ${taskId} not found`);
    }

    if (
      task.status === CollectionTaskStatus.COMPLETED ||
      task.status === CollectionTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Task is already ${task.status} and cannot be updated`,
      );
    }

    // Validate PTP requires date and amount
    if (dto.disposition === CollectionDisposition.PTP) {
      if (!dto.ptpDate) {
        throw new BadRequestException(
          'ptpDate is required when disposition is PTP',
        );
      }
      if (!dto.ptpAmountPaisa || dto.ptpAmountPaisa <= 0) {
        throw new BadRequestException(
          'ptpAmountPaisa is required and must be positive when disposition is PTP',
        );
      }
    }

    const updatedTask = await this.prisma.collectionTask.update({
      where: { id: taskId },
      data: {
        disposition: dto.disposition,
        ptpDate: dto.ptpDate ? new Date(dto.ptpDate) : null,
        ptpAmountPaisa: dto.ptpAmountPaisa ?? null,
        remarks: dto.remarks ?? null,
        status: CollectionTaskStatus.COMPLETED,
        completedDate: new Date(),
      },
      include: {
        loan: {
          select: {
            loanNumber: true,
            dpd: true,
            npaClassification: true,
          },
        },
      },
    });

    return updatedTask;
  }

  /**
   * Generates a collection dashboard with DPD bucket summary and efficiency metrics.
   *
   * DPD buckets: 1-30, 31-60, 61-90, 91+
   * Collection efficiency = (tasks completed today / tasks scheduled today) * 100
   *
   * @param orgId - Organization ID.
   * @returns Dashboard data.
   */
  async getDashboard(orgId: string): Promise<CollectionDashboard> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const DPD_BUCKETS = [
      { label: 'SMA-0 (1-30 DPD)', minDpd: 1, maxDpd: 30 },
      { label: 'SMA-1 (31-60 DPD)', minDpd: 31, maxDpd: 60 },
      { label: 'SMA-2 (61-90 DPD)', minDpd: 61, maxDpd: 90 },
      { label: 'NPA (91+ DPD)', minDpd: 91, maxDpd: 9999 },
    ];

    // Fetch all overdue active loans for the org
    const overdueLoans = await this.prisma.loan.findMany({
      where: {
        organizationId: orgId,
        loanStatus: LoanStatus.ACTIVE,
        dpd: { gt: 0 },
      },
      select: {
        dpd: true,
        totalOverduePaisa: true,
      },
    });

    // Build bucket summaries
    const buckets: DpdBucket[] = DPD_BUCKETS.map((bucket) => {
      const loansInBucket = overdueLoans.filter(
        (l) => l.dpd >= bucket.minDpd && l.dpd <= bucket.maxDpd,
      );
      return {
        label: bucket.label,
        minDpd: bucket.minDpd,
        maxDpd: bucket.maxDpd,
        loanCount: loansInBucket.length,
        totalOverduePaisa: loansInBucket.reduce(
          (sum, l) => sum + l.totalOverduePaisa,
          0,
        ),
      };
    });

    const totalOverdueLoans = overdueLoans.length;
    const totalOverduePaisa = overdueLoans.reduce(
      (sum, l) => sum + l.totalOverduePaisa,
      0,
    );

    // Pending tasks count
    const pendingTasksCount = await this.prisma.collectionTask.count({
      where: {
        organizationId: orgId,
        status: CollectionTaskStatus.PENDING,
      },
    });

    // Tasks scheduled today
    const tasksScheduledToday = await this.prisma.collectionTask.count({
      where: {
        organizationId: orgId,
        scheduledDate: {
          gte: today,
          lt: tomorrowStart,
        },
      },
    });

    // Tasks completed today
    const completedTasksToday = await this.prisma.collectionTask.count({
      where: {
        organizationId: orgId,
        status: CollectionTaskStatus.COMPLETED,
        completedDate: {
          gte: today,
          lt: tomorrowStart,
        },
      },
    });

    const collectionEfficiencyPercent =
      tasksScheduledToday > 0
        ? Math.round((completedTasksToday / tasksScheduledToday) * 10000) / 100
        : 0;

    return {
      asOfDate: today,
      totalOverdueLoans,
      totalOverduePaisa,
      buckets,
      pendingTasksCount,
      completedTasksToday,
      collectionEfficiencyPercent,
    };
  }
}
