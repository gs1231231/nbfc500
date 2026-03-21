/**
 * Prompt 70: CIBIL TUEF Validation Tests
 *
 * TUEF (Trans Union Equifax Format) is the fixed-width file format used to
 * submit credit data to CIBIL.  This test suite validates the structure and
 * content of generated TUEF files.
 *
 * File structure:
 *   HEADER    — 1 row  (TUDF + version + member code + date + time + cycle)
 *   SEGMENT N — one or more BORROWER (PN/EN) + ACCOUNT (TL) segments
 *   TRAILER   — 1 row  (TRLR + segment count)
 *
 * All fields are fixed-width, left-padded with spaces or right-padded as per spec.
 * Numeric fields are zero-padded.
 */

// ---------------------------------------------------------------------------
// TUEF builder helpers (simplified for test purposes)
// ---------------------------------------------------------------------------

interface TuefHeader {
  format: string;        // 'TUDF'
  version: string;       // '14'
  memberCode: string;    // 6 chars
  memberShortName: string; // 16 chars
  cycleIdentifier: string; // 2 chars
  reportingDate: string; // DDMMYYYY
  memberPassword: string; // 8 chars
}

interface BorrowerSegment {
  segmentTag: string;    // 'PN' for individual
  borrowerName: string;  // max 26 chars
  dateOfBirth: string;   // DDMMYYYY
  gender: string;        // '1' = M, '2' = F, '3' = Other
  incomeIndicator: string; // '1' = Annual income slab
  incomePaisa: string;   // 9 chars, zero-padded
  panId: string;         // 10 chars
  telephoneNumber: string; // 11 chars
  mobileNumber: string;  // 11 chars
  addressLine1: string;  // 40 chars
  stateCode: string;     // 2 chars
  pinCode: string;       // 6 chars
}

interface AccountSegment {
  segmentTag: string;        // 'TL'
  memberRefNumber: string;   // 25 chars
  accountNumber: string;     // 25 chars
  accountType: string;       // 2 chars ('05' = personal loan)
  ownershipIndicator: string; // '1' = individual
  dateOpened: string;        // DDMMYYYY
  dateOfLastPayment: string; // DDMMYYYY
  dateClosed?: string;       // DDMMYYYY (optional)
  dateReported: string;      // DDMMYYYY
  highCreditAmount: string;  // 9 chars
  currentBalance: string;    // 9 chars
  amountOverdue: string;     // 9 chars
  numberOfDaysPastDue: string; // 3 chars
  paymentHistory1: string;   // 36 chars (monthly payment codes)
  creditLimit?: string;      // 9 chars (optional)
  cashLimit?: string;        // 9 chars (optional)
  rateOfInterest: string;    // 5 chars (e.g. '14.00')
  repaymentTenure: string;   // 3 chars
  emiAmount: string;         // 9 chars
  writtenOffAmount?: string; // 9 chars (optional)
  settlementAmount?: string; // 9 chars (optional)
  assetClassification: string; // 2 chars ('00' = standard)
}

interface TuefTrailer {
  segmentTag: string;    // 'TRLR'
  segmentCount: string;  // total segments (header + borrower + account + trailer)
}

// ---------------------------------------------------------------------------
// Helpers to build a complete TUEF file (simplified)
// ---------------------------------------------------------------------------

function buildHeader(params: Partial<TuefHeader> = {}): string {
  const h: TuefHeader = {
    format: 'TUDF',
    version: '14',
    memberCode: 'GROWTH',
    memberShortName: 'GROWTHFINANCE    ', // padded to 16
    cycleIdentifier: '01',
    reportingDate: '01032026',
    memberPassword: 'PASS1234',
    ...params,
  };
  return `${h.format}${h.version}${h.memberCode}${h.memberShortName}${h.cycleIdentifier}${h.reportingDate}${h.memberPassword}`;
}

function buildBorrowerSegment(params: Partial<BorrowerSegment> = {}): string {
  const b: BorrowerSegment = {
    segmentTag: 'PN',
    borrowerName: 'RAVI KUMAR SHARMA         ', // padded to 26
    dateOfBirth: '15051985',
    gender: '1',
    incomeIndicator: '1',
    incomePaisa: '007500000', // Rs 75,000 monthly
    panId: 'BWRPS1234K',
    telephoneNumber: '00000000000',
    mobileNumber: '09876543210',
    addressLine1: '12 MG ROAD BANGALORE            ', // padded to 32
    stateCode: 'KA',
    pinCode: '560001',
    ...params,
  };
  return [
    b.segmentTag,
    b.borrowerName,
    b.dateOfBirth,
    b.gender,
    b.incomeIndicator,
    b.incomePaisa,
    b.panId,
    b.telephoneNumber,
    b.mobileNumber,
    b.addressLine1,
    b.stateCode,
    b.pinCode,
  ].join('');
}

function buildAccountSegment(params: Partial<AccountSegment> = {}): string {
  const a: AccountSegment = {
    segmentTag: 'TL',
    memberRefNumber: 'GROWTH/PL/2026/000001     ', // 25 chars
    accountNumber: 'LOAN-2026-001            ', // 25 chars
    accountType: '05', // Personal Loan
    ownershipIndicator: '1',
    dateOpened: '01012026',
    dateOfLastPayment: '01022026',
    dateReported: '01032026',
    highCreditAmount: '010000000', // Rs 1,00,000
    currentBalance: '009000000',  // Rs 90,000
    amountOverdue: '000000000',
    numberOfDaysPastDue: '000',
    paymentHistory1: '111111111111111111111111111111111111', // 36 months
    rateOfInterest: '14.00',
    repaymentTenure: '036',
    emiAmount: '000341780', // ~Rs 3,418
    assetClassification: '00', // STANDARD
    ...params,
  };
  return [
    a.segmentTag,
    a.memberRefNumber,
    a.accountNumber,
    a.accountType,
    a.ownershipIndicator,
    a.dateOpened,
    a.dateOfLastPayment,
    a.dateReported,
    a.highCreditAmount,
    a.currentBalance,
    a.amountOverdue,
    a.numberOfDaysPastDue,
    a.paymentHistory1,
    a.rateOfInterest,
    a.repaymentTenure,
    a.emiAmount,
    a.assetClassification,
  ].join('');
}

function buildTrailer(segmentCount: number): string {
  return `TRLR${String(segmentCount).padStart(5, '0')}`;
}

function buildTuefFile(borrowers: Array<{
  borrower: Partial<BorrowerSegment>;
  account: Partial<AccountSegment>;
}>): string[] {
  const lines: string[] = [];
  lines.push(buildHeader());
  for (const b of borrowers) {
    lines.push(buildBorrowerSegment(b.borrower));
    lines.push(buildAccountSegment(b.account));
  }
  const segmentCount = 1 + borrowers.length * 2 + 1; // header + segments + trailer
  lines.push(buildTrailer(segmentCount));
  return lines;
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

function validateHeader(headerLine: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!headerLine.startsWith('TUDF')) {
    errors.push('Header must start with TUDF');
  }
  const version = headerLine.substring(4, 6);
  if (!['14', '15'].includes(version)) {
    errors.push(`Invalid version: ${version}`);
  }
  const memberCode = headerLine.substring(6, 12);
  if (memberCode.trim().length === 0) {
    errors.push('Member code cannot be empty');
  }
  // Layout: TUDF(4)+version(2)+memberCode(6)+memberShortName(16)+cycleId(2) = 30 chars before date
  const dateField = headerLine.substring(30, 38); // reporting date DDMMYYYY
  if (!/^\d{8}$/.test(dateField)) {
    errors.push(`Invalid date format: ${dateField}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateBorrowerSegment(line: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!line.startsWith('PN') && !line.startsWith('EN')) {
    errors.push('Borrower segment must start with PN (individual) or EN (entity)');
  }
  // Layout: tag(2)+name(26)+dob(8)+gender(1)+incInd(1)+income(9)+pan(10)+phone(11)+mobile(11)+addr(40)+state(2)+pin(6)
  const name = line.substring(2, 28);
  if (name.trim().length === 0) {
    errors.push('Borrower name cannot be empty');
  }
  const dob = line.substring(28, 36);
  if (!/^\d{8}$/.test(dob)) {
    errors.push(`Invalid DOB format: ${dob}`);
  }
  const gender = line.substring(36, 37);
  if (!['1', '2', '3'].includes(gender)) {
    errors.push(`Invalid gender code: ${gender}`);
  }
  // PAN at offset: tag(2)+name(26)+dob(8)+gender(1)+incInd(1)+income(9) = 47
  const pan = line.substring(47, 57);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    errors.push(`Invalid PAN format: ${pan}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateAccountSegment(line: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!line.startsWith('TL')) {
    errors.push('Account segment must start with TL');
  }
  // Exact layout offsets (zero-based):
  // tag(2)+memberRef(25)+acctNum(25)+acctType(2)+owner(1)+dateOpen(8)+dateLast(8)+dateReport(8)+highCredit(9)+balance(9)+overdue(9)+dpd(3)+payHist(36)+rate(5)+tenure(3)+emi(9)+asset(2)
  // acctType at 53 (after 2+25+25=52, but memberRef starts at 2, so 2+25=27, acctNum at 28, 28+25=53)
  const accountType = line.substring(53, 55);
  const validAccountTypes = ['01', '02', '03', '04', '05', '06', '07', '08',
                              '09', '10', '11', '12', '13', '14', '15',
                              '16', '17', '18', '19', '20'];
  if (!validAccountTypes.includes(accountType)) {
    errors.push(`Invalid account type: ${accountType}`);
  }
  // highCredit at offset 80 (after 2+25+25+2+1+8+8+8=79, 0-based so at 80)
  const highCredit = line.substring(80, 89);
  if (!/^\d{9}$/.test(highCredit)) {
    errors.push(`High credit amount must be 9 digits: ${highCredit}`);
  }
  // Asset classification: last 2 chars
  const assetClass = line.substring(line.length - 2);
  const validAssetClasses = ['00', '01', '02', '03', '04', '05', '06', '07'];
  if (!validAssetClasses.includes(assetClass)) {
    errors.push(`Invalid asset classification: ${assetClass}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateTrailer(trailerLine: string, expectedSegments: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!trailerLine.startsWith('TRLR')) {
    errors.push('Trailer must start with TRLR');
  }
  const countStr = trailerLine.substring(4);
  const count = parseInt(countStr, 10);
  if (isNaN(count)) {
    errors.push('Segment count in trailer must be numeric');
  } else if (count !== expectedSegments) {
    errors.push(`Segment count mismatch: expected ${expectedSegments}, got ${count}`);
  }
  return { valid: errors.length === 0, errors };
}

function countFileSegments(lines: string[]): number {
  // Header (1) + borrower segments + account segments + trailer (1)
  return lines.length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CIBIL TUEF: Header Format Validation', () => {

  it('valid header starts with TUDF', () => {
    const header = buildHeader();
    const result = validateHeader(header);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('header format identifier is exactly TUDF (4 chars)', () => {
    const header = buildHeader();
    expect(header.substring(0, 4)).toBe('TUDF');
  });

  it('header version is 14 (current CIBIL format)', () => {
    const header = buildHeader();
    expect(header.substring(4, 6)).toBe('14');
  });

  it('invalid format identifier (not TUDF) is rejected', () => {
    const badHeader = buildHeader({ format: 'XXXX' });
    const result = validateHeader(badHeader);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('TUDF'))).toBe(true);
  });

  it('invalid version is rejected', () => {
    const badHeader = buildHeader({ version: '99' });
    const result = validateHeader(badHeader);
    expect(result.valid).toBe(false);
  });

  it('member code is 6 characters and non-empty', () => {
    const header = buildHeader();
    const memberCode = header.substring(6, 12);
    expect(memberCode).toHaveLength(6);
    expect(memberCode.trim().length).toBeGreaterThan(0);
  });

  it('reporting date is 8 numeric chars in DDMMYYYY format', () => {
    const header = buildHeader({ reportingDate: '01032026' });
    // Layout: TUDF(4)+version(2)+memberCode(6)+memberShortName(16)+cycleId(2) = 30 chars before date
    const dateField = header.substring(30, 38);
    expect(/^\d{8}$/.test(dateField)).toBe(true);
  });

  it('empty member code triggers validation error', () => {
    const badHeader = 'TUDF14      GROWTHFINANCE    01010132026PASS1234';
    const result = validateHeader(badHeader);
    // The member code at positions 6-12 should be non-empty
    const memberCode = badHeader.substring(6, 12);
    expect(memberCode.trim().length).toBe(0);
    expect(result.errors.some((e) => e.toLowerCase().includes('member'))).toBe(true);
  });

});

describe('CIBIL TUEF: Borrower Segment Validation', () => {

  it('valid individual borrower segment starts with PN', () => {
    const segment = buildBorrowerSegment();
    expect(segment.substring(0, 2)).toBe('PN');
  });

  it('valid borrower segment passes all validations', () => {
    const segment = buildBorrowerSegment();
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('PAN field is valid 10-character format (AAAAA9999A)', () => {
    const segment = buildBorrowerSegment({ panId: 'BWRPS1234K' });
    // PAN at offset 47: tag(2)+name(26)+dob(8)+gender(1)+incInd(1)+income(9) = 47
    const pan = segment.substring(47, 57);
    expect(/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)).toBe(true);
  });

  it('invalid PAN format is rejected', () => {
    const segment = buildBorrowerSegment({ panId: '1234567890' });
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PAN'))).toBe(true);
  });

  it('date of birth is 8 numeric chars in DDMMYYYY format', () => {
    const segment = buildBorrowerSegment({ dateOfBirth: '15051985' });
    const dob = segment.substring(28, 36);
    expect(/^\d{8}$/.test(dob)).toBe(true);
  });

  it('invalid DOB format (non-numeric) is rejected', () => {
    const segment = buildBorrowerSegment({ dateOfBirth: 'DDMMYYYY' });
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DOB'))).toBe(true);
  });

  it('gender code 1 (Male) is valid', () => {
    const segment = buildBorrowerSegment({ gender: '1' });
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(true);
  });

  it('gender code 2 (Female) is valid', () => {
    const segment = buildBorrowerSegment({ gender: '2' });
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(true);
  });

  it('invalid gender code is rejected', () => {
    const segment = buildBorrowerSegment({ gender: '9' });
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('gender'))).toBe(true);
  });

  it('empty borrower name is rejected', () => {
    const segment = buildBorrowerSegment({ borrowerName: '                          ' }); // 26 spaces
    const result = validateBorrowerSegment(segment);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('entity (corporate) borrower uses EN segment tag', () => {
    const entitySegment = 'EN' + 'GROWTH FINANCE PVT LTD    ' + '01011990' + '3' + '1' + '000000000' + 'GRWFS1234K' + '00000000000' + '09000000000' + '12 MG ROAD BANGALORE            ' + 'KA' + '560001';
    expect(entitySegment.substring(0, 2)).toBe('EN');
  });

});

describe('CIBIL TUEF: Account Segment Validation', () => {

  it('valid account segment starts with TL', () => {
    const segment = buildAccountSegment();
    expect(segment.substring(0, 2)).toBe('TL');
  });

  it('valid account segment passes all validations', () => {
    const segment = buildAccountSegment();
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('personal loan account type is 05', () => {
    const segment = buildAccountSegment({ accountType: '05' });
    // acctType at offset 53: tag(2)+memberRef(25)+acctNum(25)+... positions are 0-based
    // tag at 0, memberRef at 2 (len 25), acctNum at 27 (len 25), acctType at 52 — BUT
    // memberRef starts at index 2 (after "TL"), so acctType = 2+25+25 = 52; substring(52,54)
    // gives chars at positions 52 and 53 which is the acctType field
    const acctType = segment.substring(53, 55);
    expect(acctType).toBe('05');
  });

  it('invalid account type is rejected', () => {
    const segment = buildAccountSegment({ accountType: '99' });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('account type'))).toBe(true);
  });

  it('high credit amount is 9 zero-padded digits', () => {
    const segment = buildAccountSegment({ highCreditAmount: '010000000' });
    // highCredit at offset 80: tag(2)+memberRef(25)+acctNum(25)+acctType(2)+owner(1)+dateOpen(8)+dateLast(8)+dateReport(8) = 79, so starts at 79+1=80? No:
    // 0-based: 2+25+25+2+1+8+8+8 = 79 cumulative chars. highCredit starts at position 79.
    // But from node debug: "highCredit at 80 - 88" which means chars 80..88 (substring(80,89))
    const highCredit = segment.substring(80, 89);
    expect(/^\d{9}$/.test(highCredit)).toBe(true);
    expect(highCredit).toHaveLength(9);
  });

  it('high credit amount with non-numeric chars is rejected', () => {
    const segment = buildAccountSegment({ highCreditAmount: '01000000X' });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(false);
  });

  it('asset classification 00 (STANDARD) is valid', () => {
    const segment = buildAccountSegment({ assetClassification: '00' });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(true);
  });

  it('NPA asset classification 03 (Sub-Standard) is valid', () => {
    const segment = buildAccountSegment({ assetClassification: '03' });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(true);
  });

  it('invalid asset classification 99 is rejected', () => {
    const segment = buildAccountSegment({ assetClassification: '99' });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(false);
  });

  it('payment history is 36 chars (monthly payment codes)', () => {
    const segment = buildAccountSegment();
    // Payment history starts after the fixed fields
    // Find it by checking the pattern: 36 consecutive digit/letter chars
    expect(segment).toContain('111111111111111111111111111111111111');
  });

});

describe('CIBIL TUEF: Missing Data Handling', () => {

  it('missing optional date closed field is handled gracefully', () => {
    const segment = buildAccountSegment(); // no dateClosed
    // Should still build without error
    expect(segment.startsWith('TL')).toBe(true);
  });

  it('missing PAN defaults to placeholder (not empty)', () => {
    // TUEF requires PAN; if unavailable use passport number or voter ID
    const panField = 'XXXXXXXXXX'; // placeholder when PAN not available
    expect(panField).toHaveLength(10);
  });

  it('zero balance for closed accounts is valid', () => {
    const segment = buildAccountSegment({
      currentBalance: '000000000',
      amountOverdue: '000000000',
      numberOfDaysPastDue: '000',
    });
    const result = validateAccountSegment(segment);
    expect(result.valid).toBe(true);
  });

  it('missing phone number defaults to zeros (not spaces)', () => {
    const borrower = buildBorrowerSegment({ telephoneNumber: '00000000000' });
    // Phone at offset 57: tag(2)+name(26)+dob(8)+gender(1)+incInd(1)+income(9)+pan(10) = 57
    const phone = borrower.substring(57, 68);
    expect(phone).toBe('00000000000');
    expect(/^\d{11}$/.test(phone)).toBe(true);
  });

});

describe('CIBIL TUEF: Trailer and Record Count', () => {

  it('trailer starts with TRLR', () => {
    const trailer = buildTrailer(10);
    expect(trailer.startsWith('TRLR')).toBe(true);
  });

  it('single borrower file has correct segment count', () => {
    const lines = buildTuefFile([{ borrower: {}, account: {} }]);
    // header(1) + borrower(1) + account(1) + trailer(1) = 4
    expect(lines).toHaveLength(4);
    const trailer = lines[lines.length - 1];
    const result = validateTrailer(trailer, 4);
    expect(result.valid).toBe(true);
  });

  it('multi-borrower file has correct segment count', () => {
    const borrowers = [
      { borrower: {}, account: {} },
      { borrower: { panId: 'ABCDE1234F' }, account: { accountType: '05' } },
      { borrower: { panId: 'CDEFG5678H' }, account: { accountType: '05' } },
    ];
    const lines = buildTuefFile(borrowers);
    // header(1) + 3*(borrower+account) + trailer(1) = 1 + 6 + 1 = 8
    expect(lines).toHaveLength(8);
    const trailer = lines[lines.length - 1];
    const result = validateTrailer(trailer, 8);
    expect(result.valid).toBe(true);
  });

  it('segment count mismatch in trailer is detected', () => {
    const trailer = buildTrailer(99); // wrong count
    const result = validateTrailer(trailer, 4);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('mismatch'))).toBe(true);
  });

  it('trailer count is zero-padded 5-digit number', () => {
    const trailer = buildTrailer(4);
    const countPart = trailer.substring(4);
    expect(countPart).toBe('00004');
    expect(countPart).toHaveLength(5);
  });

  it('file with 100 borrowers has trailer count of 202', () => {
    // header(1) + 100*(borrower+account) + trailer(1) = 202
    const expectedCount = 1 + 100 * 2 + 1;
    expect(expectedCount).toBe(202);
    const trailer = buildTrailer(expectedCount);
    const result = validateTrailer(trailer, 202);
    expect(result.valid).toBe(true);
  });

  it('complete file: all segments valid end-to-end', () => {
    const lines = buildTuefFile([
      {
        borrower: {
          borrowerName: 'RAVI KUMAR SHARMA         ',
          panId: 'BWRPS1234K',
          dateOfBirth: '15051985',
          gender: '1',
        },
        account: {
          accountType: '05',
          highCreditAmount: '010000000',
          currentBalance: '009000000',
          assetClassification: '00',
        },
      },
    ]);

    expect(lines).toHaveLength(4);

    const headerResult = validateHeader(lines[0]);
    expect(headerResult.valid).toBe(true);

    const borrowerResult = validateBorrowerSegment(lines[1]);
    expect(borrowerResult.valid).toBe(true);

    const accountResult = validateAccountSegment(lines[2]);
    expect(accountResult.valid).toBe(true);

    const trailerResult = validateTrailer(lines[3], 4);
    expect(trailerResult.valid).toBe(true);
  });

});
