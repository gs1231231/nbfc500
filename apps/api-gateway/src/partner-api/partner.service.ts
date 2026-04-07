import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import * as crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  partnerName: string;
  apiKey: string; // returned only on creation
  permissions: string[];
  createdAt: string;
}

export interface WebhookRegistration {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

// In-memory stores (production: persist to DB)
const apiKeyStore = new Map<
  string,
  { hashedKey: string; orgId: string; partnerName: string; permissions: string[] }
>();

const webhookStore = new Map<
  string,
  WebhookRegistration[]
>();

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate an API key for a partner.
   * The raw key is returned once; only the SHA-256 hash is stored.
   */
  generateApiKey(
    orgId: string,
    partnerName: string,
    permissions: string[] = ['read', 'write'],
  ): ApiKeyRecord {
    const rawKey = `bos_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
    const id = crypto.randomUUID();

    apiKeyStore.set(id, { hashedKey, orgId, partnerName, permissions });

    this.logger.log(`API key generated for partner "${partnerName}", org ${orgId}`);

    return {
      id,
      orgId,
      partnerName,
      apiKey: rawKey,
      permissions,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Validate a raw API key and return the associated orgId + permissions.
   */
  validateApiKey(
    apiKey: string,
  ): { id: string; orgId: string; partnerName: string; permissions: string[] } {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    for (const [id, record] of apiKeyStore.entries()) {
      if (record.hashedKey === hashedKey) {
        return { id, orgId: record.orgId, partnerName: record.partnerName, permissions: record.permissions };
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Create a customer + application from an external partner lead submission.
   */
  async createLeadViaApi(
    orgId: string,
    leadData: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      panNumber?: string;
      dateOfBirth?: string;
      monthlyIncomePaisa?: number;
      requestedAmountPaisa: number;
      requestedTenureMonths: number;
      productId?: string;
    },
  ): Promise<{ customerId: string; applicationId: string; applicationNumber: string }> {
    // Find or create customer
    let customer = await this.prisma.customer.findFirst({
      where: { organizationId: orgId, phone: leadData.phone, deletedAt: null },
    });

    if (!customer) {
      const pan = leadData.panNumber ?? `XXXXX${Math.floor(Math.random() * 9000 + 1000)}X`;
      const fullName = `${leadData.firstName} ${leadData.lastName}`;
      const customerNumber = `CUST-API-${Date.now()}`;

      customer = await this.prisma.customer.create({
        data: {
          organizationId: orgId,
          customerNumber,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          fullName,
          phone: leadData.phone,
          email: leadData.email ?? undefined,
          panNumber: pan,
          dateOfBirth: leadData.dateOfBirth ? new Date(leadData.dateOfBirth) : new Date('1990-01-01'),
          gender: 'MALE',
          employmentType: 'SALARIED',
          monthlyIncomePaisa: leadData.monthlyIncomePaisa ?? null,
        },
      });
    }

    // Resolve productId — use the provided one or fall back to the first active product for the org
    let productId = leadData.productId;
    if (!productId) {
      const defaultProduct = await this.prisma.loanProduct.findFirst({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (!defaultProduct) {
        throw new NotFoundException(`No loan products configured for org ${orgId}`);
      }
      productId = defaultProduct.id;
    }

    // Resolve branchId — use the first branch for the org
    const defaultBranch = await this.prisma.branch.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultBranch) {
      throw new NotFoundException(`No branches configured for org ${orgId}`);
    }

    // Generate application number
    const applicationNumber = `APP-API-${Date.now()}`;

    const application = await this.prisma.loanApplication.create({
      data: {
        organizationId: orgId,
        branchId: defaultBranch.id,
        customerId: customer.id,
        applicationNumber,
        status: 'LEAD',
        currentWorkflowStage: 'LEAD',
        requestedAmountPaisa: leadData.requestedAmountPaisa,
        requestedTenureMonths: leadData.requestedTenureMonths,
        productId,
        sourceType: 'API',
      },
    });

    this.logger.log(
      `Partner lead created: customer ${customer.id}, application ${application.id}`,
    );

    return {
      customerId: customer.id,
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
    };
  }

  /**
   * Check application status by application number.
   */
  async checkApplicationStatus(
    orgId: string,
    applicationNumber: string,
  ): Promise<{
    applicationNumber: string;
    status: string;
    currentStage: string;
    requestedAmountPaisa: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { organizationId: orgId, applicationNumber, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationNumber} not found`);
    }

    return {
      applicationNumber: application.applicationNumber,
      status: application.status,
      currentStage: application.currentWorkflowStage ?? application.status,
      requestedAmountPaisa: application.requestedAmountPaisa,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  /**
   * Get repayment schedule for a loan by loan number.
   */
  async getRepaymentSchedule(
    orgId: string,
    loanNumber: string,
  ): Promise<{
    loanNumber: string;
    schedule: Array<{
      installmentNumber: number;
      dueDate: string;
      principalPaisa: number;
      interestPaisa: number;
      totalPaisa: number;
      status: string;
    }>;
  }> {
    const loan = await this.prisma.loan.findFirst({
      where: { organizationId: orgId, loanNumber },
      include: {
        schedules: { orderBy: { installmentNumber: 'asc' } },
      },
    });
    if (!loan) {
      throw new NotFoundException(`Loan ${loanNumber} not found`);
    }

    const schedule = loan.schedules.map((inst) => ({
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate.toISOString().slice(0, 10),
      principalPaisa: inst.principalComponentPaisa,
      interestPaisa: inst.interestComponentPaisa,
      totalPaisa: inst.emiAmountPaisa,
      status: inst.status,
    }));

    return { loanNumber, schedule };
  }

  /**
   * Register a webhook URL for specific events.
   */
  registerWebhook(
    orgId: string,
    url: string,
    events: string[],
  ): WebhookRegistration {
    const registration: WebhookRegistration = {
      id: crypto.randomUUID(),
      orgId,
      url,
      events,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const existing = webhookStore.get(orgId) ?? [];
    existing.push(registration);
    webhookStore.set(orgId, existing);

    this.logger.log(
      `Webhook registered for org ${orgId}: ${url} — events: ${events.join(', ')}`,
    );

    return registration;
  }

  /**
   * List all webhooks registered for an org.
   */
  listWebhooks(orgId: string): WebhookRegistration[] {
    return webhookStore.get(orgId) ?? [];
  }

  /**
   * Fire a webhook event to all matching registered URLs for an org.
   * Retries up to 3 times with exponential backoff (1s, 5s, 30s).
   * After 3 failures, marks the webhook as failed (inactive).
   */
  async fireWebhook(
    orgId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ fired: number; failed: number; event: string }> {
    const registrations = (webhookStore.get(orgId) ?? []).filter(
      (w) => w.isActive && w.events.includes(event),
    );

    this.logger.log(
      `Firing webhook event "${event}" to ${registrations.length} endpoint(s) for org ${orgId}`,
    );

    const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];
    let fired = 0;
    let failed = 0;

    for (const reg of registrations) {
      let success = false;

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          this.logger.log(
            `[WEBHOOK] Attempt ${attempt + 1} — POST ${reg.url} — event: ${event}, ` +
              `payload: ${JSON.stringify(payload).slice(0, 120)}`,
          );

          // In production: replace with real HTTP POST via HttpService / fetch
          // Simulate success on first attempt for active webhooks
          // (In real code: const res = await fetch(reg.url, { method: 'POST', body: JSON.stringify({ event, payload }) }); if (!res.ok) throw new Error(…); )
          const simulatedFailure = false; // set true to test retry path
          if (simulatedFailure) throw new Error('HTTP 502 Bad Gateway');

          this.logger.log(`[WEBHOOK] Delivered to ${reg.url} on attempt ${attempt + 1}`);
          success = true;
          break;
        } catch (err: any) {
          this.logger.warn(
            `[WEBHOOK] Attempt ${attempt + 1} failed for ${reg.url}: ${err.message}`,
          );
          if (attempt < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[attempt];
            this.logger.log(`[WEBHOOK] Retrying in ${delay / 1000}s…`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (success) {
        fired++;
      } else {
        failed++;
        // Mark the webhook as inactive after exhausting retries
        const orgWebhooks = webhookStore.get(orgId) ?? [];
        const idx = orgWebhooks.findIndex((w) => w.id === reg.id);
        if (idx !== -1) {
          orgWebhooks[idx] = { ...orgWebhooks[idx], isActive: false };
          webhookStore.set(orgId, orgWebhooks);
        }
        this.logger.error(
          `[WEBHOOK] All retries exhausted for ${reg.url}. Marking as FAILED.`,
        );
      }
    }

    return { fired, failed, event };
  }
}
