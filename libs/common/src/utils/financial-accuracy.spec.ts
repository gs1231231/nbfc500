/**
 * Prompt 66: Financial Accuracy Test Suite
 *
 * 50 additional EMI scenarios verified against Excel PMT formula:
 *   PMT(rate/12, nper, -pv)  →  monthly payment
 *
 * All principal amounts are stored in paisa (1 INR = 100 paisa).
 * All rates are stored in basis points (1 bps = 0.01 %).
 *
 * Verification strategy:
 *   1. Compute expected EMI independently using the same PMT formula
 *      implemented as a pure JS function (no Decimal.js dependency).
 *   2. Allow ±1 paisa rounding tolerance.
 *   3. Generate full amortization schedule and verify:
 *      a) sum of principal components == input principal
 *      b) closing balance of last installment == 0
 */

import { calculateEmi, generateSchedule } from './financial-calculator';

// ---------------------------------------------------------------------------
// Helper: Excel PMT formula in plain JavaScript
//   PMT(r, n, pv) = pv * r * (1+r)^n / ((1+r)^n - 1)
//   Returns the payment amount (positive number = payment to be made).
// ---------------------------------------------------------------------------
function excelPmt(annualRateBps: number, tenureMonths: number, principalPaisa: number): number {
  if (annualRateBps === 0) {
    return Math.round(principalPaisa / tenureMonths);
  }
  const r = annualRateBps / 12 / 10000;
  const n = tenureMonths;
  const factor = Math.pow(1 + r, n);
  return Math.round((principalPaisa * r * factor) / (factor - 1));
}

// ---------------------------------------------------------------------------
// Helper: verify schedule invariants
// ---------------------------------------------------------------------------
function verifySchedule(
  principalPaisa: number,
  annualRateBps: number,
  tenureMonths: number,
): void {
  const disbDate = new Date('2024-01-15');
  const firstEmi = new Date('2024-02-15');
  const schedule = generateSchedule({
    principalPaisa,
    annualRateBps,
    tenureMonths,
    disbursementDate: disbDate,
    firstEmiDate: firstEmi,
  });

  // Schedule length
  expect(schedule).toHaveLength(tenureMonths);

  // Sum of principal == input principal
  const totalPrincipal = schedule.reduce((sum, e) => sum + e.principalPaisa, 0);
  expect(totalPrincipal).toBe(principalPaisa);

  // Last installment closing balance == 0
  expect(schedule[schedule.length - 1].closingBalancePaisa).toBe(0);
}

// ---------------------------------------------------------------------------
// Scenario matrix
// ---------------------------------------------------------------------------

describe('Financial Accuracy: EMI vs Excel PMT formula', () => {

  // ── Group 1: Varying principal at 12% for 24 months ──────────────────────

  it('Scenario 1: Rs 5,000 (500000 paisa) @ 12% for 24 months', () => {
    const principal = 500_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 2: Rs 1L (10000000 paisa) @ 12% for 24 months', () => {
    const principal = 10_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 3: Rs 5L (50000000 paisa) @ 12% for 24 months', () => {
    const principal = 50_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 4: Rs 10L (100000000 paisa) @ 12% for 24 months', () => {
    const principal = 100_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 5: Rs 25L (250000000 paisa) @ 12% for 24 months', () => {
    const principal = 250_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 6: Rs 50L (500000000 paisa) @ 12% for 24 months', () => {
    const principal = 500_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 7: Rs 1Cr (1000000000 paisa) @ 12% for 24 months', () => {
    const principal = 1_000_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 8: Rs 5Cr (5000000000 paisa) @ 12% for 24 months', () => {
    const principal = 5_000_000_000;
    const rate = 1200;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  // ── Group 2: Varying rates at Rs 10L for 36 months ───────────────────────

  it('Scenario 9: Rs 10L @ 8% (800 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 800;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 10: Rs 10L @ 10% (1000 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 1000;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 11: Rs 10L @ 12% (1200 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 1200;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 12: Rs 10L @ 14% (1400 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 1400;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 13: Rs 10L @ 16% (1600 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 1600;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 14: Rs 10L @ 18% (1800 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 1800;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 15: Rs 10L @ 20% (2000 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 2000;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 16: Rs 10L @ 24% (2400 bps) for 36 months', () => {
    const principal = 100_000_000;
    const rate = 2400;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  // ── Group 3: Varying tenures at Rs 20L @ 14% ─────────────────────────────

  it('Scenario 17: Rs 20L @ 14% for 6 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 6;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 18: Rs 20L @ 14% for 12 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 12;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 19: Rs 20L @ 14% for 24 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 20: Rs 20L @ 14% for 36 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 21: Rs 20L @ 14% for 48 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 48;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 22: Rs 20L @ 14% for 60 months', () => {
    const principal = 200_000_000;
    const rate = 1400;
    const tenure = 60;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 23: Rs 20L @ 10% for 120 months (10 years)', () => {
    const principal = 200_000_000;
    const rate = 1000;
    const tenure = 120;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 24: Rs 50L @ 9% for 180 months (15 years)', () => {
    const principal = 500_000_000;
    const rate = 900;
    const tenure = 180;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 25: Rs 1Cr @ 8.5% for 240 months (20 years)', () => {
    const principal = 1_000_000_000;
    const rate = 850;
    const tenure = 240;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 26: Rs 2Cr @ 8% for 360 months (30 years — home loan)', () => {
    const principal = 2_000_000_000;
    const rate = 800;
    const tenure = 360;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  // ── Group 4: Cross-product combinations ──────────────────────────────────

  it('Scenario 27: Personal Loan — Rs 2L @ 18% for 12 months', () => {
    const principal = 20_000_000;
    const rate = 1800;
    const tenure = 12;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 28: Business Loan — Rs 25L @ 16% for 48 months', () => {
    const principal = 250_000_000;
    const rate = 1600;
    const tenure = 48;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 29: Vehicle Finance — Rs 8L @ 10% for 60 months', () => {
    const principal = 80_000_000;
    const rate = 1000;
    const tenure = 60;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 30: LAP — Rs 50L @ 11% for 120 months', () => {
    const principal = 500_000_000;
    const rate = 1100;
    const tenure = 120;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 31: Gold Loan — Rs 3L @ 20% for 6 months', () => {
    const principal = 30_000_000;
    const rate = 2000;
    const tenure = 6;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 32: Microfinance — Rs 50,000 (5000000 paisa) @ 24% for 12 months', () => {
    const principal = 5_000_000;
    const rate = 2400;
    const tenure = 12;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 33: MSME — Rs 75L @ 14.5% for 60 months', () => {
    const principal = 750_000_000;
    const rate = 1450;
    const tenure = 60;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 34: Education Loan — Rs 10L @ 9% for 84 months', () => {
    const principal = 100_000_000;
    const rate = 900;
    const tenure = 84;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 35: Home Loan — Rs 3Cr @ 8.75% for 240 months', () => {
    const principal = 3_000_000_000;
    const rate = 875;
    const tenure = 240;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  // ── Group 5: Edge cases ───────────────────────────────────────────────────

  it('Scenario 36 (edge): Very small loan Rs 5,000 (500000 paisa) @ 18% for 6 months', () => {
    const principal = 500_000; // Rs 5,000
    const rate = 1800;
    const tenure = 6;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 37 (edge): Very large loan Rs 10Cr (10000000000 paisa) @ 9% for 300 months', () => {
    const principal = 10_000_000_000; // Rs 10 Cr
    const rate = 900;
    const tenure = 300;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 38 (edge): Bullet loan 1 month tenure @ 14%', () => {
    const principal = 100_000_000;
    const rate = 1400;
    const tenure = 1;
    // For n=1: EMI = P*(1+r)
    const r = rate / 12 / 10000;
    const expected = Math.round(principal * (1 + r));
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 39 (edge): Very long tenure 30 years (360 months) @ 8% for Rs 1Cr', () => {
    const principal = 1_000_000_000; // Rs 1Cr
    const rate = 800;
    const tenure = 360;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 40 (edge): Zero interest rate loan Rs 12L for 12 months = exactly 1L/month', () => {
    const principal = 120_000_000; // Rs 12L
    const rate = 0;
    const tenure = 12;
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBe(10_000_000); // exactly Rs 1L
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 41 (edge): Odd principal Rs 7,53,219 not evenly divisible', () => {
    const principal = 75_321_900; // Rs 7,53,219
    const rate = 1350;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 42: Rs 1L @ 8% for 36 months (low rate short term)', () => {
    const principal = 10_000_000;
    const rate = 800;
    const tenure = 36;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 43: Rs 5L @ 20% for 12 months (high rate)', () => {
    const principal = 50_000_000;
    const rate = 2000;
    const tenure = 12;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 44: Rs 50L @ 18% for 60 months', () => {
    const principal = 500_000_000;
    const rate = 1800;
    const tenure = 60;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 45: Rs 1Cr @ 10% for 60 months', () => {
    const principal = 1_000_000_000;
    const rate = 1000;
    const tenure = 60;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 46: Rs 25L @ 16% for 24 months', () => {
    const principal = 250_000_000;
    const rate = 1600;
    const tenure = 24;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 47: Rs 5Cr @ 8% for 360 months (large home loan)', () => {
    const principal = 5_000_000_000;
    const rate = 800;
    const tenure = 360;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 48: Rs 1L @ 24% for 6 months (very high rate short term)', () => {
    const principal = 10_000_000;
    const rate = 2400;
    const tenure = 6;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 49: Rs 10L @ 9.5% for 180 months', () => {
    const principal = 100_000_000;
    const rate = 950;
    const tenure = 180;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

  it('Scenario 50: Rs 3L @ 15% for 48 months', () => {
    const principal = 30_000_000;
    const rate = 1500;
    const tenure = 48;
    const expected = excelPmt(rate, tenure, principal);
    const actual = calculateEmi(principal, rate, tenure);
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
    verifySchedule(principal, rate, tenure);
  });

});

// ---------------------------------------------------------------------------
// Cross-scenario invariant checks
// ---------------------------------------------------------------------------

describe('Financial Accuracy: Schedule Invariants', () => {

  it('Higher rate always yields higher EMI for same principal and tenure', () => {
    const principal = 100_000_000;
    const tenure = 36;
    const rates = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2400];
    for (let i = 1; i < rates.length; i++) {
      const lower = calculateEmi(principal, rates[i - 1], tenure);
      const higher = calculateEmi(principal, rates[i], tenure);
      expect(higher).toBeGreaterThan(lower);
    }
  });

  it('Longer tenure yields lower EMI for same principal and rate', () => {
    const principal = 100_000_000;
    const rate = 1400;
    const tenures = [12, 24, 36, 48, 60, 120];
    for (let i = 1; i < tenures.length; i++) {
      const shorter = calculateEmi(principal, rate, tenures[i - 1]);
      const longer = calculateEmi(principal, rate, tenures[i]);
      expect(longer).toBeLessThan(shorter);
    }
  });

  it('EMI is always a positive integer (whole paisa)', () => {
    const cases = [
      [10_000_000, 1200, 24],
      [50_000_000, 1400, 36],
      [100_000_000, 1800, 60],
      [500_000, 2400, 6],
    ] as const;
    for (const [p, r, t] of cases) {
      const emi = calculateEmi(p, r, t);
      expect(emi).toBeGreaterThan(0);
      expect(Number.isInteger(emi)).toBe(true);
    }
  });

  it('EMI * tenure >= principal (total payment covers at least the principal)', () => {
    const cases = [
      [10_000_000, 1200, 24],
      [50_000_000, 1400, 36],
      [100_000_000, 800, 60],
    ] as const;
    for (const [p, r, t] of cases) {
      const emi = calculateEmi(p, r, t);
      expect(emi * t).toBeGreaterThanOrEqual(p);
    }
  });

  it('Schedule sum of interest > 0 for non-zero rate loans', () => {
    const schedule = generateSchedule({
      principalPaisa: 100_000_000,
      annualRateBps: 1400,
      tenureMonths: 36,
      disbursementDate: new Date('2024-01-15'),
      firstEmiDate: new Date('2024-02-15'),
    });
    const totalInterest = schedule.reduce((sum, e) => sum + e.interestPaisa, 0);
    expect(totalInterest).toBeGreaterThan(0);
  });

  it('Interest component decreases monotonically in a standard schedule', () => {
    const schedule = generateSchedule({
      principalPaisa: 100_000_000,
      annualRateBps: 1400,
      tenureMonths: 12,
      disbursementDate: new Date('2024-01-15'),
      firstEmiDate: new Date('2024-02-15'),
    });
    // Exclude last entry (can vary due to rounding)
    for (let i = 1; i < schedule.length - 2; i++) {
      expect(schedule[i].interestPaisa).toBeLessThanOrEqual(schedule[i - 1].interestPaisa);
    }
  });

  it('Principal component increases monotonically in a standard schedule', () => {
    const schedule = generateSchedule({
      principalPaisa: 100_000_000,
      annualRateBps: 1400,
      tenureMonths: 12,
      disbursementDate: new Date('2024-01-15'),
      firstEmiDate: new Date('2024-02-15'),
    });
    // Exclude last entry (can vary due to rounding)
    for (let i = 1; i < schedule.length - 2; i++) {
      expect(schedule[i].principalPaisa).toBeGreaterThanOrEqual(schedule[i - 1].principalPaisa);
    }
  });

});
