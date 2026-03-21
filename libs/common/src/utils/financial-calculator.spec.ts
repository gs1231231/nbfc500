import { NpaClassification } from '../enums';
import {
  calculateDpd,
  calculateEmi,
  calculateFoir,
  calculatePrepaymentAmount,
  calculateProvision,
  classifyNpa,
  generateSchedule,
} from './financial-calculator';
import { isValidPan, isValidPhone } from './validators';

// ---------------------------------------------------------------------------
// EMI Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateEmi', () => {
  it('Test 1: Rs 10L (100000000 paisa) at 14% (1400 bps) for 36 months ≈ 3417800 paisa', () => {
    const emi = calculateEmi(100_000_000, 1400, 36);
    // Excel PMT(14%/12, 36, -1000000) = 34178 rupees = 3417800 paisa
    expect(emi).toBeGreaterThanOrEqual(3_417_600);
    expect(emi).toBeLessThanOrEqual(3_418_000);
  });

  it('Test 2: Rs 5L (50000000 paisa) at 18% (1800 bps) for 24 months ≈ 2496200 paisa', () => {
    const emi = calculateEmi(50_000_000, 1800, 24);
    // Excel PMT(18%/12, 24, -500000) = 24962 rupees = 2496200 paisa
    expect(emi).toBeGreaterThanOrEqual(2_496_000);
    expect(emi).toBeLessThanOrEqual(2_496_400);
  });

  it('Test 3: Rs 50L (500000000 paisa) at 10% (1000 bps) for 180 months ≈ 5373000 paisa', () => {
    const emi = calculateEmi(500_000_000, 1000, 180);
    // Excel PMT(10%/12, 180, -5000000) = 53730 rupees = 5373000 paisa
    expect(emi).toBeGreaterThanOrEqual(5_372_800);
    expect(emi).toBeLessThanOrEqual(5_373_200);
  });

  it('Test 4: Rs 1L (10000000 paisa) at 24% (2400 bps) for 12 months ≈ 945596 paisa', () => {
    const emi = calculateEmi(10_000_000, 2400, 12);
    // Excel PMT(24%/12, 12, -100000) = Rs 9455.96 = 945596 paisa
    // r = 2% monthly, (1.02)^12 = 1.2682418, EMI = 100000*0.02*1.2682/(0.2682) = 9455.96
    expect(emi).toBeGreaterThanOrEqual(945_400);
    expect(emi).toBeLessThanOrEqual(945_800);
  });

  it('Test 5: EMI with 0% interest rate = principal / tenure exactly', () => {
    const emi = calculateEmi(12_000_000, 0, 12);
    expect(emi).toBe(1_000_000);
  });

  it('Test 6: Bullet loan (1 month tenure) at 12% = principal + 1 month interest', () => {
    const principal = 10_000_000; // Rs 1L
    const emi = calculateEmi(principal, 1200, 1);
    // For n=1: EMI = P*(r*(1+r))/(1+r-1) = P*r*(1+r)/r = P*(1+r)
    // r = 1200/12/10000 = 0.01, EMI = 10000000 * 1.01 = 10100000
    expect(emi).toBe(10_100_000);
  });

  it('Test 7 (additional): Returns integer (no fractional paisa)', () => {
    const emi = calculateEmi(75_000_000, 1650, 48);
    expect(Number.isInteger(emi)).toBe(true);
  });

  it('Test 8 (additional): Higher rate yields higher EMI for same principal & tenure', () => {
    const emiLow = calculateEmi(50_000_000, 1000, 24);
    const emiHigh = calculateEmi(50_000_000, 2000, 24);
    expect(emiHigh).toBeGreaterThan(emiLow);
  });
});

// ---------------------------------------------------------------------------
// Amortization Schedule Tests
// ---------------------------------------------------------------------------

describe('generateSchedule', () => {
  const defaultParams = {
    principalPaisa: 100_000_000, // Rs 10L
    annualRateBps: 1400,
    tenureMonths: 36,
    disbursementDate: new Date('2024-01-15'),
    firstEmiDate: new Date('2024-02-15'),
  };

  it('Test 9: Sum of all principal components MUST exactly equal input principal', () => {
    const schedule = generateSchedule(defaultParams);
    const totalPrincipal = schedule.reduce(
      (sum, e) => sum + e.principalPaisa,
      0,
    );
    expect(totalPrincipal).toBe(defaultParams.principalPaisa);
  });

  it('Test 10: First installment interest > last installment interest (reducing balance)', () => {
    const schedule = generateSchedule(defaultParams);
    expect(schedule[0].interestPaisa).toBeGreaterThan(
      schedule[schedule.length - 1].interestPaisa,
    );
  });

  it('Test 11: Closing balance of last installment = 0', () => {
    const schedule = generateSchedule(defaultParams);
    const lastEntry = schedule[schedule.length - 1];
    expect(lastEntry.closingBalancePaisa).toBe(0);
  });

  it('Test 12: Schedule has correct number of entries (tenure months)', () => {
    const schedule = generateSchedule(defaultParams);
    expect(schedule).toHaveLength(36);
  });

  it('Test 13: Opening balance of first entry = principal', () => {
    const schedule = generateSchedule(defaultParams);
    expect(schedule[0].openingBalancePaisa).toBe(defaultParams.principalPaisa);
  });

  it('Test 14: Each entry closing balance = next entry opening balance', () => {
    const schedule = generateSchedule(defaultParams);
    for (let i = 0; i < schedule.length - 1; i++) {
      expect(schedule[i].closingBalancePaisa).toBe(
        schedule[i + 1].openingBalancePaisa,
      );
    }
  });

  it('Test 15: Broken period interest - disbursement mid-month to 5th', () => {
    const brokenParams = {
      principalPaisa: 100_000_000,
      annualRateBps: 1400,
      tenureMonths: 36,
      disbursementDate: new Date('2024-01-20'),
      firstEmiDate: new Date('2024-03-05'),
    };
    const schedule = generateSchedule(brokenParams);
    // Should still have 36 entries
    expect(schedule).toHaveLength(36);
    // Sum of principals must still equal input
    const totalPrincipal = schedule.reduce(
      (sum, e) => sum + e.principalPaisa,
      0,
    );
    expect(totalPrincipal).toBe(brokenParams.principalPaisa);
  });

  it('Test 16: Due date advanced from Sunday to Monday', () => {
    // Find params where first EMI falls on a Sunday
    // 2024-03-03 is a Sunday
    const sundayParams = {
      principalPaisa: 10_000_000,
      annualRateBps: 1200,
      tenureMonths: 12,
      disbursementDate: new Date('2024-02-03'),
      firstEmiDate: new Date('2024-03-03'), // Sunday
    };
    const schedule = generateSchedule(sundayParams);
    // First EMI should be Monday 2024-03-04
    expect(schedule[0].dueDate.getDay()).not.toBe(0); // Not Sunday
    expect(schedule[0].dueDate.getDate()).toBe(4); // Monday the 4th
  });

  it('Test 17: Schedule for large amount (Rs 5Cr = 500000000000 paisa) at 10% for 240 months', () => {
    const largeParams = {
      principalPaisa: 500_000_000_000, // Rs 5Cr
      annualRateBps: 1000,
      tenureMonths: 240,
      disbursementDate: new Date('2024-01-01'),
      firstEmiDate: new Date('2024-02-01'),
    };
    const schedule = generateSchedule(largeParams);
    expect(schedule).toHaveLength(240);
    const totalPrincipal = schedule.reduce(
      (sum, e) => sum + e.principalPaisa,
      0,
    );
    expect(totalPrincipal).toBe(largeParams.principalPaisa);
    expect(schedule[schedule.length - 1].closingBalancePaisa).toBe(0);
  });

  it('Test 18: Total EMI paid ≈ principal + total interest (within 200 paisa)', () => {
    const schedule = generateSchedule(defaultParams);
    const totalEmi = schedule.reduce((sum, e) => sum + e.emiAmountPaisa, 0);
    const totalInterest = schedule.reduce(
      (sum, e) => sum + e.interestPaisa,
      0,
    );
    expect(Math.abs(totalEmi - (defaultParams.principalPaisa + totalInterest))).toBeLessThanOrEqual(200);
  });

  it('Test 19: Installment numbers are sequential from 1 to n', () => {
    const schedule = generateSchedule(defaultParams);
    schedule.forEach((entry, idx) => {
      expect(entry.installmentNumber).toBe(idx + 1);
    });
  });

  it('Test 20: Multiple schedules generated back-to-back have no shared state', () => {
    const schedule1 = generateSchedule(defaultParams);
    const schedule2 = generateSchedule({
      ...defaultParams,
      principalPaisa: 50_000_000,
    });
    // They should be independent
    expect(schedule1[0].openingBalancePaisa).toBe(100_000_000);
    expect(schedule2[0].openingBalancePaisa).toBe(50_000_000);
  });
});

// ---------------------------------------------------------------------------
// FOIR Tests
// ---------------------------------------------------------------------------

describe('calculateFoir', () => {
  it('Test 21: FOIR: income 7500000, existing 1500000, proposed 2000000 = 46.67%', () => {
    const foir = calculateFoir(7_500_000, 1_500_000, 2_000_000);
    expect(foir).toBeCloseTo(46.67, 1);
  });

  it('Test 22: FOIR: income 5000000, existing 0, proposed 2500000 = 50%', () => {
    const foir = calculateFoir(5_000_000, 0, 2_500_000);
    expect(foir).toBe(50);
  });

  it('Test 23: FOIR: zero income returns 0', () => {
    const foir = calculateFoir(0, 500_000, 300_000);
    expect(foir).toBe(0);
  });

  it('Test 24: FOIR: no obligations = 0%', () => {
    const foir = calculateFoir(5_000_000, 0, 0);
    expect(foir).toBe(0);
  });

  it('Test 25: FOIR: obligations equal income = 100%', () => {
    const foir = calculateFoir(3_000_000, 1_500_000, 1_500_000);
    expect(foir).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// DPD Tests
// ---------------------------------------------------------------------------

describe('calculateDpd', () => {
  const dueDate = new Date('2024-03-15');
  const currentDate = new Date('2024-04-30');

  it('Test 26: Paid exactly on due date = 0 DPD', () => {
    expect(calculateDpd(dueDate, new Date('2024-03-15'), currentDate)).toBe(0);
  });

  it('Test 27: Paid 15 days late = 15 DPD', () => {
    expect(calculateDpd(dueDate, new Date('2024-03-30'), currentDate)).toBe(15);
  });

  it('Test 28: Not paid, 45 days past due = 45 DPD', () => {
    const curr = new Date('2024-04-29');
    expect(calculateDpd(dueDate, null, curr)).toBe(45);
  });

  it('Test 29: Paid 5 days early = 0 DPD', () => {
    expect(calculateDpd(dueDate, new Date('2024-03-10'), currentDate)).toBe(0);
  });

  it('Test 30: Not yet due (current date before due date) = 0 DPD', () => {
    const futureDue = new Date('2024-06-15');
    expect(calculateDpd(futureDue, null, currentDate)).toBe(0);
  });

  it('Test 31: Paid on same day as current date which is before due = 0 DPD', () => {
    const earlyPay = new Date('2024-03-01');
    expect(calculateDpd(dueDate, earlyPay, currentDate)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NPA Classification Tests
// ---------------------------------------------------------------------------

describe('classifyNpa', () => {
  it('Test 32: DPD 0 = STANDARD', () => {
    expect(classifyNpa(0)).toBe(NpaClassification.STANDARD);
  });

  it('Test 33: DPD 1 = SPECIAL_MENTION_ACCOUNT (SMA-0)', () => {
    expect(classifyNpa(1)).toBe(NpaClassification.SMA_0);
  });

  it('Test 34: DPD 30 = SPECIAL_MENTION_ACCOUNT (SMA-0)', () => {
    expect(classifyNpa(30)).toBe(NpaClassification.SMA_0);
  });

  it('Test 35: DPD 31 = SMA_1', () => {
    expect(classifyNpa(31)).toBe(NpaClassification.SMA_1);
  });

  it('Test 36: DPD 60 = SMA_1', () => {
    expect(classifyNpa(60)).toBe(NpaClassification.SMA_1);
  });

  it('Test 37: DPD 61 = SMA_2', () => {
    expect(classifyNpa(61)).toBe(NpaClassification.SMA_2);
  });

  it('Test 38: DPD 89 = SMA_2', () => {
    expect(classifyNpa(89)).toBe(NpaClassification.SMA_2);
  });

  it('Test 39: DPD 90 = SMA_2', () => {
    expect(classifyNpa(90)).toBe(NpaClassification.SMA_2);
  });

  it('Test 40: DPD 91 = NPA_SUBSTANDARD', () => {
    expect(classifyNpa(91)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });

  it('Test 41: DPD 180 = NPA_SUBSTANDARD', () => {
    expect(classifyNpa(180)).toBe(NpaClassification.NPA_SUBSTANDARD);
  });
});

// ---------------------------------------------------------------------------
// Provision Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateProvision', () => {
  const outstanding = 100_000_000; // Rs 10L in paisa

  it('Test 42: STANDARD 0.40% of 100000000 = 400000 paisa', () => {
    expect(calculateProvision(NpaClassification.STANDARD, outstanding)).toBe(400_000);
  });

  it('Test 43: NPA_SUBSTANDARD 15% of 100000000 = 15000000 paisa', () => {
    expect(
      calculateProvision(NpaClassification.NPA_SUBSTANDARD, outstanding),
    ).toBe(15_000_000);
  });

  it('Test 44: NPA_DOUBTFUL_1 25% of 100000000 = 25000000 paisa', () => {
    expect(
      calculateProvision(NpaClassification.NPA_DOUBTFUL_1, outstanding),
    ).toBe(25_000_000);
  });

  it('Test 45: NPA_DOUBTFUL_2 40% of 100000000 = 40000000 paisa', () => {
    expect(
      calculateProvision(NpaClassification.NPA_DOUBTFUL_2, outstanding),
    ).toBe(40_000_000);
  });

  it('Test 46: NPA_DOUBTFUL_3 100% of 100000000 = 100000000 paisa', () => {
    expect(
      calculateProvision(NpaClassification.NPA_DOUBTFUL_3, outstanding),
    ).toBe(100_000_000);
  });

  it('Test 47: NPA_LOSS 100% of 100000000 = 100000000 paisa', () => {
    expect(calculateProvision(NpaClassification.NPA_LOSS, outstanding)).toBe(
      100_000_000,
    );
  });

  it('Test 48: SMA_0 provision = 0.40% (same as standard)', () => {
    expect(
      calculateProvision(NpaClassification.SMA_0, outstanding),
    ).toBe(400_000);
  });
});

// ---------------------------------------------------------------------------
// Validator Tests (imported from validators.ts)
// ---------------------------------------------------------------------------

describe('isValidPan', () => {
  it('Test 49: ABCDE1234F = valid PAN', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
  });

  it('Test 50: ABCDE123F = invalid PAN (only 3 digits)', () => {
    expect(isValidPan('ABCDE123F')).toBe(false);
  });

  it('Test 51: 12345ABCDE = invalid PAN (starts with digits)', () => {
    expect(isValidPan('12345ABCDE')).toBe(false);
  });

  it('Test 52: lowercase pan = invalid', () => {
    expect(isValidPan('abcde1234f')).toBe(false);
  });

  it('Test 53: ABCDE1234FF = invalid (too long)', () => {
    expect(isValidPan('ABCDE1234FF')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('Test 54: 9876543210 = valid phone', () => {
    expect(isValidPhone('9876543210')).toBe(true);
  });

  it('Test 55: 1234567890 = invalid (does not start with 6-9)', () => {
    expect(isValidPhone('1234567890')).toBe(false);
  });

  it('Test 56: 98765 = invalid (too short)', () => {
    expect(isValidPhone('98765')).toBe(false);
  });

  it('Test 57: 6123456789 = valid (starts with 6)', () => {
    expect(isValidPhone('6123456789')).toBe(true);
  });

  it('Test 58: 5987654321 = invalid (starts with 5)', () => {
    expect(isValidPhone('5987654321')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prepayment Tests
// ---------------------------------------------------------------------------

describe('calculatePrepaymentAmount', () => {
  it('Test 59: Prepayment calculation returns correct structure', () => {
    const result = calculatePrepaymentAmount(
      50_000_000, // Rs 5L outstanding
      1200,       // 12% annual
      new Date('2024-03-01'),
      new Date('2024-03-16'), // 15 days later
      2,          // 2% penalty
    );
    expect(result).toHaveProperty('outstandingPrincipal');
    expect(result).toHaveProperty('accruedInterest');
    expect(result).toHaveProperty('penalty');
    expect(result).toHaveProperty('totalPayable');
    expect(result.outstandingPrincipal).toBe(50_000_000);
  });

  it('Test 60: totalPayable = outstandingPrincipal + accruedInterest + penalty', () => {
    const result = calculatePrepaymentAmount(
      100_000_000,
      1400,
      new Date('2024-01-01'),
      new Date('2024-01-31'), // 30 days
      3,
    );
    expect(result.totalPayable).toBe(
      result.outstandingPrincipal + result.accruedInterest + result.penalty,
    );
  });

  it('Test 61: Accrued interest for 30 days at 12% ≈ principal * 0.12 * 30/365', () => {
    const principal = 100_000_000;
    const result = calculatePrepaymentAmount(
      principal,
      1200,
      new Date('2024-01-01'),
      new Date('2024-01-31'), // 30 days
      0,
    );
    // Expected: 100000000 * 0.12 * 30/365 ≈ 986301 paisa
    const expectedInterest = Math.round(
      (principal * 0.12 * 30) / 365,
    );
    expect(result.accruedInterest).toBeCloseTo(expectedInterest, -2);
  });

  it('Test 62: Zero penalty means penalty = 0', () => {
    const result = calculatePrepaymentAmount(
      50_000_000,
      1200,
      new Date('2024-01-01'),
      new Date('2024-01-15'),
      0,
    );
    expect(result.penalty).toBe(0);
  });
});
