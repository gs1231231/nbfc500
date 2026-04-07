import { Decimal } from 'decimal.js';
import { NpaClassification } from '../enums';
import { addMonths, daysBetween, nextBusinessDay } from './date-utils';

// Configure Decimal.js for high-precision financial calculations
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export interface ScheduleEntry {
  installmentNumber: number;
  dueDate: Date;
  emiAmountPaisa: number;
  principalPaisa: number;
  interestPaisa: number;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
}

export interface PrepaymentResult {
  outstandingPrincipal: number;
  accruedInterest: number;
  penalty: number;
  totalPayable: number;
}

/**
 * Calculates EMI (Equated Monthly Instalment) in paisa.
 *
 * Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r = monthly interest rate as decimal (annualRateBps / 12 / 10000)
 *
 * @param principalPaisa  - Loan principal in paisa
 * @param annualRateBps   - Annual interest rate in basis points (e.g. 1400 = 14%)
 * @param tenureMonths    - Loan tenure in months
 * @returns EMI amount in paisa, rounded to nearest paisa
 */
export function calculateEmi(
  principalPaisa: number,
  annualRateBps: number,
  tenureMonths: number,
): number {
  const P = new Decimal(principalPaisa);
  const n = new Decimal(tenureMonths);

  if (annualRateBps === 0) {
    // Zero-interest: EMI = principal / tenure
    return P.div(n).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }

  // Monthly rate as decimal
  const r = new Decimal(annualRateBps).div(12).div(10000);

  // (1 + r)^n
  const onePlusR_n = r.plus(1).pow(n);

  // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  const emi = P.mul(r)
    .mul(onePlusR_n)
    .div(onePlusR_n.minus(1))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return emi.toNumber();
}

/**
 * Generates a full amortization schedule.
 *
 * Handles broken period interest when disbursement to first EMI date
 * is not exactly one month apart. The final installment absorbs any
 * rounding difference to ensure sum of principal = original principal.
 *
 * Due dates falling on Sunday are advanced to Monday.
 *
 * @returns Array of ScheduleEntry objects, one per installment
 */
export function generateSchedule(params: {
  principalPaisa: number;
  annualRateBps: number;
  tenureMonths: number;
  disbursementDate: Date;
  firstEmiDate: Date;
}): ScheduleEntry[] {
  const {
    principalPaisa,
    annualRateBps,
    tenureMonths,
    disbursementDate,
    firstEmiDate,
  } = params;

  const emiPaisa = calculateEmi(principalPaisa, annualRateBps, tenureMonths);

  // Daily rate for broken period calculation
  const annualRate = new Decimal(annualRateBps).div(10000);
  const dailyRate = annualRate.div(365);

  // Monthly rate for regular amortization
  const monthlyRate =
    annualRateBps === 0
      ? new Decimal(0)
      : new Decimal(annualRateBps).div(12).div(10000);

  // Calculate broken period days between disbursement and first EMI date
  const disbDate = new Date(
    disbursementDate.getFullYear(),
    disbursementDate.getMonth(),
    disbursementDate.getDate(),
  );
  const firstEmi = new Date(
    firstEmiDate.getFullYear(),
    firstEmiDate.getMonth(),
    firstEmiDate.getDate(),
  );

  // "Expected" first EMI date if exactly 1 month from disbursement
  const expectedFirstEmiDate = addMonths(disbDate, 1);
  const expectedFirstEmi = new Date(
    expectedFirstEmiDate.getFullYear(),
    expectedFirstEmiDate.getMonth(),
    expectedFirstEmiDate.getDate(),
  );

  // Days between expected and actual first EMI (broken period)
  const brokenPeriodDays =
    (firstEmi.getTime() - expectedFirstEmi.getTime()) / (1000 * 60 * 60 * 24);

  let openingBalance = new Decimal(principalPaisa);
  const schedule: ScheduleEntry[] = [];
  let totalPrincipalPaid = new Decimal(0);

  for (let i = 1; i <= tenureMonths; i++) {
    const isLast = i === tenureMonths;

    // Calculate due date
    let rawDueDate: Date;
    if (i === 1) {
      rawDueDate = new Date(firstEmi);
    } else {
      rawDueDate = addMonths(firstEmi, i - 1);
    }

    // Advance if due date falls on Sunday
    const dueDate =
      rawDueDate.getDay() === 0
        ? new Date(rawDueDate.getTime() + 24 * 60 * 60 * 1000) // Monday
        : rawDueDate;

    let interestPaisa: Decimal;

    if (i === 1 && brokenPeriodDays !== 0) {
      // Broken period: calculate interest for actual days elapsed
      // Days from disbursement to actual first EMI date
      const actualDays = daysBetween(disbDate, firstEmi);
      if (annualRateBps === 0) {
        interestPaisa = new Decimal(0);
      } else {
        interestPaisa = openingBalance
          .mul(dailyRate)
          .mul(actualDays)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      }
    } else {
      // Regular installment: monthly reducing balance interest
      if (annualRateBps === 0) {
        interestPaisa = new Decimal(0);
      } else {
        interestPaisa = openingBalance
          .mul(monthlyRate)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      }
    }

    let principalThisInstalment: Decimal;
    let emiThisInstalment: number;

    if (isLast) {
      // Last installment: absorb all rounding differences
      principalThisInstalment = openingBalance;
      emiThisInstalment = principalThisInstalment
        .plus(interestPaisa)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toNumber();
    } else {
      const emiDecimal = new Decimal(emiPaisa);
      principalThisInstalment = emiDecimal
        .minus(interestPaisa)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

      // Ensure principal doesn't exceed remaining balance (shouldn't happen in normal schedules)
      if (principalThisInstalment.greaterThan(openingBalance)) {
        principalThisInstalment = openingBalance;
      }

      emiThisInstalment = emiPaisa;
    }

    const closingBalance = openingBalance.minus(principalThisInstalment);
    totalPrincipalPaid = totalPrincipalPaid.plus(principalThisInstalment);

    schedule.push({
      installmentNumber: i,
      dueDate,
      emiAmountPaisa: emiThisInstalment,
      principalPaisa: principalThisInstalment.toNumber(),
      interestPaisa: interestPaisa.toNumber(),
      openingBalancePaisa: openingBalance.toNumber(),
      closingBalancePaisa: closingBalance.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    });

    openingBalance = closingBalance.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }

  return schedule;
}

/**
 * Calculates Fixed Obligations to Income Ratio (FOIR).
 *
 * FOIR = (existingEmi + proposedEmi) / monthlyIncome * 100
 *
 * @param monthlyIncomePaisa  - Monthly income in paisa
 * @param existingEmiPaisa    - Sum of existing EMI obligations in paisa
 * @param proposedEmiPaisa    - Proposed new EMI in paisa
 * @returns FOIR as a percentage (0-100)
 */
export function calculateFoir(
  monthlyIncomePaisa: number,
  existingEmiPaisa: number,
  proposedEmiPaisa: number,
): number {
  if (monthlyIncomePaisa === 0) {
    return 0;
  }
  const totalObligations = new Decimal(existingEmiPaisa).plus(proposedEmiPaisa);
  return totalObligations
    .div(monthlyIncomePaisa)
    .mul(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Calculates Days Past Due (DPD).
 *
 * - If paid on or before due date: 0
 * - If paid late: days between dueDate and paymentDate
 * - If not paid (paymentDate is null): days between dueDate and currentDate
 *
 * @param dueDate       - Instalment due date
 * @param paymentDate   - Actual payment date, or null if unpaid
 * @param currentDate   - Today's date (for unpaid calculation)
 * @returns Number of days past due (0 if not overdue)
 */
export function calculateDpd(
  dueDate: Date,
  paymentDate: Date | null,
  currentDate: Date,
): number {
  const due = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  if (paymentDate !== null) {
    const paid = new Date(
      paymentDate.getFullYear(),
      paymentDate.getMonth(),
      paymentDate.getDate(),
    );
    // Paid on time or early
    if (paid <= due) {
      return 0;
    }
    // Paid late
    return daysBetween(due, paid);
  }

  // Not paid: compare due date with current date
  const curr = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  if (curr <= due) {
    return 0;
  }
  return daysBetween(due, curr);
}

/**
 * Classifies an account based on Days Past Due (DPD) per RBI guidelines.
 *
 * 0 DPD        -> STANDARD
 * 1-30 DPD     -> SPECIAL_MENTION_ACCOUNT (SMA-0)
 * 31-60 DPD    -> SPECIAL_MENTION_ACCOUNT (SMA-1) / SUB_STANDARD (depending on context)
 * 61-90 DPD    -> SPECIAL_MENTION_ACCOUNT (SMA-2)
 * 91+ DPD      -> SUB_STANDARD (NPA)
 *
 * @param dpd - Days Past Due
 * @returns NpaClassification enum value
 */
export function classifyNpa(dpd: number): NpaClassification {
  if (dpd === 0) {
    return NpaClassification.STANDARD;
  }
  if (dpd <= 30) {
    return NpaClassification.SMA_0;
  }
  if (dpd <= 60) {
    return NpaClassification.SMA_1;
  }
  if (dpd <= 90) {
    return NpaClassification.SMA_2;
  }
  return NpaClassification.NPA_SUBSTANDARD;
}

/**
 * Provision rates per RBI norms.
 */
const PROVISION_RATES: Record<NpaClassification, Decimal> = {
  [NpaClassification.STANDARD]: new Decimal('0.004'),            // 0.40%
  [NpaClassification.SMA_0]: new Decimal('0.004'),               // 0.40% (same as standard)
  [NpaClassification.SMA_1]: new Decimal('0.004'),               // 0.40%
  [NpaClassification.SMA_2]: new Decimal('0.004'),               // 0.40%
  [NpaClassification.NPA_SUBSTANDARD]: new Decimal('0.15'),      // 15%
  [NpaClassification.NPA_DOUBTFUL_1]: new Decimal('0.25'),       // 25%
  [NpaClassification.NPA_DOUBTFUL_2]: new Decimal('0.40'),       // 40%
  [NpaClassification.NPA_DOUBTFUL_3]: new Decimal('1.00'),       // 100%
  [NpaClassification.NPA_LOSS]: new Decimal('1.00'),             // 100%
};

/**
 * Calculates the required provision amount for a loan.
 *
 * @param classification    - NPA classification of the account
 * @param outstandingPaisa  - Outstanding loan amount in paisa
 * @returns Provision amount in paisa
 */
export function calculateProvision(
  classification: NpaClassification,
  outstandingPaisa: number,
): number {
  const rate = PROVISION_RATES[classification] ?? new Decimal(0);
  return new Decimal(outstandingPaisa)
    .mul(rate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Calculates the total amount payable on prepayment of a loan.
 *
 * Accrued interest = outstanding principal * annual rate * days since last EMI / 365
 * Penalty = outstanding principal * penaltyPercent / 100
 *
 * @param outstandingPrincipalPaisa - Current outstanding principal in paisa
 * @param annualRateBps             - Annual interest rate in basis points
 * @param lastEmiDate               - Date of the last EMI paid
 * @param prepaymentDate            - Date of prepayment
 * @param penaltyPercent            - Prepayment penalty percentage (e.g. 2 for 2%)
 * @returns Object with breakdown: outstandingPrincipal, accruedInterest, penalty, totalPayable (all in paisa)
 */
export function calculatePrepaymentAmount(
  outstandingPrincipalPaisa: number,
  annualRateBps: number,
  lastEmiDate: Date,
  prepaymentDate: Date,
  penaltyPercent: number,
): PrepaymentResult {
  const principal = new Decimal(outstandingPrincipalPaisa);
  const annualRate = new Decimal(annualRateBps).div(10000);
  const dailyRate = annualRate.div(365);

  const days = daysBetween(lastEmiDate, prepaymentDate);

  // Accrued interest since last EMI
  const accruedInterest = principal
    .mul(dailyRate)
    .mul(days)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  // Prepayment penalty on outstanding principal
  const penalty = principal
    .mul(new Decimal(penaltyPercent).div(100))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const totalPayable = principal.plus(accruedInterest).plus(penalty);

  return {
    outstandingPrincipal: principal.toNumber(),
    accruedInterest: accruedInterest.toNumber(),
    penalty: penalty.toNumber(),
    totalPayable: totalPayable.toNumber(),
  };
}

/**
 * Calculate APR (Annual Percentage Rate) using Newton-Raphson IRR
 * Includes all cashflows: disbursement, EMIs, fees
 *
 * @param disbursementPaisa  - Gross loan disbursement in paisa
 * @param emiPaisa           - Monthly EMI in paisa
 * @param tenureMonths       - Loan tenure in months
 * @param totalFeesPaisa     - Total upfront fees deducted in paisa
 * @returns APR in basis points (e.g. 1823 = 18.23%)
 */
export function calculateAPR(
  disbursementPaisa: number,
  emiPaisa: number,
  tenureMonths: number,
  totalFeesPaisa: number,
): number {
  // Net cashflow at t=0: disbursement - fees (what borrower actually receives)
  const netDisbursement = disbursementPaisa - totalFeesPaisa;

  // Newton-Raphson to find monthly rate where NPV = 0
  let monthlyRate = 0.01; // initial guess 1%
  for (let iter = 0; iter < 100; iter++) {
    let npv = -netDisbursement;
    let dnpv = 0;
    for (let t = 1; t <= tenureMonths; t++) {
      const df = Math.pow(1 + monthlyRate, -t);
      npv += emiPaisa * df;
      dnpv += -t * emiPaisa * df / (1 + monthlyRate);
    }
    const adjustment = npv / dnpv;
    monthlyRate -= adjustment;
    if (Math.abs(adjustment) < 1e-10) break;
  }

  // Convert to annual rate in bps
  const annualRate = Math.pow(1 + monthlyRate, 12) - 1;
  return Math.round(annualRate * 10000); // return in bps
}
