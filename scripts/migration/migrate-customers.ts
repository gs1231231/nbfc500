/**
 * Prompt 77: Customer Migration Script
 *
 * Imports customers from a CSV file into the BankOS database.
 *
 * CSV columns (in order):
 *   customer_number, customer_type, first_name, middle_name, last_name,
 *   date_of_birth (YYYY-MM-DD), gender, pan_number, aadhaar_number,
 *   email, phone, alternate_phone, employment_type, employer_name,
 *   monthly_income_inr, kyc_status, current_address1, current_address2,
 *   current_city, current_state, current_pincode, permanent_address1,
 *   permanent_address2, permanent_city, permanent_state, permanent_pincode
 *
 * Usage:
 *   ts-node scripts/migration/migrate-customers.ts \
 *     --file data/customers.csv \
 *     --org-code GROWTH \
 *     [--dry-run] \
 *     [--batch-size 100] \
 *     [--skip-duplicates]
 *
 * Exit codes:
 *   0 = success
 *   1 = fatal error (bad args, DB connection failure)
 *   2 = partial failure (some rows errored)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationRow {
  lineNumber: number;
  customerNumber: string;
  customerType: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  panNumber: string;
  aadhaarNumber: string;
  email: string;
  phone: string;
  alternatePhone: string;
  employmentType: string;
  employerName: string;
  monthlyIncomeInr: string;
  kycStatus: string;
  currentAddress1: string;
  currentAddress2: string;
  currentCity: string;
  currentState: string;
  currentPincode: string;
  permanentAddress1: string;
  permanentAddress2: string;
  permanentCity: string;
  permanentState: string;
  permanentPincode: string;
}

interface MigrationResult {
  totalRows: number;
  successCount: number;
  skipCount: number;
  errorCount: number;
  errors: Array<{ line: number; customerNumber: string; error: string }>;
  durationMs: number;
}

interface MigrationOptions {
  filePath: string;
  orgCode: string;
  dryRun: boolean;
  batchSize: number;
  skipDuplicates: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_CUSTOMER_TYPES = [
  'INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP',
  'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'HUF', 'TRUST',
];

const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'];

const VALID_EMPLOYMENT_TYPES = [
  'SALARIED', 'SELF_EMPLOYED_PROFESSIONAL', 'SELF_EMPLOYED_BUSINESS',
  'RETIRED', 'HOMEMAKER', 'STUDENT', 'UNEMPLOYED',
];

const VALID_KYC_STATUSES = ['PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED'];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateRow(row: MigrationRow): string[] {
  const errors: string[] = [];

  if (!row.customerNumber?.trim()) {
    errors.push('customer_number is required');
  }
  if (!VALID_CUSTOMER_TYPES.includes(row.customerType?.trim()?.toUpperCase())) {
    errors.push(`Invalid customer_type: ${row.customerType}. Must be one of: ${VALID_CUSTOMER_TYPES.join(', ')}`);
  }
  if (!row.firstName?.trim()) {
    errors.push('first_name is required');
  }
  if (!row.lastName?.trim()) {
    errors.push('last_name is required');
  }
  if (!DATE_REGEX.test(row.dateOfBirth?.trim())) {
    errors.push(`Invalid date_of_birth: ${row.dateOfBirth}. Must be YYYY-MM-DD`);
  }
  if (!VALID_GENDERS.includes(row.gender?.trim()?.toUpperCase())) {
    errors.push(`Invalid gender: ${row.gender}. Must be MALE, FEMALE, or OTHER`);
  }
  if (!PAN_REGEX.test(row.panNumber?.trim()?.toUpperCase())) {
    errors.push(`Invalid PAN: ${row.panNumber}. Must be AAAAA9999A format`);
  }
  if (!PHONE_REGEX.test(row.phone?.trim())) {
    errors.push(`Invalid phone: ${row.phone}. Must be 10-digit Indian mobile number starting with 6-9`);
  }
  if (!VALID_EMPLOYMENT_TYPES.includes(row.employmentType?.trim()?.toUpperCase())) {
    errors.push(`Invalid employment_type: ${row.employmentType}`);
  }
  if (!VALID_KYC_STATUSES.includes(row.kycStatus?.trim()?.toUpperCase())) {
    errors.push(`Invalid kyc_status: ${row.kycStatus}`);
  }
  const income = parseFloat(row.monthlyIncomeInr);
  if (isNaN(income) || income < 0) {
    errors.push(`Invalid monthly_income_inr: ${row.monthlyIncomeInr}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

async function parseCsv(filePath: string): Promise<MigrationRow[]> {
  const rows: MigrationRow[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNumber = 0;
  let headers: string[] = [];

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber === 1) {
      headers = line.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      continue;
    }

    if (!line.trim()) continue; // skip empty lines

    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });

    rows.push({
      lineNumber,
      customerNumber: obj['customer_number'] ?? '',
      customerType: obj['customer_type'] ?? 'INDIVIDUAL',
      firstName: obj['first_name'] ?? '',
      middleName: obj['middle_name'] ?? '',
      lastName: obj['last_name'] ?? '',
      dateOfBirth: obj['date_of_birth'] ?? '',
      gender: obj['gender'] ?? '',
      panNumber: obj['pan_number'] ?? '',
      aadhaarNumber: obj['aadhaar_number'] ?? '',
      email: obj['email'] ?? '',
      phone: obj['phone'] ?? '',
      alternatePhone: obj['alternate_phone'] ?? '',
      employmentType: obj['employment_type'] ?? '',
      employerName: obj['employer_name'] ?? '',
      monthlyIncomeInr: obj['monthly_income_inr'] ?? '0',
      kycStatus: obj['kyc_status'] ?? 'PENDING',
      currentAddress1: obj['current_address1'] ?? '',
      currentAddress2: obj['current_address2'] ?? '',
      currentCity: obj['current_city'] ?? '',
      currentState: obj['current_state'] ?? '',
      currentPincode: obj['current_pincode'] ?? '',
      permanentAddress1: obj['permanent_address1'] ?? '',
      permanentAddress2: obj['permanent_address2'] ?? '',
      permanentCity: obj['permanent_city'] ?? '',
      permanentState: obj['permanent_state'] ?? '',
      permanentPincode: obj['permanent_pincode'] ?? '',
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

async function migrateCustomers(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    totalRows: 0,
    successCount: 0,
    skipCount: 0,
    errorCount: 0,
    errors: [],
    durationMs: 0,
  };

  const prisma = new PrismaClient({
    log: options.dryRun ? ['warn'] : ['error'],
  });

  try {
    // Look up the org
    const org = await prisma.organization.findFirst({ where: { code: options.orgCode } });
    if (!org) {
      throw new Error(`Organization with code '${options.orgCode}' not found.`);
    }
    console.log(`Target org: ${org.name} (${org.id})`);

    // Parse CSV
    console.log(`Parsing CSV: ${options.filePath}`);
    const rows = await parseCsv(options.filePath);
    result.totalRows = rows.length;
    console.log(`Found ${rows.length} rows to process.`);

    if (options.dryRun) {
      console.log('[DRY RUN] No data will be written to the database.');
    }

    // Process in batches
    for (let batchStart = 0; batchStart < rows.length; batchStart += options.batchSize) {
      const batch = rows.slice(batchStart, batchStart + options.batchSize);
      const batchNum = Math.floor(batchStart / options.batchSize) + 1;
      const totalBatches = Math.ceil(rows.length / options.batchSize);
      console.log(`Processing batch ${batchNum}/${totalBatches} (rows ${batchStart + 1}-${batchStart + batch.length})`);

      for (const row of batch) {
        // Validate
        const validationErrors = validateRow(row);
        if (validationErrors.length > 0) {
          result.errorCount++;
          result.errors.push({
            line: row.lineNumber,
            customerNumber: row.customerNumber,
            error: validationErrors.join('; '),
          });
          continue;
        }

        try {
          // Check for duplicate
          if (options.skipDuplicates) {
            const existing = await prisma.customer.findFirst({
              where: {
                organizationId: org.id,
                panNumber: row.panNumber.trim().toUpperCase(),
              },
            });
            if (existing) {
              console.log(`  SKIP: Line ${row.lineNumber} — PAN ${row.panNumber} already exists (customer: ${existing.customerNumber})`);
              result.skipCount++;
              continue;
            }
          }

          const customerData = {
            organizationId: org.id,
            customerNumber: row.customerNumber.trim(),
            customerType: row.customerType.trim().toUpperCase() as any,
            firstName: row.firstName.trim(),
            middleName: row.middleName.trim() || null,
            lastName: row.lastName.trim(),
            fullName: [row.firstName, row.middleName, row.lastName]
              .filter(Boolean)
              .map((n) => n.trim())
              .join(' '),
            dateOfBirth: new Date(row.dateOfBirth.trim()),
            gender: row.gender.trim().toUpperCase() as any,
            panNumber: row.panNumber.trim().toUpperCase(),
            aadhaarNumber: row.aadhaarNumber.trim() || null,
            email: row.email.trim() || null,
            phone: row.phone.trim(),
            alternatePhone: row.alternatePhone.trim() || null,
            employmentType: row.employmentType.trim().toUpperCase() as any,
            employerName: row.employerName.trim() || null,
            monthlyIncomePaisa: Math.round(parseFloat(row.monthlyIncomeInr) * 100), // INR → paisa
            kycStatus: row.kycStatus.trim().toUpperCase() as any,
            currentAddressLine1: row.currentAddress1.trim() || null,
            currentAddressLine2: row.currentAddress2.trim() || null,
            currentCity: row.currentCity.trim() || null,
            currentState: row.currentState.trim() || null,
            currentPincode: row.currentPincode.trim() || null,
            permanentAddressLine1: row.permanentAddress1.trim() || null,
            permanentAddressLine2: row.permanentAddress2.trim() || null,
            permanentCity: row.permanentCity.trim() || null,
            permanentState: row.permanentState.trim() || null,
            permanentPincode: row.permanentPincode.trim() || null,
          };

          if (!options.dryRun) {
            await prisma.customer.create({ data: customerData });
          }

          result.successCount++;
          if (options.dryRun) {
            console.log(`  [DRY RUN] Would create: ${row.customerNumber} — ${row.firstName} ${row.lastName}`);
          }
        } catch (err: unknown) {
          result.errorCount++;
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push({
            line: row.lineNumber,
            customerNumber: row.customerNumber,
            error: message,
          });
          console.error(`  ERROR: Line ${row.lineNumber} — ${row.customerNumber}: ${message}`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
    result.durationMs = Date.now() - startTime;
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const filePath = get('--file');
  const orgCode = get('--org-code');

  if (!filePath) {
    console.error('ERROR: --file <path/to/customers.csv> is required');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }
  if (!orgCode) {
    console.error('ERROR: --org-code <CODE> is required');
    process.exit(1);
  }

  return {
    filePath: path.resolve(filePath),
    orgCode: orgCode.toUpperCase(),
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(get('--batch-size') ?? '100', 10),
    skipDuplicates: args.includes('--skip-duplicates'),
  };
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           BankOS Customer Migration Script');
  console.log('═══════════════════════════════════════════════════════════');

  const options = parseArgs();
  console.log(`File:            ${options.filePath}`);
  console.log(`Org Code:        ${options.orgCode}`);
  console.log(`Dry Run:         ${options.dryRun}`);
  console.log(`Batch Size:      ${options.batchSize}`);
  console.log(`Skip Duplicates: ${options.skipDuplicates}`);
  console.log('───────────────────────────────────────────────────────────');

  const result = await migrateCustomers(options);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   MIGRATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Rows:      ${result.totalRows}`);
  console.log(`Succeeded:       ${result.successCount}`);
  console.log(`Skipped:         ${result.skipCount}`);
  console.log(`Errors:          ${result.errorCount}`);
  console.log(`Duration:        ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log('\nError Details:');
    result.errors.forEach((e) => {
      console.log(`  Line ${e.line} [${e.customerNumber}]: ${e.error}`);
    });
  }

  if (options.dryRun) {
    console.log('\n[DRY RUN COMPLETE] No records were written. Remove --dry-run to execute.');
  }

  // Write error log
  if (result.errors.length > 0) {
    const logPath = `customer-migration-errors-${Date.now()}.json`;
    fs.writeFileSync(logPath, JSON.stringify(result.errors, null, 2));
    console.log(`\nError log written to: ${logPath}`);
  }

  process.exit(result.errorCount > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
