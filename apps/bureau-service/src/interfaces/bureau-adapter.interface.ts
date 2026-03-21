import { BureauType } from '@prisma/client';

/**
 * Standardized tradeline representing a single credit account
 * from a bureau report.
 */
export interface Tradeline {
  /** Lender / institution name */
  lenderName: string;
  /** Type of credit facility e.g. 'PERSONAL_LOAN', 'HOME_LOAN', 'CREDIT_CARD' */
  accountType: string;
  /** Original sanctioned amount in paisa */
  sanctionedAmountPaisa: number;
  /** Current outstanding balance in paisa */
  outstandingAmountPaisa: number;
  /** Current EMI obligation in paisa (0 for closed accounts) */
  emiAmountPaisa: number;
  /** Account open date */
  openedDate: Date;
  /** Account close date if closed */
  closedDate: Date | null;
  /** Whether the account is currently active */
  isActive: boolean;
  /** Maximum days-past-due ever recorded on this account */
  maxDpd: number;
  /** Current DPD */
  currentDpd: number;
  /** Whether this account has been written off */
  hasWriteOff: boolean;
  /** Whether this account has been settled */
  hasSettlement: boolean;
  /** Loan/account tenure in months */
  tenureMonths: number;
}

/**
 * Standardised result returned by every bureau adapter.
 * All monetary values are in paisa (integer).
 */
export interface BureauPullResult {
  /** Bureau that was queried */
  bureauType: BureauType;
  /** Credit score (-1 means no credit history) */
  score: number;
  /** Total number of active loan accounts */
  totalActiveLoans: number;
  /** Sum of all active EMI obligations in paisa */
  totalEmiObligationPaisa: number;
  /** Worst DPD in the last 12 months across all tradelines */
  maxDpdLast12Months: number;
  /** Worst DPD in the last 24 months across all tradelines */
  maxDpdLast24Months: number;
  /** Number of hard enquiries in last 3 months */
  enquiriesLast3Months: number;
  /** Number of hard enquiries in last 6 months */
  enquiriesLast6Months: number;
  /** Whether any account has ever been written off */
  hasWriteOff: boolean;
  /** Whether any account has been settled for less than dues */
  hasSettlement: boolean;
  /** Age of oldest loan/credit account in months */
  oldestLoanAgeMonths: number;
  /** All tradelines returned by the bureau */
  tradelines: Tradeline[];
  /** Raw response payload from the bureau (for audit) */
  rawResponse: Record<string, unknown>;
}

/**
 * Configuration supplied to the adapter at pull time.
 */
export interface BureauAdapterConfig {
  /** BUREAU_ADAPTER-specific API key or credentials */
  apiKey?: string;
  /** Endpoint override for non-production environments */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Type of pull: SOFT (no score impact) or HARD */
  pullType: 'SOFT' | 'HARD';
}

/**
 * Minimal customer data needed to call a bureau.
 * PAN is the primary identifier for CIBIL.
 */
export interface BureauCustomerInput {
  /** Masked/raw PAN — adapters handle masking internally */
  panNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phone: string;
  email?: string | null;
}

/**
 * IBureauAdapter — contract that every bureau adapter must implement.
 *
 * Implementations must be deterministic for the same PAN (mock adapter)
 * or call the respective bureau API (production adapters).
 */
export interface IBureauAdapter {
  /**
   * Pull a bureau report for the given customer.
   *
   * @param customer - Identifying information for the credit enquiry
   * @param config   - Adapter-level configuration (credentials, pull type, timeout)
   * @returns        Standardised BureauPullResult
   * @throws         Error on network failure, timeout or bureau-side rejection
   */
  pull(
    customer: BureauCustomerInput,
    config: BureauAdapterConfig,
  ): Promise<BureauPullResult>;
}
