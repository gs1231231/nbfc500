import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import {
  BureauRequestStatus,
  BureauType,
  BureauPullType,
} from '@prisma/client';
import {
  BureauAdapterConfig,
  BureauCustomerInput,
  BureauPullResult,
  IBureauAdapter,
} from './interfaces/bureau-adapter.interface';
import { MockBureauAdapter } from './adapters/mock-bureau.adapter';
import { CibilBureauAdapter } from './adapters/cibil-bureau.adapter';

/** Cache validity window in milliseconds (30 days) */
const CACHE_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

/** Cost per bureau pull in paisa (₹50 = 5000 paisa) */
const PULL_COST_PAISA = 5_000;

/** Maximum number of attempts for the bureau API call */
const MAX_RETRY_ATTEMPTS = 3;

/** Initial backoff delay for retries in milliseconds */
const RETRY_INITIAL_DELAY_MS = 500;

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Standardised bureau response returned by BureauService methods.
 * Amounts are in paisa (integer) per BankOS conventions.
 */
export interface BureauServiceResponse {
  bureauRequestId: string;
  bureauResponseId: string;
  applicationId: string;
  bureauType: BureauType;
  score: number;
  totalActiveLoans: number;
  /** Sum of all active EMI obligations in paisa */
  totalEmiObligationPaisa: number;
  maxDpdLast12Months: number;
  maxDpdLast24Months: number;
  enquiriesLast3Months: number;
  enquiriesLast6Months: number;
  hasWriteOff: boolean;
  hasSettlement: boolean;
  oldestLoanAgeMonths: number;
  tradelines: unknown[];
  /** ISO 8601 timestamp until which this response is considered valid */
  validUntil: string;
  /** Cost of this pull in paisa */
  costPaisa: number;
  /** Whether the result was served from cache */
  fromCache: boolean;
  pulledAt: string;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call an async operation with a timeout.
 * Rejects with an Error if the operation takes longer than timeoutMs.
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation, timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

/**
 * BureauService orchestrates bureau report pulls, caching, and persistence.
 *
 * Flow for pull():
 *   1. Resolve application + customer from DB
 *   2. Check 30-day cache — return early if valid response exists
 *   3. Create BureauRequest record (INITIATED)
 *   4. Select adapter via BUREAU_ADAPTER env var (default: 'mock')
 *   5. Call adapter with retry (3 attempts, exponential backoff)
 *   6. Persist BureauRequest (SUCCESS/FAILED) + BureauResponse
 *   7. Return structured BureauServiceResponse
 */
@Injectable()
export class BureauService {
  private readonly logger = new Logger(BureauService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mockAdapter: MockBureauAdapter,
    private readonly cibilAdapter: CibilBureauAdapter,
  ) {}

  /**
   * Resolve the correct adapter based on the BUREAU_ADAPTER env variable.
   * Defaults to 'mock' if not set.
   */
  private resolveAdapter(): IBureauAdapter {
    const adapterKey = (process.env['BUREAU_ADAPTER'] ?? 'mock').toLowerCase();
    switch (adapterKey) {
      case 'cibil':
        return this.cibilAdapter;
      case 'mock':
      default:
        return this.mockAdapter;
    }
  }

  /**
   * Call the bureau adapter with retry logic.
   *
   * Retries up to MAX_RETRY_ATTEMPTS times with exponential backoff:
   *   attempt 1: immediate
   *   attempt 2: ~500ms delay
   *   attempt 3: ~1000ms delay
   *
   * @throws the last error if all attempts fail
   */
  private async callAdapterWithRetry(
    adapter: IBureauAdapter,
    customer: BureauCustomerInput,
    config: BureauAdapterConfig,
  ): Promise<BureauPullResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        this.logger.log(
          `Bureau API call attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`,
        );

        const result = await withTimeout(
          adapter.pull(customer, config),
          config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          'bureau pull',
        );

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Bureau attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delayMs = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.log(`Retrying in ${delayMs}ms...`);
          await sleep(delayMs);
        }
      }
    }

    throw lastError ?? new Error('Bureau pull failed after all retries');
  }

  /**
   * Check for a valid cached bureau response for the given application.
   * A response is valid if it was created within the last 30 days.
   */
  private async getCachedResponse(
    applicationId: string,
    bureauType: BureauType,
  ): Promise<BureauServiceResponse | null> {
    const cutoffDate = new Date(Date.now() - CACHE_VALIDITY_MS);

    const cached = await this.prisma.bureauRequest.findFirst({
      where: {
        applicationId,
        bureauType,
        status: BureauRequestStatus.SUCCESS,
        createdAt: { gte: cutoffDate },
      },
      include: {
        bureauResponse: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!cached || !cached.bureauResponse) return null;

    const r = cached.bureauResponse;

    this.logger.log(
      `Cache hit for application ${applicationId} — bureauRequestId: ${cached.id}`,
    );

    return {
      bureauRequestId: cached.id,
      bureauResponseId: r.id,
      applicationId,
      bureauType: cached.bureauType,
      score: r.score ?? -1,
      totalActiveLoans: r.totalActiveLoans ?? 0,
      totalEmiObligationPaisa: r.totalEmiObligationPaisa ?? 0,
      maxDpdLast12Months: r.maxDpdLast12Months ?? 0,
      maxDpdLast24Months: r.maxDpdLast24Months ?? 0,
      enquiriesLast3Months: r.enquiriesLast3Months ?? 0,
      enquiriesLast6Months: r.enquiriesLast6Months ?? 0,
      hasWriteOff: r.hasWriteOff,
      hasSettlement: r.hasSettlement,
      oldestLoanAgeMonths: r.oldestLoanAgeMonths ?? 0,
      tradelines: r.tradelines as unknown[],
      validUntil: r.validUntil.toISOString(),
      costPaisa: 0, // No cost for cached response
      fromCache: true,
      pulledAt: cached.createdAt.toISOString(),
    };
  }

  /**
   * Pull a bureau report for the application.
   *
   * Checks the 30-day cache first. On cache miss, calls the configured
   * bureau adapter (selected via BUREAU_ADAPTER env var) with retry logic,
   * persists the request/response, and returns the parsed report.
   *
   * @param orgId            Organization (tenant) UUID
   * @param applicationId    Loan application UUID
   * @param bureauPreference Which bureau to query (defaults to CIBIL)
   */
  async pull(
    orgId: string,
    applicationId: string,
    bureauPreference: BureauType = BureauType.CIBIL,
  ): Promise<BureauServiceResponse> {
    // 1. Resolve application and customer
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: { customer: true },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found for organization ${orgId}`,
      );
    }

    const customer = application.customer;

    // 2. Cache check
    const cached = await this.getCachedResponse(applicationId, bureauPreference);
    if (cached) return cached;

    this.logger.log(
      `Cache miss for application ${applicationId}. Initiating live bureau pull.`,
    );

    // 3. Create BureauRequest record
    const bureauRequest = await this.prisma.bureauRequest.create({
      data: {
        organizationId: orgId,
        applicationId,
        customerId: customer.id,
        bureauType: bureauPreference,
        pullType: BureauPullType.HARD,
        requestPayload: {
          pan: `${customer.panNumber.substring(0, 2)}***${customer.panNumber.charAt(9)}`,
          name: customer.fullName,
          dateOfBirth: customer.dateOfBirth.toISOString(),
          phone: customer.phone,
          bureauPreference,
        },
        status: BureauRequestStatus.INITIATED,
        costPaisa: PULL_COST_PAISA,
      },
    });

    // 4. Select adapter
    const adapter = this.resolveAdapter();
    const adapterConfig: BureauAdapterConfig = {
      pullType: 'HARD',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    };

    const customerInput: BureauCustomerInput = {
      panNumber: customer.panNumber,
      firstName: customer.firstName,
      lastName: customer.lastName,
      dateOfBirth: customer.dateOfBirth,
      phone: customer.phone,
      email: customer.email,
    };

    // 5. Call adapter with retry and timeout
    let pullResult: BureauPullResult;
    let finalStatus: BureauRequestStatus;

    try {
      pullResult = await this.callAdapterWithRetry(
        adapter,
        customerInput,
        adapterConfig,
      );
      finalStatus = BureauRequestStatus.SUCCESS;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTimeout =
        errorMessage.toLowerCase().includes('timed out');

      finalStatus = isTimeout
        ? BureauRequestStatus.TIMEOUT
        : BureauRequestStatus.FAILED;

      // Update BureauRequest to failed state
      await this.prisma.bureauRequest.update({
        where: { id: bureauRequest.id },
        data: {
          status: finalStatus,
          responsePayload: { error: errorMessage },
        },
      });

      this.logger.error(
        `Bureau pull failed for application ${applicationId}: ${errorMessage}`,
      );

      throw new InternalServerErrorException(
        `Bureau pull failed: ${errorMessage}`,
      );
    }

    // 6. Persist results
    const validUntil = new Date(Date.now() + CACHE_VALIDITY_MS);

    const [updatedRequest, bureauResponse] = await this.prisma.$transaction([
      this.prisma.bureauRequest.update({
        where: { id: bureauRequest.id },
        data: {
          status: finalStatus,
          responsePayload: pullResult.rawResponse as Record<string, never>,
        },
      }),
      this.prisma.bureauResponse.create({
        data: {
          bureauRequestId: bureauRequest.id,
          applicationId,
          score: pullResult.score,
          totalActiveLoans: pullResult.totalActiveLoans,
          totalEmiObligationPaisa: pullResult.totalEmiObligationPaisa,
          maxDpdLast12Months: pullResult.maxDpdLast12Months,
          maxDpdLast24Months: pullResult.maxDpdLast24Months,
          enquiriesLast3Months: pullResult.enquiriesLast3Months,
          enquiriesLast6Months: pullResult.enquiriesLast6Months,
          hasWriteOff: pullResult.hasWriteOff,
          hasSettlement: pullResult.hasSettlement,
          oldestLoanAgeMonths: pullResult.oldestLoanAgeMonths,
          tradelines: pullResult.tradelines as object[],
          validUntil,
        },
      }),
    ]);

    void updatedRequest; // used only for the transaction

    // 7. Return structured response
    return {
      bureauRequestId: bureauRequest.id,
      bureauResponseId: bureauResponse.id,
      applicationId,
      bureauType: bureauPreference,
      score: pullResult.score,
      totalActiveLoans: pullResult.totalActiveLoans,
      totalEmiObligationPaisa: pullResult.totalEmiObligationPaisa,
      maxDpdLast12Months: pullResult.maxDpdLast12Months,
      maxDpdLast24Months: pullResult.maxDpdLast24Months,
      enquiriesLast3Months: pullResult.enquiriesLast3Months,
      enquiriesLast6Months: pullResult.enquiriesLast6Months,
      hasWriteOff: pullResult.hasWriteOff,
      hasSettlement: pullResult.hasSettlement,
      oldestLoanAgeMonths: pullResult.oldestLoanAgeMonths,
      tradelines: pullResult.tradelines,
      validUntil: validUntil.toISOString(),
      costPaisa: PULL_COST_PAISA,
      fromCache: false,
      pulledAt: bureauResponse.createdAt.toISOString(),
    };
  }

  /**
   * Retrieve the most recent successful bureau report for an application.
   *
   * @param orgId         Organization (tenant) UUID
   * @param applicationId Loan application UUID
   * @throws NotFoundException if no report exists
   */
  async getReport(
    orgId: string,
    applicationId: string,
  ): Promise<BureauServiceResponse> {
    // Verify the application belongs to this org
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(
        `Loan application ${applicationId} not found for organization ${orgId}`,
      );
    }

    const request = await this.prisma.bureauRequest.findFirst({
      where: {
        applicationId,
        organizationId: orgId,
        status: BureauRequestStatus.SUCCESS,
      },
      include: { bureauResponse: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!request || !request.bureauResponse) {
      throw new NotFoundException(
        `No bureau report found for application ${applicationId}. Please trigger a pull first.`,
      );
    }

    const r = request.bureauResponse;

    return {
      bureauRequestId: request.id,
      bureauResponseId: r.id,
      applicationId,
      bureauType: request.bureauType,
      score: r.score ?? -1,
      totalActiveLoans: r.totalActiveLoans ?? 0,
      totalEmiObligationPaisa: r.totalEmiObligationPaisa ?? 0,
      maxDpdLast12Months: r.maxDpdLast12Months ?? 0,
      maxDpdLast24Months: r.maxDpdLast24Months ?? 0,
      enquiriesLast3Months: r.enquiriesLast3Months ?? 0,
      enquiriesLast6Months: r.enquiriesLast6Months ?? 0,
      hasWriteOff: r.hasWriteOff,
      hasSettlement: r.hasSettlement,
      oldestLoanAgeMonths: r.oldestLoanAgeMonths ?? 0,
      tradelines: r.tradelines as unknown[],
      validUntil: r.validUntil.toISOString(),
      costPaisa: request.costPaisa ?? 0,
      fromCache: false,
      pulledAt: request.createdAt.toISOString(),
    };
  }
}
