import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { PrismaService } from '@bankos/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RealtimeEventType =
  | 'application.created'
  | 'application.transitioned'
  | 'loan.disbursed'
  | 'payment.received'
  | 'npa.changed';

export interface RealtimeEvent {
  id: string;
  orgId: string;
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface LiveCounters {
  orgId: string;
  activeApplications: number;
  todayDisbursements: number;
  pendingApprovals: number;
  overdueLoans: number;
  totalAum: number;
  asOf: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  // Global event bus — all orgs share one Subject, filtered by orgId per subscriber
  private readonly eventBus$ = new Subject<RealtimeEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return an Observable that emits SSE-compatible message objects
   * for the given org. The client receives only events scoped to their org.
   */
  subscribe(orgId: string): Observable<MessageEvent> {
    return this.eventBus$.asObservable().pipe(
      filter((event) => event.orgId === orgId),
      map(
        (event) =>
          ({
            data: JSON.stringify(event),
          }) as unknown as MessageEvent,
      ),
    );
  }

  /**
   * Push a new event to all subscribers for the given org.
   */
  emit(
    orgId: string,
    type: RealtimeEventType,
    payload: Record<string, unknown>,
  ): void {
    const event: RealtimeEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orgId,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`[SSE] Emitting "${type}" for org ${orgId}`);
    this.eventBus$.next(event);
  }

  /**
   * Compute current live counters for the dashboard.
   */
  async getLiveCounters(orgId: string): Promise<LiveCounters> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeApplications, todayDisbursements, pendingApprovals, loanStats] =
      await Promise.all([
        // Active = not in terminal states
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: { notIn: ['DISBURSED', 'REJECTED', 'CANCELLED', 'EXPIRED'] },
          },
        }),

        // Disbursed today
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'DISBURSED',
            updatedAt: { gte: todayStart },
          },
        }),

        // Pending approvals (UNDERWRITING stage)
        this.prisma.loanApplication.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'UNDERWRITING',
          },
        }),

        // AUM from Loan model
        this.prisma.loan.aggregate({
          where: { organizationId: orgId },
          _count: { id: true },
          _sum: { outstandingPrincipalPaisa: true },
        }),
      ]);

    // Overdue: loan schedules past due date with status PENDING
    const overdueLoans = await this.prisma.loanSchedule.count({
      where: {
        loan: { organizationId: orgId },
        dueDate: { lt: new Date() },
        status: 'PENDING',
      },
    });

    const totalAum = Number(loanStats._sum.outstandingPrincipalPaisa ?? 0);

    return {
      orgId,
      activeApplications,
      todayDisbursements,
      pendingApprovals,
      overdueLoans,
      totalAum,
      asOf: new Date().toISOString(),
    };
  }
}
