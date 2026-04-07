/**
 * Gap Modules Test Suite
 * Covers: Gold Loan, Vehicle Finance, Property LTV, MSME, Treasury,
 *         Insurance, Balance Transfer, APR, Reconciliation, TDS, GST,
 *         Complaints, MFI, Write-off Recovery
 */

// ── Helpers / inline implementations ─────────────────────────────────────────

// Gold Loan LTV
function goldLoanLTV(marketValuePaisa: number, purityPercent: number): number {
  const fsv = marketValuePaisa * (purityPercent / 100);
  return Math.floor(fsv * 0.75);
}

// Vehicle Finance LTV
function vehicleLTV(valuationPaisa: number, isNew: boolean): number {
  return Math.floor(valuationPaisa * (isNew ? 0.9 : 0.8));
}

// Property LTV (FSV-based)
function propertyLTV(
  fairMarketValuePaisa: number,
  type: 'residential' | 'commercial',
): number {
  const fsv = fairMarketValuePaisa * 0.9; // FSV = 90% of market value
  const ltv = type === 'residential' ? 0.75 : 0.65;
  return Math.floor(fsv * ltv);
}

// MSME Drawing Power
function msmeDrawingPower(
  stockPaisa: number,
  debtorsPaisa: number,
  creditorsPaisa: number,
): number {
  return Math.floor(stockPaisa * 0.75 + debtorsPaisa * 0.75 - creditorsPaisa);
}

// Treasury WACOF
function wacof(funds: Array<{ amountPaisa: number; costBps: number }>): number {
  const totalAmount = funds.reduce((s, f) => s + f.amountPaisa, 0);
  if (totalAmount === 0) return 0;
  const weightedSum = funds.reduce((s, f) => s + f.amountPaisa * f.costBps, 0);
  return weightedSum / totalAmount;
}

// Insurance premium tracking
interface InsurancePolicy {
  policyNumber: string;
  premiumPaisa: number;
  nextDueDate: Date;
  status: 'ACTIVE' | 'LAPSED' | 'RENEWED';
}

function isInsuranceDue(policy: InsurancePolicy, asOfDate: Date): boolean {
  return policy.status === 'ACTIVE' && policy.nextDueDate <= asOfDate;
}

// Balance transfer savings
function balanceTransferSavings(
  outstandingPaisa: number,
  existingRateBps: number,
  newRateBps: number,
  remainingMonths: number,
): number {
  const existingMonthlyRate = existingRateBps / 10000 / 12;
  const newMonthlyRate = newRateBps / 10000 / 12;
  const existingInterest =
    outstandingPaisa * existingMonthlyRate * remainingMonths;
  const newInterest = outstandingPaisa * newMonthlyRate * remainingMonths;
  return Math.floor(existingInterest - newInterest);
}

// APR calculation (flat-rate to APR approximation)
function calculateAPR(
  principalPaisa: number,
  totalInterestPaisa: number,
  tenureMonths: number,
  feesPaisa: number,
): number {
  const totalCost = totalInterestPaisa + feesPaisa;
  const monthlyRate = totalCost / principalPaisa / tenureMonths;
  return Math.round(monthlyRate * 12 * 10000) / 100; // in percent
}

// Bank reconciliation UTR matching
interface Transaction {
  utr: string;
  amountPaisa: number;
  date: string;
}

function matchUTR(
  bankEntries: Transaction[],
  systemEntries: Transaction[],
): { matched: Transaction[]; unmatched: Transaction[] } {
  const matched: Transaction[] = [];
  const unmatched: Transaction[] = [];
  for (const entry of bankEntries) {
    const found = systemEntries.find(
      (s) => s.utr === entry.utr && s.amountPaisa === entry.amountPaisa,
    );
    if (found) matched.push(entry);
    else unmatched.push(entry);
  }
  return { matched, unmatched };
}

// TDS calculation (10% on interest above threshold)
const TDS_THRESHOLD_PAISA = 4000 * 100; // Rs 4000 in paisa
function calculateTDS(interestIncomePaisa: number): number {
  if (interestIncomePaisa <= TDS_THRESHOLD_PAISA) return 0;
  return Math.floor(interestIncomePaisa * 0.1);
}

// GST calculation (18% on fees)
function calculateGST(feeAmountPaisa: number): number {
  return Math.floor(feeAmountPaisa * 0.18);
}

// Complaint SLA
type ComplaintPriority = 'CRITICAL' | 'MEDIUM' | 'LOW';

function getSLAHours(priority: ComplaintPriority): number {
  if (priority === 'CRITICAL') return 48;
  if (priority === 'MEDIUM') return 120;
  return 240;
}

function isComplaintBreached(
  raisedAt: Date,
  priority: ComplaintPriority,
  asOfDate: Date,
): boolean {
  const slaMs = getSLAHours(priority) * 60 * 60 * 1000;
  return asOfDate.getTime() - raisedAt.getTime() > slaMs;
}

// MFI group validation (no cross-membership)
interface MFIGroup {
  groupId: string;
  memberIds: string[];
}

function validateNoXMembership(groups: MFIGroup[]): string[] {
  const memberGroupCount = new Map<string, number>();
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      memberGroupCount.set(memberId, (memberGroupCount.get(memberId) ?? 0) + 1);
    }
  }
  return Array.from(memberGroupCount.entries())
    .filter(([, count]) => count > 1)
    .map(([memberId]) => memberId);
}

// Write-off recovery tracking
interface WriteOffAccount {
  accountId: string;
  writtenOffAmountPaisa: number;
  recoveredPaisa: number;
}

function recoveryRate(account: WriteOffAccount): number {
  if (account.writtenOffAmountPaisa === 0) return 0;
  return (account.recoveredPaisa / account.writtenOffAmountPaisa) * 100;
}

function remainingWriteOff(account: WriteOffAccount): number {
  return Math.max(0, account.writtenOffAmountPaisa - account.recoveredPaisa);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Gold Loan LTV', () => {
  it('should apply 75% LTV on purity-adjusted value', () => {
    // 100g @ Rs 6000/g = Rs 6,00,000; purity 91.6%; FSV = 5,49,600; LTV = 4,12,200
    const market = 600000 * 100; // in paisa
    const ltv = goldLoanLTV(market, 91.6);
    expect(ltv).toBeLessThanOrEqual(market * 0.75);
    expect(ltv).toBe(Math.floor(market * 0.916 * 0.75));
  });

  it('should return 0 for 0% purity', () => {
    expect(goldLoanLTV(100000 * 100, 0)).toBe(0);
  });

  it('should cap at 75% even for 100% purity', () => {
    const market = 100000 * 100;
    const ltv = goldLoanLTV(market, 100);
    expect(ltv).toBe(Math.floor(market * 0.75));
  });

  it('should handle 22-karat gold (91.67% purity)', () => {
    const market = 500000 * 100;
    const ltv = goldLoanLTV(market, 91.67);
    expect(ltv).toBeGreaterThan(0);
    expect(ltv).toBeLessThan(market * 0.75);
  });
});

describe('Vehicle Finance LTV', () => {
  it('should allow 90% LTV for new vehicles', () => {
    const valuation = 1000000 * 100;
    expect(vehicleLTV(valuation, true)).toBe(Math.floor(valuation * 0.9));
  });

  it('should allow 80% LTV for used vehicles', () => {
    const valuation = 500000 * 100;
    expect(vehicleLTV(valuation, false)).toBe(Math.floor(valuation * 0.8));
  });

  it('new vehicle LTV should always exceed used vehicle LTV for same value', () => {
    const val = 800000 * 100;
    expect(vehicleLTV(val, true)).toBeGreaterThan(vehicleLTV(val, false));
  });
});

describe('Property LTV', () => {
  it('should apply 75% LTV on FSV for residential', () => {
    const fmv = 5000000 * 100;
    const fsv = fmv * 0.9;
    expect(propertyLTV(fmv, 'residential')).toBe(Math.floor(fsv * 0.75));
  });

  it('should apply 65% LTV on FSV for commercial', () => {
    const fmv = 10000000 * 100;
    const fsv = fmv * 0.9;
    expect(propertyLTV(fmv, 'commercial')).toBe(Math.floor(fsv * 0.65));
  });

  it('commercial LTV should be lower than residential for same property', () => {
    const fmv = 8000000 * 100;
    expect(propertyLTV(fmv, 'commercial')).toBeLessThan(
      propertyLTV(fmv, 'residential'),
    );
  });
});

describe('MSME Drawing Power', () => {
  it('should compute drawing power as 75% stock + 75% debtors - creditors', () => {
    const stock = 1000000 * 100;
    const debtors = 500000 * 100;
    const creditors = 200000 * 100;
    const dp = msmeDrawingPower(stock, debtors, creditors);
    expect(dp).toBe(
      Math.floor(stock * 0.75 + debtors * 0.75 - creditors),
    );
  });

  it('should return lower drawing power when creditors are high', () => {
    const base = msmeDrawingPower(1000000 * 100, 500000 * 100, 100000 * 100);
    const highCred = msmeDrawingPower(1000000 * 100, 500000 * 100, 500000 * 100);
    expect(base).toBeGreaterThan(highCred);
  });

  it('should handle zero creditors', () => {
    const dp = msmeDrawingPower(1000000 * 100, 0, 0);
    expect(dp).toBe(Math.floor(1000000 * 100 * 0.75));
  });
});

describe('Treasury WACOF', () => {
  it('should calculate weighted average cost of funds', () => {
    const funds = [
      { amountPaisa: 10000000 * 100, costBps: 700 },
      { amountPaisa: 5000000 * 100, costBps: 900 },
    ];
    const result = wacof(funds);
    // Weighted: (10M*700 + 5M*900) / 15M = (7000M + 4500M) / 15M = 766.67
    expect(result).toBeCloseTo(766.67, 0);
  });

  it('should return 0 for empty fund list', () => {
    expect(wacof([])).toBe(0);
  });

  it('single source WACOF equals its own rate', () => {
    const funds = [{ amountPaisa: 5000000 * 100, costBps: 850 }];
    expect(wacof(funds)).toBe(850);
  });
});

describe('Insurance Premium Tracking', () => {
  const basePolicy: InsurancePolicy = {
    policyNumber: 'POL-001',
    premiumPaisa: 5000 * 100,
    nextDueDate: new Date('2026-04-10'),
    status: 'ACTIVE',
  };

  it('should flag active policy with past due date as due', () => {
    expect(isInsuranceDue(basePolicy, new Date('2026-04-11'))).toBe(true);
  });

  it('should not flag active policy with future due date', () => {
    expect(isInsuranceDue(basePolicy, new Date('2026-04-09'))).toBe(false);
  });

  it('should not flag lapsed policy even if overdue', () => {
    expect(
      isInsuranceDue({ ...basePolicy, status: 'LAPSED' }, new Date('2026-05-01')),
    ).toBe(false);
  });
});

describe('Balance Transfer Savings', () => {
  it('should return positive savings when new rate is lower', () => {
    const savings = balanceTransferSavings(
      500000 * 100,
      1800, // 18% existing
      1400, // 14% new
      24,
    );
    expect(savings).toBeGreaterThan(0);
  });

  it('should return negative savings when new rate is higher', () => {
    const savings = balanceTransferSavings(
      500000 * 100,
      1200,
      1800,
      24,
    );
    expect(savings).toBeLessThan(0);
  });

  it('should return 0 for equal rates', () => {
    const savings = balanceTransferSavings(500000 * 100, 1500, 1500, 24);
    expect(savings).toBe(0);
  });
});

describe('APR Calculation', () => {
  it('should calculate APR as annualised total cost / principal', () => {
    const apr = calculateAPR(
      100000 * 100, // 1L principal
      18000 * 100,  // 18k interest
      12,           // 12 months
      1000 * 100,   // 1k fees
    );
    expect(apr).toBeGreaterThan(18); // APR > flat rate
    expect(typeof apr).toBe('number');
  });

  it('zero fees APR should be lower than APR with fees', () => {
    const aprNoFees = calculateAPR(100000 * 100, 18000 * 100, 12, 0);
    const aprWithFees = calculateAPR(100000 * 100, 18000 * 100, 12, 2000 * 100);
    expect(aprWithFees).toBeGreaterThan(aprNoFees);
  });
});

describe('Bank Reconciliation UTR Matching', () => {
  const bankEntries: Transaction[] = [
    { utr: 'UTR001', amountPaisa: 50000 * 100, date: '2026-04-01' },
    { utr: 'UTR002', amountPaisa: 30000 * 100, date: '2026-04-01' },
    { utr: 'UTR003', amountPaisa: 20000 * 100, date: '2026-04-01' },
  ];

  const systemEntries: Transaction[] = [
    { utr: 'UTR001', amountPaisa: 50000 * 100, date: '2026-04-01' },
    { utr: 'UTR002', amountPaisa: 30000 * 100, date: '2026-04-01' },
  ];

  it('should match entries with same UTR and amount', () => {
    const { matched } = matchUTR(bankEntries, systemEntries);
    expect(matched).toHaveLength(2);
    expect(matched.map((m) => m.utr)).toContain('UTR001');
    expect(matched.map((m) => m.utr)).toContain('UTR002');
  });

  it('should return unmatched entries that exist only in bank statement', () => {
    const { unmatched } = matchUTR(bankEntries, systemEntries);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].utr).toBe('UTR003');
  });

  it('should not match if amount differs even with same UTR', () => {
    const bank = [{ utr: 'UTR999', amountPaisa: 10000 * 100, date: '2026-04-01' }];
    const sys = [{ utr: 'UTR999', amountPaisa: 9999 * 100, date: '2026-04-01' }];
    const { unmatched } = matchUTR(bank, sys);
    expect(unmatched).toHaveLength(1);
  });
});

describe('TDS Calculation', () => {
  it('should deduct 10% TDS on interest above Rs 4000 threshold', () => {
    const interest = 10000 * 100; // Rs 10000
    expect(calculateTDS(interest)).toBe(Math.floor(interest * 0.1));
  });

  it('should not deduct TDS below threshold', () => {
    expect(calculateTDS(3000 * 100)).toBe(0);
  });

  it('should not deduct TDS exactly at threshold', () => {
    expect(calculateTDS(4000 * 100)).toBe(0);
  });

  it('should deduct TDS just above threshold', () => {
    expect(calculateTDS(4001 * 100)).toBeGreaterThan(0);
  });
});

describe('GST Calculation', () => {
  it('should calculate 18% GST on processing fee', () => {
    const fee = 5000 * 100;
    expect(calculateGST(fee)).toBe(Math.floor(fee * 0.18));
  });

  it('should return 0 for zero fee', () => {
    expect(calculateGST(0)).toBe(0);
  });

  it('GST on 1000 rupees fee should be 180 rupees', () => {
    expect(calculateGST(1000 * 100)).toBe(180 * 100);
  });
});

describe('Complaint SLA', () => {
  it('critical complaints should have 48-hour SLA', () => {
    expect(getSLAHours('CRITICAL')).toBe(48);
  });

  it('medium complaints should have 120-hour SLA', () => {
    expect(getSLAHours('MEDIUM')).toBe(120);
  });

  it('should flag critical complaint breached after 49 hours', () => {
    const raised = new Date('2026-04-01T10:00:00Z');
    const checked = new Date('2026-04-03T11:00:00Z'); // 49h later
    expect(isComplaintBreached(raised, 'CRITICAL', checked)).toBe(true);
  });

  it('should not flag critical complaint at 47 hours', () => {
    const raised = new Date('2026-04-01T10:00:00Z');
    const checked = new Date('2026-04-03T09:00:00Z'); // 47h later
    expect(isComplaintBreached(raised, 'CRITICAL', checked)).toBe(false);
  });

  it('should flag medium complaint breached after 121 hours', () => {
    const raised = new Date('2026-04-01T00:00:00Z');
    const checked = new Date('2026-04-06T01:00:00Z'); // 121h later
    expect(isComplaintBreached(raised, 'MEDIUM', checked)).toBe(true);
  });
});

describe('MFI Group Validation', () => {
  it('should detect cross-membership', () => {
    const groups: MFIGroup[] = [
      { groupId: 'G1', memberIds: ['M1', 'M2', 'M3'] },
      { groupId: 'G2', memberIds: ['M3', 'M4', 'M5'] }, // M3 is in both
    ];
    const violations = validateNoXMembership(groups);
    expect(violations).toContain('M3');
  });

  it('should return empty array when no cross-membership', () => {
    const groups: MFIGroup[] = [
      { groupId: 'G1', memberIds: ['M1', 'M2'] },
      { groupId: 'G2', memberIds: ['M3', 'M4'] },
    ];
    expect(validateNoXMembership(groups)).toHaveLength(0);
  });

  it('should detect multiple violators', () => {
    const groups: MFIGroup[] = [
      { groupId: 'G1', memberIds: ['M1', 'M2', 'M3'] },
      { groupId: 'G2', memberIds: ['M1', 'M3', 'M4'] },
    ];
    const violations = validateNoXMembership(groups);
    expect(violations).toContain('M1');
    expect(violations).toContain('M3');
  });
});

describe('Write-off Recovery Tracking', () => {
  it('should calculate recovery rate correctly', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-001',
      writtenOffAmountPaisa: 100000 * 100,
      recoveredPaisa: 30000 * 100,
    };
    expect(recoveryRate(account)).toBe(30);
  });

  it('should return 0 recovery rate for no recoveries', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-002',
      writtenOffAmountPaisa: 50000 * 100,
      recoveredPaisa: 0,
    };
    expect(recoveryRate(account)).toBe(0);
  });

  it('should return 100% rate when fully recovered', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-003',
      writtenOffAmountPaisa: 50000 * 100,
      recoveredPaisa: 50000 * 100,
    };
    expect(recoveryRate(account)).toBe(100);
  });

  it('should compute remaining balance after recovery', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-004',
      writtenOffAmountPaisa: 100000 * 100,
      recoveredPaisa: 40000 * 100,
    };
    expect(remainingWriteOff(account)).toBe(60000 * 100);
  });

  it('remaining balance should be 0 when over-recovered', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-005',
      writtenOffAmountPaisa: 10000 * 100,
      recoveredPaisa: 15000 * 100,
    };
    expect(remainingWriteOff(account)).toBe(0);
  });

  it('should handle zero write-off amount', () => {
    const account: WriteOffAccount = {
      accountId: 'ACC-006',
      writtenOffAmountPaisa: 0,
      recoveredPaisa: 0,
    };
    expect(recoveryRate(account)).toBe(0);
    expect(remainingWriteOff(account)).toBe(0);
  });
});
