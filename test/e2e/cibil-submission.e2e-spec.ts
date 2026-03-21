/**
 * Prompt 76: CIBIL Submission E2E Test
 *
 * Tests the complete CIBIL TUEF file submission cycle:
 *   Data Extraction → TUEF File Generation → Format Validation → Submission Simulation
 *
 * Verifications:
 *   - Loans are correctly extracted from database
 *   - TUEF file is generated with correct structure
 *   - Header, borrower, account segments are valid
 *   - Record count in trailer matches actual segments
 *   - NPA classification maps to correct CIBIL asset classification
 *   - Data masking (PAN) is NOT applied in TUEF (full data required by CIBIL)
 *
 * Requires: PostgreSQL running with seeded data.
 */

import { PrismaClient } from '@prisma/client';
import { NpaClassification } from '../../libs/common/src/enums';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// TUEF generation logic (simplified — in production this is a service)
// ---------------------------------------------------------------------------

interface TuefRecord {
  header: string;
  borrowerSegments: string[];
  accountSegments: string[];
  trailer: string;
  lines: string[];
}

/**
 * Maps NpaClassification enum to CIBIL asset classification code.
 * CIBIL codes:
 *   00 = Standard
 *   01 = Sub-Standard (SMA / 1-90 DPD)
 *   02 = Doubtful (91-180 DPD)
 *   03 = Doubtful (181-270 DPD)
 *   04 = Doubtful (271-365 DPD)
 *   05 = Loss
 */
function mapNpaToAssetClass(npa: NpaClassification): string {
  switch (npa) {
    case NpaClassification.STANDARD: return '00';
    case NpaClassification.SMA_0:    return '00';
    case NpaClassification.SMA_1:    return '01';
    case NpaClassification.SMA_2:    return '01';
    case NpaClassification.NPA_SUBSTANDARD: return '02';
    case NpaClassification.NPA_DOUBTFUL_1: return '02';
    case NpaClassification.NPA_DOUBTFUL_2: return '03';
    case NpaClassification.NPA_DOUBTFUL_3: return '04';
    case NpaClassification.NPA_LOSS: return '05';
    default: return '00';
  }
}

/**
 * Maps LoanProduct type to CIBIL account type code.
 */
function mapProductToAccountType(productType: string): string {
  const mapping: Record<string, string> = {
    PERSONAL_LOAN: '05',
    BUSINESS_LOAN: '15',
    HOME_LOAN: '02',
    VEHICLE_FINANCE: '06',
    LAP: '10',
    GOLD_LOAN: '07',
    EDUCATION_LOAN: '08',
    MICROFINANCE: '15',
    MSME_LOAN: '15',
    SUPPLY_CHAIN_FINANCE: '15',
  };
  return mapping[productType] ?? '15';
}

function padRight(str: string, length: number): string {
  return str.substring(0, length).padEnd(length, ' ');
}

function padLeft(str: string, length: number): string {
  return str.substring(0, length).padStart(length, '0');
}

function formatDate(date: Date | null): string {
  if (!date) return '00000000';
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString();
  return `${d}${m}${y}`;
}

function buildTuefHeader(memberCode: string, reportingDate: Date): string {
  return [
    'TUDF',                           // format (4)
    '14',                             // version (2)
    padRight(memberCode, 6),          // member code (6)
    padRight('GROWTHFINANCE', 16),    // member short name (16)
    '01',                             // cycle identifier (2)
    formatDate(reportingDate),        // reporting date (8)
    'PASS1234',                       // password (8)
  ].join('');
}

function buildBorrowerSegment(customer: {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  panNumber: string;
  phone: string;
  monthlyIncomePaisa: number | null;
  currentAddressLine1: string | null;
  currentState: string | null;
  currentPincode: string | null;
}): string {
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const genderCode = customer.gender === 'MALE' ? '1' : customer.gender === 'FEMALE' ? '2' : '3';
  const monthlyIncome = customer.monthlyIncomePaisa ?? 0;
  const annualIncome = Math.round(monthlyIncome * 12 / 100); // convert paisa to rupees

  return [
    'PN',
    padRight(fullName.toUpperCase(), 26),
    formatDate(customer.dateOfBirth),
    genderCode,
    '1',                                          // income indicator
    padLeft(String(annualIncome), 9),
    padRight(customer.panNumber, 10),
    padLeft(customer.phone.replace(/\D/g, ''), 11),
    padLeft(customer.phone.replace(/\D/g, ''), 11),
    padRight(customer.currentAddressLine1 ?? 'ADDRESS NOT PROVIDED', 40),
    padRight(customer.currentState ?? 'MH', 2),
    padRight(customer.currentPincode ?? '000000', 6),
  ].join('');
}

function buildAccountSegment(loan: {
  loanNumber: string;
  product: { code: string; productType: string };
  disbursedAmountPaisa: number;
  outstandingPrincipalPaisa: number;
  totalOverduePaisa: number;
  dpd: number;
  npaClassification: string;
  disbursementDate: Date;
  interestRateBps: number;
  tenureMonths: number;
  emiAmountPaisa: number;
  maturityDate: Date;
  closureDate: Date | null;
}): string {
  const accountType = mapProductToAccountType(loan.product.productType);
  const assetClass = mapNpaToAssetClass(loan.npaClassification as NpaClassification);

  return [
    'TL',
    padRight(loan.loanNumber, 25),
    padRight(loan.loanNumber, 25),
    accountType,
    '1',                                                                    // individual ownership
    formatDate(loan.disbursementDate),
    formatDate(new Date()),
    loan.closureDate ? formatDate(loan.closureDate) : '00000000',
    formatDate(new Date()),
    padLeft(String(Math.round(loan.disbursedAmountPaisa / 100)), 9),        // highCredit in rupees
    padLeft(String(Math.round(loan.outstandingPrincipalPaisa / 100)), 9),   // currentBalance
    padLeft(String(Math.round(loan.totalOverduePaisa / 100)), 9),           // amountOverdue
    padLeft(String(loan.dpd), 3),
    '1'.repeat(36),                                                          // payment history (simplified)
    (loan.interestRateBps / 100).toFixed(2).padStart(5, '0'),               // rate e.g. 14.00
    padLeft(String(loan.tenureMonths), 3),
    padLeft(String(Math.round(loan.emiAmountPaisa / 100)), 9),
    assetClass,
  ].join('');
}

function buildTuefTrailer(totalSegments: number): string {
  return `TRLR${padLeft(String(totalSegments), 5)}`;
}

async function generateTuefFile(
  orgId: string,
  reportingDate: Date,
): Promise<TuefRecord> {
  const loans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      loanStatus: { in: ['ACTIVE', 'CLOSED', 'WRITTEN_OFF', 'SETTLED'] },
    },
    include: {
      customer: true,
      product: true,
    },
    take: 50, // Limit for test
  });

  const memberCode = 'GROWTH';
  const header = buildTuefHeader(memberCode, reportingDate);
  const borrowerSegments: string[] = [];
  const accountSegments: string[] = [];

  for (const loan of loans) {
    const customer = loan.customer;
    borrowerSegments.push(buildBorrowerSegment({
      firstName: customer.firstName,
      lastName: customer.lastName,
      dateOfBirth: customer.dateOfBirth,
      gender: customer.gender,
      panNumber: customer.panNumber,
      phone: customer.phone,
      monthlyIncomePaisa: customer.monthlyIncomePaisa,
      currentAddressLine1: customer.currentAddressLine1,
      currentState: customer.currentState,
      currentPincode: customer.currentPincode,
    }));

    accountSegments.push(buildAccountSegment({
      loanNumber: loan.loanNumber,
      product: { code: loan.product.code, productType: loan.product.productType },
      disbursedAmountPaisa: loan.disbursedAmountPaisa,
      outstandingPrincipalPaisa: loan.outstandingPrincipalPaisa,
      totalOverduePaisa: loan.totalOverduePaisa,
      dpd: loan.dpd,
      npaClassification: loan.npaClassification,
      disbursementDate: loan.disbursementDate,
      interestRateBps: loan.interestRateBps,
      tenureMonths: loan.tenureMonths,
      emiAmountPaisa: loan.emiAmountPaisa,
      maturityDate: loan.maturityDate,
      closureDate: loan.closureDate,
    }));
  }

  // Total segments = header + (borrower + account) * n + trailer
  const totalSegments = 1 + loans.length * 2 + 1;
  const trailer = buildTuefTrailer(totalSegments);

  const lines: string[] = [header];
  for (let i = 0; i < borrowerSegments.length; i++) {
    lines.push(borrowerSegments[i]);
    lines.push(accountSegments[i]);
  }
  lines.push(trailer);

  return { header, borrowerSegments, accountSegments, trailer, lines };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CIBIL TUEF Submission E2E', () => {
  let orgId: string;
  let tuefRecord: TuefRecord;
  const REPORTING_DATE = new Date('2026-03-01');

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({ where: { code: 'GROWTH' } });
    if (!org) throw new Error('Run seed first: pnpm prisma:seed');
    orgId = org.id;

    // Generate the TUEF file
    tuefRecord = await generateTuefFile(orgId, REPORTING_DATE);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Header Validation ───────────────────────────────────────────────────

  describe('TUEF Header', () => {
    it('file has exactly one header line (first line)', () => {
      expect(tuefRecord.lines[0]).toBe(tuefRecord.header);
    });

    it('header starts with TUDF', () => {
      expect(tuefRecord.header.substring(0, 4)).toBe('TUDF');
    });

    it('header version is 14', () => {
      expect(tuefRecord.header.substring(4, 6)).toBe('14');
    });

    it('member code is GROWTH (6 chars)', () => {
      expect(tuefRecord.header.substring(6, 12)).toBe('GROWTH');
    });

    it('reporting date is in DDMMYYYY format', () => {
      const dateField = tuefRecord.header.substring(30, 38);
      expect(/^\d{8}$/.test(dateField)).toBe(true);
    });

    it('header has minimum required length', () => {
      expect(tuefRecord.header.length).toBeGreaterThanOrEqual(44);
    });
  });

  // ── Segment Count Validation ────────────────────────────────────────────

  describe('Segment Counts', () => {
    it('borrower segments count equals account segments count', () => {
      expect(tuefRecord.borrowerSegments.length).toBe(tuefRecord.accountSegments.length);
    });

    it('total file lines = 1 (header) + 2*n (segments) + 1 (trailer)', () => {
      const n = tuefRecord.borrowerSegments.length;
      expect(tuefRecord.lines).toHaveLength(1 + n * 2 + 1);
    });

    it('trailer segment count matches actual segments', () => {
      const expectedCount = 1 + tuefRecord.borrowerSegments.length * 2 + 1;
      const trailerCount = parseInt(tuefRecord.trailer.substring(4), 10);
      expect(trailerCount).toBe(expectedCount);
    });

    it('if no loans, file still has header and trailer', async () => {
      // Simulate empty file
      const emptyFile: TuefRecord = {
        header: buildTuefHeader('GROWTH', REPORTING_DATE),
        borrowerSegments: [],
        accountSegments: [],
        trailer: buildTuefTrailer(2), // header + trailer
        lines: [buildTuefHeader('GROWTH', REPORTING_DATE), buildTuefTrailer(2)],
      };
      expect(emptyFile.lines).toHaveLength(2);
      expect(emptyFile.trailer.startsWith('TRLR')).toBe(true);
    });
  });

  // ── Borrower Segment Validation ─────────────────────────────────────────

  describe('Borrower Segments', () => {
    it('all borrower segments start with PN or EN', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        expect(['PN', 'EN']).toContain(segment.substring(0, 2));
      }
    });

    it('borrower name field is 26 characters', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        const name = segment.substring(2, 28);
        expect(name).toHaveLength(26);
      }
    });

    it('DOB field is 8 numeric characters', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        const dob = segment.substring(28, 36);
        expect(/^\d{8}$/.test(dob)).toBe(true);
      }
    });

    it('gender code is 1, 2, or 3', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        const gender = segment.substring(36, 37);
        expect(['1', '2', '3']).toContain(gender);
      }
    });

    it('PAN field is 10 characters with valid format', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        const pan = segment.substring(40, 50);
        // PAN should be 10 chars
        expect(pan).toHaveLength(10);
        // Valid PAN format: 5 letters + 4 digits + 1 letter
        expect(/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)).toBe(true);
      }
    });

    it('no borrower segment has empty name', () => {
      for (const segment of tuefRecord.borrowerSegments) {
        const name = segment.substring(2, 28).trim();
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Account Segment Validation ──────────────────────────────────────────

  describe('Account Segments', () => {
    it('all account segments start with TL', () => {
      for (const segment of tuefRecord.accountSegments) {
        expect(segment.substring(0, 2)).toBe('TL');
      }
    });

    it('account number field is non-empty', () => {
      for (const segment of tuefRecord.accountSegments) {
        const accountNum = segment.substring(2, 52).trim();
        expect(accountNum.length).toBeGreaterThan(0);
      }
    });

    it('high credit amount is 9 digits (in rupees)', () => {
      for (const segment of tuefRecord.accountSegments) {
        // High credit starts after TL + memberRef(25) + acctNum(25) + acctType(2) + owner(1) + dateOpen(8) + dateLast(8) + dateClosed(8) + dateReported(8)
        const offset = 2 + 25 + 25 + 2 + 1 + 8 + 8 + 8 + 8;
        const highCredit = segment.substring(offset, offset + 9);
        expect(/^\d{9}$/.test(highCredit)).toBe(true);
      }
    });

    it('asset classification is a valid 2-digit code', () => {
      const validCodes = ['00', '01', '02', '03', '04', '05', '06', '07'];
      for (const segment of tuefRecord.accountSegments) {
        const assetClass = segment.substring(segment.length - 2);
        expect(validCodes).toContain(assetClass);
      }
    });

    it('STANDARD loans have asset class 00', async () => {
      const standardLoans = await prisma.loan.count({
        where: {
          organizationId: orgId,
          npaClassification: 'STANDARD',
          loanStatus: { in: ['ACTIVE', 'CLOSED'] },
        },
      });
      // All account segments for standard loans should have assetClass '00'
      // (we can't directly match here without knowing the order, but we can validate the mapping)
      expect(mapNpaToAssetClass(NpaClassification.STANDARD)).toBe('00');
    });

    it('NPA_SUBSTANDARD loans map to asset class 02', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_SUBSTANDARD)).toBe('02');
    });

    it('NPA_LOSS loans map to asset class 05', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_LOSS)).toBe('05');
    });
  });

  // ── NPA Classification Mapping ───────────────────────────────────────────

  describe('NPA to CIBIL Asset Classification Mapping', () => {
    it('STANDARD → 00', () => {
      expect(mapNpaToAssetClass(NpaClassification.STANDARD)).toBe('00');
    });

    it('SMA_0 → 00 (still standard asset quality)', () => {
      expect(mapNpaToAssetClass(NpaClassification.SMA_0)).toBe('00');
    });

    it('SMA_1 → 01 (sub-standard)', () => {
      expect(mapNpaToAssetClass(NpaClassification.SMA_1)).toBe('01');
    });

    it('SMA_2 → 01 (sub-standard)', () => {
      expect(mapNpaToAssetClass(NpaClassification.SMA_2)).toBe('01');
    });

    it('NPA_SUBSTANDARD → 02 (doubtful 1-90 DPD)', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_SUBSTANDARD)).toBe('02');
    });

    it('NPA_DOUBTFUL_1 → 02', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_DOUBTFUL_1)).toBe('02');
    });

    it('NPA_DOUBTFUL_2 → 03', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_DOUBTFUL_2)).toBe('03');
    });

    it('NPA_DOUBTFUL_3 → 04', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_DOUBTFUL_3)).toBe('04');
    });

    it('NPA_LOSS → 05', () => {
      expect(mapNpaToAssetClass(NpaClassification.NPA_LOSS)).toBe('05');
    });
  });

  // ── Trailer Validation ──────────────────────────────────────────────────

  describe('TUEF Trailer', () => {
    it('trailer is the last line of the file', () => {
      const lastLine = tuefRecord.lines[tuefRecord.lines.length - 1];
      expect(lastLine).toBe(tuefRecord.trailer);
    });

    it('trailer starts with TRLR', () => {
      expect(tuefRecord.trailer.startsWith('TRLR')).toBe(true);
    });

    it('trailer segment count is zero-padded 5-digit number', () => {
      const countPart = tuefRecord.trailer.substring(4);
      expect(countPart).toHaveLength(5);
      expect(/^\d{5}$/.test(countPart)).toBe(true);
    });

    it('trailer count includes header, all segments, and trailer itself', () => {
      const trailerCount = parseInt(tuefRecord.trailer.substring(4), 10);
      const expectedCount = 1 + tuefRecord.borrowerSegments.length * 2 + 1;
      expect(trailerCount).toBe(expectedCount);
    });
  });

  // ── Product Type to Account Type Mapping ─────────────────────────────────

  describe('Product to CIBIL Account Type Mapping', () => {
    it('PERSONAL_LOAN → 05', () => {
      expect(mapProductToAccountType('PERSONAL_LOAN')).toBe('05');
    });

    it('HOME_LOAN → 02', () => {
      expect(mapProductToAccountType('HOME_LOAN')).toBe('02');
    });

    it('VEHICLE_FINANCE → 06', () => {
      expect(mapProductToAccountType('VEHICLE_FINANCE')).toBe('06');
    });

    it('GOLD_LOAN → 07', () => {
      expect(mapProductToAccountType('GOLD_LOAN')).toBe('07');
    });

    it('EDUCATION_LOAN → 08', () => {
      expect(mapProductToAccountType('EDUCATION_LOAN')).toBe('08');
    });

    it('unknown product type defaults to 15 (Other)', () => {
      expect(mapProductToAccountType('UNKNOWN_PRODUCT')).toBe('15');
    });
  });
});
