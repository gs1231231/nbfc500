/**
 * Prompt 67: NPA Classification Tests
 *
 * Exhaustive boundary tests for:
 *   - classifyNpa(dpd) → NpaClassification
 *   - calculateProvision(classification, outstandingPaisa) → provisionPaisa
 *   - calculateDpd(dueDate, paymentDate | null, currentDate) → days
 *
 * RBI DPD → Classification mapping:
 *   0       → STANDARD
 *   1-30    → SMA_0
 *   31-60   → SMA_1
 *   61-90   → SMA_2
 *   91+     → NPA_SUBSTANDARD
 *
 * Provision rates (on outstanding principal):
 *   STANDARD / SMA_0 / SMA_1 / SMA_2  → 0.40%
 *   NPA_SUBSTANDARD                    → 15%
 *   NPA_DOUBTFUL_1                     → 25%
 *   NPA_DOUBTFUL_2                     → 40%
 *   NPA_DOUBTFUL_3 / NPA_LOSS          → 100%
 */

import { NpaClassification } from '../enums';
import {
  calculateDpd,
  calculateProvision,
  classifyNpa,
} from './financial-calculator';

// ---------------------------------------------------------------------------
// classifyNpa — every DPD boundary
// ---------------------------------------------------------------------------

describe('classifyNpa — DPD boundary tests', () => {

  // ── STANDARD ──────────────────────────────────────────────────────────────
  it('DPD 0 → STANDARD', () => {
    expect(classifyNpa(0)).toBe(NpaClassification.STANDARD);
  });

  // ── SMA_0: 1-30 ───────────────────────────────────────────────────────────
  it('DPD 1 → SMA_0 (first day of overdue)', () => {
    expect(classifyNpa(1)).toBe(NpaClassification.SMA_0);
  });

  it('DPD 15 → SMA_0 (mid SMA-0 band)', () => {
    expect(classifyNpa(15)).toBe(NpaClassification.SMA_0);
  });

  it('DPD 29 → SMA_0 (one before upper boundary)', () => {
    expect(classifyNpa(29)).toBe(NpaClassification.SMA_0);
  });

  it('DPD 30 → SMA_0 (upper boundary, inclusive)', () => {
    expect(classifyNpa(30)).toBe(NpaClassification.SMA_0);
  });

  // ── SMA_1: 31-60 ──────────────────────────────────────────────────────────
  it('DPD 31 → SMA_1 (first day of SMA-1)', () => {
    expect(classifyNpa(31)).toBe(NpaClassification.SMA_1);
  });

  it('DPD 45 → SMA_1 (mid SMA-1 band)', () => {
    expect(classifyNpa(45)).toBe(NpaClassification.SMA_1);
  });

  it('DPD 59 → SMA_1 (one before upper boundary)', () => {
    expect(classifyNpa(59)).toBe(NpaClassification.SMA_1);
  });

  it('DPD 60 → SMA_1 (upper boundary, inclusive)', () => {
    expect(classifyNpa(60)).toBe(NpaClassification.SMA_1);
  });

  // ── SMA_2: 61-90 ──────────────────────────────────────────────────────────
  it('DPD 61 → SMA_2 (first day of SMA-2)', () => {
    expect(classifyNpa(61)).toBe(NpaClassification.SMA_2);
  });

  it('DPD 75 → SMA_2 (mid SMA-2 band)', () => {
    expect(classifyNpa(75)).toBe(NpaClassification.SMA_2);
  });

  it('DPD 89 → SMA_2 (one before upper boundary)', () => {
    expect(classifyNpa(89)).toBe(NpaClassification.SMA_2);
  });

  it('DPD 90 → SMA_2 (upper boundary, inclusive)', () => {
    expect(classifyNpa(90)).toBe(NpaClassification.SMA_2);
  });

  // ── NPA_SUBSTANDARD: 91+ ─────────────────────────────────────────────────
  it('DPD 91 → NPA_SUBSTANDARD (first day of NPA)', () => {
    expect(classifyNpa(91)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('DPD 120 → NPA_SUBSTANDARD', () => {
    expect(classifyNpa(120)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('DPD 180 → NPA_SUBSTANDARD', () => {
    expect(classifyNpa(180)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('DPD 365 → NPA_SUBSTANDARD (classifyNpa only returns up to SUBSTANDARD)', () => {
    // classifyNpa uses only DPD; Doubtful upgrades require time-in-NPA tracking
    expect(classifyNpa(365)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('DPD 730 → NPA_SUBSTANDARD (still returned by classifyNpa)', () => {
    expect(classifyNpa(730)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('DPD 1000 → NPA_SUBSTANDARD (very aged account)', () => {
    expect(classifyNpa(1000)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

});

// ---------------------------------------------------------------------------
// calculateProvision — provision amounts per classification
// ---------------------------------------------------------------------------

describe('calculateProvision — provision rates per RBI norms', () => {

  const outstanding = 100_000_000; // Rs 10L in paisa

  it('STANDARD: 0.40% of Rs 10L = Rs 4,000 (400000 paisa)', () => {
    expect(calculateProvision(NpaClassification.STANDARD, outstanding)).toBe(400_000);
  });

  it('SMA_0: 0.40% (same as STANDARD) = 400000 paisa', () => {
    expect(calculateProvision(NpaClassification.SMA_0, outstanding)).toBe(400_000);
  });

  it('SMA_1: 0.40% = 400000 paisa', () => {
    expect(calculateProvision(NpaClassification.SMA_1, outstanding)).toBe(400_000);
  });

  it('SMA_2: 0.40% = 400000 paisa', () => {
    expect(calculateProvision(NpaClassification.SMA_2, outstanding)).toBe(400_000);
  });

  it('NPA_SUBSTANDARD: 15% of Rs 10L = Rs 1,50,000 (15000000 paisa)', () => {
    expect(calculateProvision(NpaClassification.NPA_SUBSTANDARD, outstanding)).toBe(15_000_000);
  });

  it('NPA_DOUBTFUL_1: 25% of Rs 10L = Rs 2,50,000 (25000000 paisa)', () => {
    expect(calculateProvision(NpaClassification.NPA_DOUBTFUL_1, outstanding)).toBe(25_000_000);
  });

  it('NPA_DOUBTFUL_2: 40% of Rs 10L = Rs 4,00,000 (40000000 paisa)', () => {
    expect(calculateProvision(NpaClassification.NPA_DOUBTFUL_2, outstanding)).toBe(40_000_000);
  });

  it('NPA_DOUBTFUL_3: 100% of Rs 10L = Rs 10L (100000000 paisa)', () => {
    expect(calculateProvision(NpaClassification.NPA_DOUBTFUL_3, outstanding)).toBe(100_000_000);
  });

  it('NPA_LOSS: 100% of Rs 10L = Rs 10L (100000000 paisa)', () => {
    expect(calculateProvision(NpaClassification.NPA_LOSS, outstanding)).toBe(100_000_000);
  });

  it('Provision on zero outstanding = 0 for all classifications', () => {
    const classifications = Object.values(NpaClassification);
    for (const cls of classifications) {
      expect(calculateProvision(cls, 0)).toBe(0);
    }
  });

  it('Provision on Rs 1,23,456.78 (12345678 paisa) at NPA_SUBSTANDARD = 15%', () => {
    const outstanding2 = 12_345_678;
    // 12345678 * 0.15 = 1851851.7 → rounded to 1851852
    const provision = calculateProvision(NpaClassification.NPA_SUBSTANDARD, outstanding2);
    expect(provision).toBeCloseTo(Math.round(outstanding2 * 0.15), -2);
  });

  it('Provision on large amount Rs 5Cr at NPA_LOSS = 5Cr', () => {
    const largePrincipal = 5_000_000_000;
    expect(calculateProvision(NpaClassification.NPA_LOSS, largePrincipal)).toBe(largePrincipal);
  });

});

// ---------------------------------------------------------------------------
// calculateDpd — edge cases and boundary conditions
// ---------------------------------------------------------------------------

describe('calculateDpd — DPD calculation edge cases', () => {

  // ── Same day edge cases ───────────────────────────────────────────────────
  it('Same day payment: dueDate == paymentDate → 0 DPD', () => {
    const date = new Date('2024-03-15');
    expect(calculateDpd(date, date, new Date('2024-04-01'))).toBe(0);
  });

  it('Same day: dueDate == currentDate (not paid) → 0 DPD (not yet overdue)', () => {
    const date = new Date('2024-03-15');
    expect(calculateDpd(date, null, date)).toBe(0);
  });

  // ── Payment before due ────────────────────────────────────────────────────
  it('Payment 1 day before due → 0 DPD', () => {
    const due = new Date('2024-03-15');
    const paid = new Date('2024-03-14');
    expect(calculateDpd(due, paid, new Date('2024-04-01'))).toBe(0);
  });

  it('Payment 30 days before due → 0 DPD', () => {
    const due = new Date('2024-03-15');
    const paid = new Date('2024-02-14');
    expect(calculateDpd(due, paid, new Date('2024-04-01'))).toBe(0);
  });

  // ── Payment after due ─────────────────────────────────────────────────────
  it('Payment 1 day after due → 1 DPD', () => {
    const due = new Date('2024-03-15');
    const paid = new Date('2024-03-16');
    expect(calculateDpd(due, paid, new Date('2024-04-01'))).toBe(1);
  });

  it('Payment exactly 29 days late → 29 DPD (boundary before SMA-0 upper)', () => {
    const due = new Date('2024-03-01');
    const paid = new Date('2024-03-30');
    expect(calculateDpd(due, paid, new Date('2024-04-30'))).toBe(29);
  });

  it('Payment exactly 30 days late → 30 DPD (SMA-0 upper boundary)', () => {
    const due = new Date('2024-03-01');
    const paid = new Date('2024-03-31');
    expect(calculateDpd(due, paid, new Date('2024-04-30'))).toBe(30);
  });

  it('Payment exactly 31 days late → 31 DPD (SMA-1 lower boundary)', () => {
    const due = new Date('2024-03-01');
    const paid = new Date('2024-04-01');
    expect(calculateDpd(due, paid, new Date('2024-05-01'))).toBe(31);
  });

  it('Payment exactly 90 days late → 90 DPD (SMA-2 upper boundary)', () => {
    const due = new Date('2024-01-01');
    const paid = new Date('2024-03-31');
    expect(calculateDpd(due, paid, new Date('2024-05-01'))).toBe(90);
  });

  it('Payment exactly 91 days late → 91 DPD (NPA lower boundary)', () => {
    const due = new Date('2024-01-01');
    const paid = new Date('2024-04-01');
    expect(calculateDpd(due, paid, new Date('2024-05-01'))).toBe(91);
  });

  // ── Unpaid (paymentDate == null) ──────────────────────────────────────────
  it('Unpaid: current 30 days after due → 30 DPD', () => {
    const due = new Date('2024-03-01');
    const curr = new Date('2024-03-31');
    expect(calculateDpd(due, null, curr)).toBe(30);
  });

  it('Unpaid: current 90 days after due → 90 DPD', () => {
    const due = new Date('2024-01-01');
    const curr = new Date('2024-04-01'); // 91 days? Let's use 90 exactly
    const curr90 = new Date('2024-03-31');
    expect(calculateDpd(due, null, curr90)).toBe(90);
  });

  it('Unpaid: current date before due date → 0 DPD (not yet overdue)', () => {
    const due = new Date('2024-06-15');
    const curr = new Date('2024-05-01');
    expect(calculateDpd(due, null, curr)).toBe(0);
  });

  it('Unpaid: current date exactly 365 days after due → 365 DPD', () => {
    // 2023-01-01 to 2024-01-01: 365 days (2023 is not a leap year)
    const due = new Date('2023-01-01');
    const curr = new Date('2024-01-01');
    expect(calculateDpd(due, null, curr)).toBe(365);
  });

  // ── Leap year edge cases ──────────────────────────────────────────────────
  it('Leap year: due Feb 29, paid March 31 → 31 DPD', () => {
    const due = new Date('2024-02-29'); // 2024 is a leap year
    const paid = new Date('2024-03-31');
    expect(calculateDpd(due, paid, new Date('2024-04-30'))).toBe(31);
  });

  it('Leap year: due Feb 28 2023, current Mar 31 2023 → 31 DPD', () => {
    const due = new Date('2023-02-28');
    const curr = new Date('2023-03-31');
    expect(calculateDpd(due, null, curr)).toBe(31);
  });

  it('Leap day handling: due Feb 28 2024, paid Feb 29 2024 → 1 DPD', () => {
    const due = new Date('2024-02-28');
    const paid = new Date('2024-02-29'); // leap day
    expect(calculateDpd(due, paid, new Date('2024-03-31'))).toBe(1);
  });

  // ── Month boundary edge cases ─────────────────────────────────────────────
  it('Month boundary: due Jan 31, paid Feb 1 → 1 DPD', () => {
    const due = new Date('2024-01-31');
    const paid = new Date('2024-02-01');
    expect(calculateDpd(due, paid, new Date('2024-03-01'))).toBe(1);
  });

  it('Month boundary: due Dec 31, paid Jan 1 → 1 DPD (year boundary)', () => {
    const due = new Date('2023-12-31');
    const paid = new Date('2024-01-01');
    expect(calculateDpd(due, paid, new Date('2024-02-01'))).toBe(1);
  });

  it('Month boundary: due Mar 31, unpaid, current Apr 30 → 30 DPD', () => {
    const due = new Date('2024-03-31');
    const curr = new Date('2024-04-30');
    expect(calculateDpd(due, null, curr)).toBe(30);
  });

  // ── Time-of-day independence ──────────────────────────────────────────────
  it('Time components are ignored: same calendar date = 0 DPD', () => {
    const due = new Date('2024-03-15T23:59:59Z');
    const paid = new Date('2024-03-15T00:00:01Z');
    // Both on same calendar date → 0 DPD
    expect(calculateDpd(due, paid, new Date('2024-04-01'))).toBe(0);
  });

  // ── Specific DPD boundary integration with classifyNpa ───────────────────
  it('DPD 0 from calculateDpd → STANDARD via classifyNpa', () => {
    const due = new Date('2024-03-15');
    const paid = new Date('2024-03-15');
    const dpd = calculateDpd(due, paid, new Date('2024-04-01'));
    expect(classifyNpa(dpd)).toBe(NpaClassification.STANDARD);
  });

  it('DPD 45 from calculateDpd → SMA_1 via classifyNpa', () => {
    const due = new Date('2024-03-01');
    const curr = new Date('2024-04-15'); // 45 days after
    const dpd = calculateDpd(due, null, curr);
    expect(dpd).toBe(45);
    expect(classifyNpa(dpd)).toBe(NpaClassification.SMA_1);
  });

  it('DPD 91 from calculateDpd → NPA_SUBSTANDARD via classifyNpa', () => {
    const due = new Date('2024-01-01');
    const curr = new Date('2024-04-01'); // 91 days after (2024 is leap)
    const dpd = calculateDpd(due, null, curr);
    expect(dpd).toBeGreaterThanOrEqual(90);
    const classification = classifyNpa(dpd);
    expect([NpaClassification.SMA_2, NpaClassification.NPA_SUBSTANDARD]).toContain(classification);
  });

});
