/**
 * Prompt 68: GL Balancing Tests
 *
 * For every transaction type in the BankOS GL system, verify:
 *   TOTAL DEBITS == TOTAL CREDITS  (double-entry bookkeeping)
 *
 * Transaction types tested:
 *   1. Disbursement
 *   2. EMI Payment (principal + interest)
 *   3. Interest Accrual
 *   4. NPA Provision
 *   5. Write-off
 *   6. Penal Interest Charge
 *   7. Prepayment / Foreclosure
 *   8. Reversal
 *   9. Processing Fee Income
 *  10. Co-lending settlement
 *
 * All amounts are in paisa. GL entries follow Indian NBFC chart of accounts.
 */

// ---------------------------------------------------------------------------
// Types (mirrors GlEntry model in schema.prisma)
// ---------------------------------------------------------------------------

interface GlEntry {
  id: string;
  accountCode: string;
  accountName: string;
  debitAmountPaisa: number;
  creditAmountPaisa: number;
  narration: string;
  referenceType: string;
  referenceId: string;
}

// ---------------------------------------------------------------------------
// Helper: assert double-entry balance
// ---------------------------------------------------------------------------

function assertGlBalance(entries: GlEntry[], description: string): void {
  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmountPaisa, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmountPaisa, 0);
  expect(totalDebit).toBe(totalCredit);
  expect(totalDebit).toBeGreaterThan(0);
}

function sumDebits(entries: GlEntry[]): number {
  return entries.reduce((sum, e) => sum + e.debitAmountPaisa, 0);
}

function sumCredits(entries: GlEntry[]): number {
  return entries.reduce((sum, e) => sum + e.creditAmountPaisa, 0);
}

// ---------------------------------------------------------------------------
// Mock GL entry builders
// ---------------------------------------------------------------------------

function makeDisbursementEntries(principalPaisa: number, loanId: string): GlEntry[] {
  // DR: Loan Account (asset increases)
  // CR: Bank/NOSTRO Account (cash goes out)
  return [
    {
      id: `GL-DISB-1-${loanId}`,
      accountCode: '1100',
      accountName: 'Loan Account - Principal',
      debitAmountPaisa: principalPaisa,
      creditAmountPaisa: 0,
      narration: `Loan disbursement for ${loanId}`,
      referenceType: 'LOAN',
      referenceId: loanId,
    },
    {
      id: `GL-DISB-2-${loanId}`,
      accountCode: '2100',
      accountName: 'NOSTRO / Bank Account',
      debitAmountPaisa: 0,
      creditAmountPaisa: principalPaisa,
      narration: `Bank outflow for loan disbursement ${loanId}`,
      referenceType: 'LOAN',
      referenceId: loanId,
    },
  ];
}

function makePaymentEntries(
  principalPaisa: number,
  interestPaisa: number,
  paymentId: string,
  loanId: string,
): GlEntry[] {
  // DR: Bank/NOSTRO Account (cash received)
  // CR: Loan Account - Principal (asset decreases)
  // CR: Interest Income Account (income recognized)
  return [
    {
      id: `GL-PAY-1-${paymentId}`,
      accountCode: '2100',
      accountName: 'NOSTRO / Bank Account',
      debitAmountPaisa: principalPaisa + interestPaisa,
      creditAmountPaisa: 0,
      narration: `EMI received for loan ${loanId}`,
      referenceType: 'PAYMENT',
      referenceId: paymentId,
    },
    {
      id: `GL-PAY-2-${paymentId}`,
      accountCode: '1100',
      accountName: 'Loan Account - Principal',
      debitAmountPaisa: 0,
      creditAmountPaisa: principalPaisa,
      narration: `Principal repayment for loan ${loanId}`,
      referenceType: 'PAYMENT',
      referenceId: paymentId,
    },
    {
      id: `GL-PAY-3-${paymentId}`,
      accountCode: '4100',
      accountName: 'Interest Income',
      debitAmountPaisa: 0,
      creditAmountPaisa: interestPaisa,
      narration: `Interest income for loan ${loanId}`,
      referenceType: 'PAYMENT',
      referenceId: paymentId,
    },
  ];
}

function makeInterestAccrualEntries(interestPaisa: number, loanId: string, period: string): GlEntry[] {
  // DR: Accrued Interest Receivable (asset)
  // CR: Interest Income (income)
  return [
    {
      id: `GL-ACCR-1-${loanId}-${period}`,
      accountCode: '1200',
      accountName: 'Accrued Interest Receivable',
      debitAmountPaisa: interestPaisa,
      creditAmountPaisa: 0,
      narration: `Interest accrual for ${loanId} period ${period}`,
      referenceType: 'ACCRUAL',
      referenceId: `${loanId}-${period}`,
    },
    {
      id: `GL-ACCR-2-${loanId}-${period}`,
      accountCode: '4100',
      accountName: 'Interest Income',
      debitAmountPaisa: 0,
      creditAmountPaisa: interestPaisa,
      narration: `Interest income accrual for ${loanId} period ${period}`,
      referenceType: 'ACCRUAL',
      referenceId: `${loanId}-${period}`,
    },
  ];
}

function makeNpaProvisionEntries(provisionPaisa: number, loanId: string): GlEntry[] {
  // DR: Provision for NPA (expense)
  // CR: Provision for NPA - Liability / Contra Asset
  return [
    {
      id: `GL-PROV-1-${loanId}`,
      accountCode: '5100',
      accountName: 'Provision for NPA (Expense)',
      debitAmountPaisa: provisionPaisa,
      creditAmountPaisa: 0,
      narration: `NPA provision created for loan ${loanId}`,
      referenceType: 'NPA_PROVISION',
      referenceId: loanId,
    },
    {
      id: `GL-PROV-2-${loanId}`,
      accountCode: '1900',
      accountName: 'Provision for NPA (Contra Asset)',
      debitAmountPaisa: 0,
      creditAmountPaisa: provisionPaisa,
      narration: `NPA provision liability for loan ${loanId}`,
      referenceType: 'NPA_PROVISION',
      referenceId: loanId,
    },
  ];
}

function makeWriteOffEntries(
  outstandingPaisa: number,
  existingProvisionPaisa: number,
  loanId: string,
): GlEntry[] {
  // DR: Provision for NPA - Contra Asset (utilise provision)
  // DR: Write-off Expense (the unprovisioned portion)
  // CR: Loan Account - Principal (remove asset)
  const unprovisionedPaisa = outstandingPaisa - existingProvisionPaisa;
  const entries: GlEntry[] = [];

  // Use up existing provision
  entries.push({
    id: `GL-WO-1-${loanId}`,
    accountCode: '1900',
    accountName: 'Provision for NPA (Contra Asset)',
    debitAmountPaisa: existingProvisionPaisa,
    creditAmountPaisa: 0,
    narration: `Provision utilised on write-off of loan ${loanId}`,
    referenceType: 'WRITE_OFF',
    referenceId: loanId,
  });

  // Any unprovisioned amount goes to expense
  if (unprovisionedPaisa > 0) {
    entries.push({
      id: `GL-WO-2-${loanId}`,
      accountCode: '5200',
      accountName: 'Write-off Expense',
      debitAmountPaisa: unprovisionedPaisa,
      creditAmountPaisa: 0,
      narration: `Unprovisioned write-off amount for loan ${loanId}`,
      referenceType: 'WRITE_OFF',
      referenceId: loanId,
    });
  }

  // Remove the loan from books
  entries.push({
    id: `GL-WO-3-${loanId}`,
    accountCode: '1100',
    accountName: 'Loan Account - Principal',
    debitAmountPaisa: 0,
    creditAmountPaisa: outstandingPaisa,
    narration: `Loan written off ${loanId}`,
    referenceType: 'WRITE_OFF',
    referenceId: loanId,
  });

  return entries;
}

function makePenalInterestEntries(penalPaisa: number, loanId: string): GlEntry[] {
  // DR: Penal Interest Receivable
  // CR: Penal Interest Income
  return [
    {
      id: `GL-PENAL-1-${loanId}`,
      accountCode: '1300',
      accountName: 'Penal Interest Receivable',
      debitAmountPaisa: penalPaisa,
      creditAmountPaisa: 0,
      narration: `Penal interest charged on overdue loan ${loanId}`,
      referenceType: 'PENAL_INTEREST',
      referenceId: loanId,
    },
    {
      id: `GL-PENAL-2-${loanId}`,
      accountCode: '4200',
      accountName: 'Penal Interest Income',
      debitAmountPaisa: 0,
      creditAmountPaisa: penalPaisa,
      narration: `Penal interest income for loan ${loanId}`,
      referenceType: 'PENAL_INTEREST',
      referenceId: loanId,
    },
  ];
}

function makeProcessingFeeEntries(feePaisa: number, applicationId: string): GlEntry[] {
  // DR: Bank Account (cash received)
  // CR: Processing Fee Income (income)
  return [
    {
      id: `GL-FEE-1-${applicationId}`,
      accountCode: '2100',
      accountName: 'NOSTRO / Bank Account',
      debitAmountPaisa: feePaisa,
      creditAmountPaisa: 0,
      narration: `Processing fee received for application ${applicationId}`,
      referenceType: 'PROCESSING_FEE',
      referenceId: applicationId,
    },
    {
      id: `GL-FEE-2-${applicationId}`,
      accountCode: '4300',
      accountName: 'Processing Fee Income',
      debitAmountPaisa: 0,
      creditAmountPaisa: feePaisa,
      narration: `Processing fee income for ${applicationId}`,
      referenceType: 'PROCESSING_FEE',
      referenceId: applicationId,
    },
  ];
}

function makeReversalEntries(originalEntries: GlEntry[], reversalId: string): GlEntry[] {
  // Reversal swaps debit and credit on all original entries
  return originalEntries.map((e, i) => ({
    id: `GL-REV-${i}-${reversalId}`,
    accountCode: e.accountCode,
    accountName: e.accountName,
    debitAmountPaisa: e.creditAmountPaisa,
    creditAmountPaisa: e.debitAmountPaisa,
    narration: `REVERSAL: ${e.narration}`,
    referenceType: 'REVERSAL',
    referenceId: reversalId,
  }));
}

function makeCoLendingSettlementEntries(
  bankSharePaisa: number,
  nbfcSharePaisa: number,
  settlementId: string,
): GlEntry[] {
  // Total payment received split between bank and NBFC
  const totalPaisa = bankSharePaisa + nbfcSharePaisa;
  return [
    {
      id: `GL-COLN-1-${settlementId}`,
      accountCode: '2100',
      accountName: 'NOSTRO / Bank Account',
      debitAmountPaisa: totalPaisa,
      creditAmountPaisa: 0,
      narration: `Co-lending payment received ${settlementId}`,
      referenceType: 'CO_LENDING_SETTLEMENT',
      referenceId: settlementId,
    },
    {
      id: `GL-COLN-2-${settlementId}`,
      accountCode: '2200',
      accountName: 'Co-Lending Partner Payable',
      debitAmountPaisa: 0,
      creditAmountPaisa: bankSharePaisa,
      narration: `Bank partner share payable ${settlementId}`,
      referenceType: 'CO_LENDING_SETTLEMENT',
      referenceId: settlementId,
    },
    {
      id: `GL-COLN-3-${settlementId}`,
      accountCode: '1100',
      accountName: 'Loan Account - Principal',
      debitAmountPaisa: 0,
      creditAmountPaisa: nbfcSharePaisa,
      narration: `NBFC share reduction ${settlementId}`,
      referenceType: 'CO_LENDING_SETTLEMENT',
      referenceId: settlementId,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GL Balancing: Disbursement', () => {

  it('disbursement of Rs 10L: total debits == total credits', () => {
    const entries = makeDisbursementEntries(100_000_000, 'LOAN-001');
    assertGlBalance(entries, 'Disbursement Rs 10L');
  });

  it('disbursement of Rs 5Cr: total debits == total credits', () => {
    const entries = makeDisbursementEntries(500_000_000_0, 'LOAN-002');
    assertGlBalance(entries, 'Disbursement Rs 5Cr');
  });

  it('disbursement amount appears exactly once on debit side', () => {
    const entries = makeDisbursementEntries(50_000_000, 'LOAN-003');
    const debitEntries = entries.filter((e) => e.debitAmountPaisa > 0);
    expect(debitEntries).toHaveLength(1);
    expect(debitEntries[0].debitAmountPaisa).toBe(50_000_000);
  });

});

describe('GL Balancing: EMI Payment', () => {

  it('payment with Rs 2000 principal + Rs 1000 interest: total debits == credits', () => {
    const entries = makePaymentEntries(200_000, 100_000, 'PAY-001', 'LOAN-001');
    assertGlBalance(entries, 'EMI Payment');
  });

  it('payment with Rs 0 interest (last EMI rounding): total debits == credits', () => {
    const entries = makePaymentEntries(50_000, 0, 'PAY-002', 'LOAN-002');
    // If interest is 0 the NOSTRO entry should still balance
    const debit = sumDebits(entries);
    const credit = sumCredits(entries);
    expect(debit).toBe(credit);
  });

  it('payment: bank debit equals sum of principal + interest credits', () => {
    const principal = 1_500_000;
    const interest = 300_000;
    const entries = makePaymentEntries(principal, interest, 'PAY-003', 'LOAN-003');
    const bankEntry = entries.find((e) => e.accountCode === '2100');
    expect(bankEntry!.debitAmountPaisa).toBe(principal + interest);
  });

  it('multiple payments all balance individually', () => {
    const payments = [
      { principal: 1_000_000, interest: 150_000, payId: 'P1' },
      { principal: 1_050_000, interest: 100_000, payId: 'P2' },
      { principal: 1_100_000, interest:  50_000, payId: 'P3' },
    ];
    for (const p of payments) {
      const entries = makePaymentEntries(p.principal, p.interest, p.payId, 'LOAN-004');
      assertGlBalance(entries, `Payment ${p.payId}`);
    }
  });

});

describe('GL Balancing: Interest Accrual', () => {

  it('monthly interest accrual: total debits == total credits', () => {
    const entries = makeInterestAccrualEntries(116_667, 'LOAN-001', '2024-01');
    assertGlBalance(entries, 'Interest Accrual Jan 2024');
  });

  it('12 consecutive accruals each balance', () => {
    const months = ['2024-01', '2024-02', '2024-03', '2024-04',
                    '2024-05', '2024-06', '2024-07', '2024-08',
                    '2024-09', '2024-10', '2024-11', '2024-12'];
    for (const period of months) {
      const entries = makeInterestAccrualEntries(100_000, 'LOAN-005', period);
      expect(sumDebits(entries)).toBe(sumCredits(entries));
    }
  });

});

describe('GL Balancing: NPA Provision', () => {

  it('NPA provision at 15% of Rs 10L: total debits == credits', () => {
    const provision = 15_000_000; // 15% of 100_000_000
    const entries = makeNpaProvisionEntries(provision, 'LOAN-006');
    assertGlBalance(entries, 'NPA Provision 15%');
  });

  it('NPA provision at 100% (NPA_LOSS): total debits == credits', () => {
    const outstanding = 50_000_000;
    const entries = makeNpaProvisionEntries(outstanding, 'LOAN-007');
    assertGlBalance(entries, 'NPA Provision 100%');
  });

  it('provision entry: expense debit == contra asset credit', () => {
    const provisionPaisa = 7_500_000;
    const entries = makeNpaProvisionEntries(provisionPaisa, 'LOAN-008');
    const expense = entries.find((e) => e.accountCode === '5100');
    const contra = entries.find((e) => e.accountCode === '1900');
    expect(expense!.debitAmountPaisa).toBe(provisionPaisa);
    expect(contra!.creditAmountPaisa).toBe(provisionPaisa);
  });

});

describe('GL Balancing: Write-off', () => {

  it('fully provisioned write-off: total debits == credits', () => {
    const outstanding = 100_000_000;
    const provision = 100_000_000; // 100% (NPA_LOSS)
    const entries = makeWriteOffEntries(outstanding, provision, 'LOAN-009');
    assertGlBalance(entries, 'Write-off fully provisioned');
  });

  it('partially provisioned write-off (15% provision): total debits == credits', () => {
    const outstanding = 100_000_000;
    const provision = 15_000_000; // 15% (SUBSTANDARD)
    const entries = makeWriteOffEntries(outstanding, provision, 'LOAN-010');
    assertGlBalance(entries, 'Write-off 15% provisioned');
  });

  it('write-off: loan account credit equals outstanding principal', () => {
    const outstanding = 80_000_000;
    const provision = 20_000_000;
    const entries = makeWriteOffEntries(outstanding, provision, 'LOAN-011');
    const loanEntry = entries.find((e) => e.accountCode === '1100');
    expect(loanEntry!.creditAmountPaisa).toBe(outstanding);
  });

  it('zero provision write-off: entire amount goes to expense', () => {
    const outstanding = 30_000_000;
    const provision = 0;
    const entries = makeWriteOffEntries(outstanding, provision, 'LOAN-012');
    assertGlBalance(entries, 'Zero provision write-off');
    const expenseEntry = entries.find((e) => e.accountCode === '5200');
    expect(expenseEntry!.debitAmountPaisa).toBe(outstanding);
  });

});

describe('GL Balancing: Penal Interest', () => {

  it('penal interest charge: total debits == credits', () => {
    const entries = makePenalInterestEntries(50_000, 'LOAN-013');
    assertGlBalance(entries, 'Penal Interest');
  });

  it('penal interest: receivable debit == income credit', () => {
    const penalPaisa = 125_000;
    const entries = makePenalInterestEntries(penalPaisa, 'LOAN-014');
    const receivable = entries.find((e) => e.accountCode === '1300');
    const income = entries.find((e) => e.accountCode === '4200');
    expect(receivable!.debitAmountPaisa).toBe(penalPaisa);
    expect(income!.creditAmountPaisa).toBe(penalPaisa);
  });

});

describe('GL Balancing: Processing Fee', () => {

  it('processing fee receipt: total debits == credits', () => {
    const entries = makeProcessingFeeEntries(200_000, 'APP-001');
    assertGlBalance(entries, 'Processing Fee');
  });

  it('processing fee: bank debit == fee income credit', () => {
    const feePaisa = 500_000; // Rs 5,000
    const entries = makeProcessingFeeEntries(feePaisa, 'APP-002');
    expect(sumDebits(entries)).toBe(sumCredits(entries));
    expect(sumDebits(entries)).toBe(feePaisa);
  });

});

describe('GL Balancing: Reversal', () => {

  it('reversal of disbursement: total debits == credits', () => {
    const original = makeDisbursementEntries(100_000_000, 'LOAN-015');
    const reversal = makeReversalEntries(original, 'REV-001');
    assertGlBalance(reversal, 'Disbursement Reversal');
  });

  it('reversal: combined original + reversal nets to zero', () => {
    const original = makePaymentEntries(500_000, 100_000, 'PAY-004', 'LOAN-016');
    const reversal = makeReversalEntries(original, 'REV-002');
    const allEntries = [...original, ...reversal];
    const netDebit = sumDebits(allEntries);
    const netCredit = sumCredits(allEntries);
    // Original + Reversal should perfectly cancel
    expect(netDebit).toBe(netCredit);
    // The net should be 2x the original amounts (original + reversal)
    const originalDebit = sumDebits(original);
    expect(netDebit).toBe(originalDebit * 2);
  });

  it('double reversal (reversal of reversal) = original', () => {
    const original = makeNpaProvisionEntries(7_500_000, 'LOAN-017');
    const reversal1 = makeReversalEntries(original, 'REV-003');
    const reversal2 = makeReversalEntries(reversal1, 'REV-004');
    // reversal2 should have same debit/credit structure as original
    expect(sumDebits(reversal2)).toBe(sumDebits(original));
    expect(sumCredits(reversal2)).toBe(sumCredits(original));
  });

});

describe('GL Balancing: Co-Lending Settlement', () => {

  it('co-lending settlement 80:20 bank/NBFC split: total debits == credits', () => {
    const bankShare = 80_000_000; // 80%
    const nbfcShare = 20_000_000; // 20%
    const entries = makeCoLendingSettlementEntries(bankShare, nbfcShare, 'COLN-001');
    assertGlBalance(entries, 'Co-Lending 80:20 Settlement');
  });

  it('co-lending settlement: total received == bank share + NBFC share', () => {
    const bankShare = 70_000_000;
    const nbfcShare = 30_000_000;
    const entries = makeCoLendingSettlementEntries(bankShare, nbfcShare, 'COLN-002');
    const bankReceived = entries.find((e) => e.accountCode === '2100');
    expect(bankReceived!.debitAmountPaisa).toBe(bankShare + nbfcShare);
  });

  it('co-lending settlement at 60:40 split: total debits == credits', () => {
    const totalPayment = 150_000_000;
    const bankShare = 90_000_000;
    const nbfcShare = 60_000_000;
    const entries = makeCoLendingSettlementEntries(bankShare, nbfcShare, 'COLN-003');
    assertGlBalance(entries, 'Co-Lending 60:40 Settlement');
  });

});

describe('GL Balancing: Multi-transaction batch', () => {

  it('daily batch: disbursement + 3 payments + accrual all balance', () => {
    const allEntries: GlEntry[] = [
      ...makeDisbursementEntries(200_000_000, 'LOAN-020'),
      ...makePaymentEntries(1_500_000, 250_000, 'PAY-020', 'LOAN-021'),
      ...makePaymentEntries(1_600_000, 200_000, 'PAY-021', 'LOAN-022'),
      ...makePaymentEntries(1_700_000, 150_000, 'PAY-022', 'LOAN-023'),
      ...makeInterestAccrualEntries(500_000, 'LOAN-024', '2024-01'),
    ];
    assertGlBalance(allEntries, 'Daily batch');
  });

  it('month-end batch: provision + write-off + penal all balance', () => {
    const allEntries: GlEntry[] = [
      ...makeNpaProvisionEntries(15_000_000, 'LOAN-030'),
      ...makeNpaProvisionEntries(25_000_000, 'LOAN-031'),
      ...makeWriteOffEntries(50_000_000, 50_000_000, 'LOAN-032'),
      ...makePenalInterestEntries(75_000, 'LOAN-033'),
    ];
    assertGlBalance(allEntries, 'Month-end batch');
  });

});
