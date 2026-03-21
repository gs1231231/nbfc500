/**
 * Prompt 77: Loan Migration Script
 *
 * Imports existing loans with amortization schedules from a CSV file.
 * Regenerates the amortization schedule using the BankOS calculator to
 * ensure mathematical accuracy, and cross-validates against the source data.
 *
 * CSV columns (loans):
 *   loan_number, application_number, customer_pan, product_code,
 *   branch_code, disbursed_amount_inr, disbursement_date (YYYY-MM-DD),
 *   interest_rate_percent, tenure_months, emi_amount_inr,
 *   outstanding_principal_inr, total_overdue_inr, dpd,
 *   loan_status, maturity_date (YYYY-MM-DD), closure_date (YYYY-MM-DD)
 *
 * Usage:
 *   ts-node scripts/migration/migrate-loans.ts \
 *     --file data/loans.csv \
 *     --org-code GROWTH \
 *     [--dry-run] \
 *     [--batch-size 50] \
 *     [--skip-duplicates] \
 *     [--regenerate-schedule]
 *
 * Exit codes:
 *   0 = success
 *   1 = fatal error
 *   2 = partial failure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import {
  calculateEmi,
  generateSchedule,
} from '../../libs/common/src/utils/financial-calculator';
import { classifyNpa } from '../../libs/common/src/utils/financial-calculator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoanMigrationRow {
  lineNumber: number;
  loanNumber: string;
  applicationNumber: string;
  customerPan: string;
  productCode: string;
  branchCode: string;
  disbursedAmountInr: string;
  disbursementDate: string;
  interestRatePercent: string;
  tenureMonths: string;
  emiAmountInr: string;
  outstandingPrincipalInr: string;
  totalOverdueInr: string;
  dpd: string;
  loanStatus: string;
  maturityDate: string;
  closureDate: string;
}

interface MigrationResult {
  totalRows: number;
  successCount: number;
  skipCount: number;
  errorCount: number;
  scheduleGeneratedCount: number;
  warnings: Array<{ line: number; loanNumber: string; warning: string }>;
  errors: Array<{ line: number; loanNumber: string; error: string }>;
  durationMs: number;
}

interface MigrationOptions {
  filePath: string;
  orgCode: string;
  dryRun: boolean;
  batchSize: number;
  skipDuplicates: boolean;
  regenerateSchedule: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_LOAN_STATUSES = ['ACTIVE', 'CLOSED', 'WRITTEN_OFF', 'RESTRUCTURED', 'FORECLOSED', 'SETTLED'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateLoanRow(row: LoanMigrationRow): string[] {
  const errors: string[] = [];

  if (!row.loanNumber?.trim()) errors.push('loan_number is required');
  if (!row.customerPan?.trim()) errors.push('customer_pan is required');
  if (!row.productCode?.trim()) errors.push('product_code is required');
  if (!row.branchCode?.trim()) errors.push('branch_code is required');

  const amount = parseFloat(row.disbursedAmountInr);
  if (isNaN(amount) || amount <= 0) {
    errors.push(`Invalid disbursed_amount_inr: ${row.disbursedAmountInr}`);
  }

  if (!DATE_REGEX.test(row.disbursementDate?.trim())) {
    errors.push(`Invalid disbursement_date: ${row.disbursementDate}. Must be YYYY-MM-DD`);
  }

  const rate = parseFloat(row.interestRatePercent);
  if (isNaN(rate) || rate < 0 || rate > 50) {
    errors.push(`Invalid interest_rate_percent: ${row.interestRatePercent}`);
  }

  const tenure = parseInt(row.tenureMonths, 10);
  if (isNaN(tenure) || tenure < 1 || tenure > 360) {
    errors.push(`Invalid tenure_months: ${row.tenureMonths}`);
  }

  if (!VALID_LOAN_STATUSES.includes(row.loanStatus?.trim()?.toUpperCase())) {
    errors.push(`Invalid loan_status: ${row.loanStatus}. Must be one of: ${VALID_LOAN_STATUSES.join(', ')}`);
  }

  if (!DATE_REGEX.test(row.maturityDate?.trim())) {
    errors.push(`Invalid maturity_date: ${row.maturityDate}`);
  }

  const dpd = parseInt(row.dpd, 10);
  if (isNaN(dpd) || dpd < 0) {
    errors.push(`Invalid dpd: ${row.dpd}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

async function parseLoanCsv(filePath: string): Promise<LoanMigrationRow[]> {
  const rows: LoanMigrationRow[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let headers: string[] = [];

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber === 1) {
      headers = line.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      continue;
    }
    if (!line.trim()) continue;

    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });

    rows.push({
      lineNumber,
      loanNumber: obj['loan_number'] ?? '',
      applicationNumber: obj['application_number'] ?? '',
      customerPan: obj['customer_pan'] ?? '',
      productCode: obj['product_code'] ?? '',
      branchCode: obj['branch_code'] ?? '',
      disbursedAmountInr: obj['disbursed_amount_inr'] ?? '0',
      disbursementDate: obj['disbursement_date'] ?? '',
      interestRatePercent: obj['interest_rate_percent'] ?? '0',
      tenureMonths: obj['tenure_months'] ?? '12',
      emiAmountInr: obj['emi_amount_inr'] ?? '0',
      outstandingPrincipalInr: obj['outstanding_principal_inr'] ?? '0',
      totalOverdueInr: obj['total_overdue_inr'] ?? '0',
      dpd: obj['dpd'] ?? '0',
      loanStatus: obj['loan_status'] ?? 'ACTIVE',
      maturityDate: obj['maturity_date'] ?? '',
      closureDate: obj['closure_date'] ?? '',
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

async function migrateLoans(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    totalRows: 0,
    successCount: 0,
    skipCount: 0,
    errorCount: 0,
    scheduleGeneratedCount: 0,
    warnings: [],
    errors: [],
    durationMs: 0,
  };

  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const org = await prisma.organization.findFirst({ where: { code: options.orgCode } });
    if (!org) throw new Error(`Organization '${options.orgCode}' not found.`);
    console.log(`Target org: ${org.name} (${org.id})`);

    const rows = await parseLoanCsv(options.filePath);
    result.totalRows = rows.length;
    console.log(`Found ${rows.length} loan rows to process.`);

    if (options.dryRun) {
      console.log('[DRY RUN] No data will be written.');
    }

    // Process in batches
    for (let batchStart = 0; batchStart < rows.length; batchStart += options.batchSize) {
      const batch = rows.slice(batchStart, batchStart + options.batchSize);
      console.log(`Batch ${Math.floor(batchStart / options.batchSize) + 1}: rows ${batchStart + 2}–${batchStart + batch.length + 1}`);

      for (const row of batch) {
        // Validate
        const validationErrors = validateLoanRow(row);
        if (validationErrors.length > 0) {
          result.errorCount++;
          result.errors.push({
            line: row.lineNumber,
            loanNumber: row.loanNumber,
            error: validationErrors.join('; '),
          });
          continue;
        }

        try {
          // Resolve foreign keys
          const customer = await prisma.customer.findFirst({
            where: {
              organizationId: org.id,
              panNumber: row.customerPan.trim().toUpperCase(),
            },
          });
          if (!customer) {
            result.errorCount++;
            result.errors.push({
              line: row.lineNumber,
              loanNumber: row.loanNumber,
              error: `Customer with PAN ${row.customerPan} not found. Run migrate-customers first.`,
            });
            continue;
          }

          const product = await prisma.loanProduct.findFirst({
            where: { organizationId: org.id, code: row.productCode.trim().toUpperCase() },
          });
          if (!product) {
            result.errorCount++;
            result.errors.push({
              line: row.lineNumber,
              loanNumber: row.loanNumber,
              error: `Product with code ${row.productCode} not found.`,
            });
            continue;
          }

          const branch = await prisma.branch.findFirst({
            where: { organizationId: org.id, code: row.branchCode.trim().toUpperCase() },
          });
          if (!branch) {
            result.errorCount++;
            result.errors.push({
              line: row.lineNumber,
              loanNumber: row.loanNumber,
              error: `Branch with code ${row.branchCode} not found.`,
            });
            continue;
          }

          // Check duplicates
          if (options.skipDuplicates) {
            const existing = await prisma.loan.findFirst({
              where: { loanNumber: row.loanNumber.trim() },
            });
            if (existing) {
              console.log(`  SKIP: ${row.loanNumber} already exists`);
              result.skipCount++;
              continue;
            }
          }

          // Compute financial values
          const principalPaisa = Math.round(parseFloat(row.disbursedAmountInr) * 100);
          const annualRateBps = Math.round(parseFloat(row.interestRatePercent) * 100);
          const tenureMonths = parseInt(row.tenureMonths, 10);
          const disbursementDate = new Date(row.disbursementDate.trim());

          // Regenerate schedule if requested
          let computedEmi = Math.round(parseFloat(row.emiAmountInr) * 100);
          const recalculatedEmi = calculateEmi(principalPaisa, annualRateBps, tenureMonths);

          // Warn if EMI differs by more than Rs 10 (1000 paisa)
          if (Math.abs(computedEmi - recalculatedEmi) > 1000) {
            result.warnings.push({
              line: row.lineNumber,
              loanNumber: row.loanNumber,
              warning: `EMI mismatch: source=${computedEmi / 100}, calculated=${recalculatedEmi / 100} INR`,
            });
          }

          if (options.regenerateSchedule) {
            computedEmi = recalculatedEmi;
          }

          const dpd = parseInt(row.dpd, 10);
          const npaClassification = classifyNpa(dpd);

          // Calculate total interest from schedule
          const firstEmiDate = new Date(disbursementDate);
          firstEmiDate.setMonth(firstEmiDate.getMonth() + 1);

          const scheduleEntries = generateSchedule({
            principalPaisa,
            annualRateBps,
            tenureMonths,
            disbursementDate,
            firstEmiDate,
          });
          const totalInterestPaisa = scheduleEntries.reduce(
            (sum, e) => sum + e.interestPaisa, 0,
          );

          // Find or create application
          let appId: string;
          if (row.applicationNumber?.trim()) {
            let app = await prisma.loanApplication.findFirst({
              where: { applicationNumber: row.applicationNumber.trim() },
            });
            if (!app) {
              app = await (options.dryRun ? Promise.resolve(null as any) : prisma.loanApplication.create({
                data: {
                  organizationId: org.id,
                  branchId: branch.id,
                  applicationNumber: row.applicationNumber.trim(),
                  customerId: customer.id,
                  productId: product.id,
                  requestedAmountPaisa: principalPaisa,
                  requestedTenureMonths: tenureMonths,
                  status: 'DISBURSED',
                  sourceType: 'BRANCH',
                  sanctionedAmountPaisa: principalPaisa,
                  sanctionedTenureMonths: tenureMonths,
                  sanctionedInterestRateBps: annualRateBps,
                },
              }));
            }
            appId = app?.id ?? 'dry-run-placeholder';
          } else {
            appId = 'migrated-application';
          }

          if (!options.dryRun) {
            // Create loan
            const loan = await prisma.loan.create({
              data: {
                organizationId: org.id,
                branchId: branch.id,
                loanNumber: row.loanNumber.trim(),
                applicationId: appId,
                customerId: customer.id,
                productId: product.id,
                disbursedAmountPaisa: principalPaisa,
                disbursementDate,
                interestRateBps: annualRateBps,
                tenureMonths,
                emiAmountPaisa: computedEmi,
                totalInterestPaisa,
                outstandingPrincipalPaisa: Math.round(parseFloat(row.outstandingPrincipalInr) * 100),
                totalOverduePaisa: Math.round(parseFloat(row.totalOverdueInr) * 100),
                dpd,
                npaClassification,
                loanStatus: row.loanStatus.trim().toUpperCase() as any,
                maturityDate: new Date(row.maturityDate.trim()),
                closureDate: row.closureDate?.trim() ? new Date(row.closureDate.trim()) : null,
              },
            });

            // Create amortization schedule
            if (options.regenerateSchedule) {
              const scheduleData = scheduleEntries.map((e) => ({
                loanId: loan.id,
                installmentNumber: e.installmentNumber,
                dueDate: e.dueDate,
                emiAmountPaisa: e.emiAmountPaisa,
                principalComponentPaisa: e.principalPaisa,
                interestComponentPaisa: e.interestPaisa,
                openingBalancePaisa: e.openingBalancePaisa,
                closingBalancePaisa: e.closingBalancePaisa,
                status: 'PENDING' as const,
              }));

              await prisma.loanSchedule.createMany({ data: scheduleData });
              result.scheduleGeneratedCount++;
            }
          }

          result.successCount++;
          console.log(`  OK: ${row.loanNumber} — ${row.loanStatus} — ${row.disbursedAmountInr} INR`);
        } catch (err: unknown) {
          result.errorCount++;
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push({ line: row.lineNumber, loanNumber: row.loanNumber, error: message });
          console.error(`  ERROR: Line ${row.lineNumber} — ${row.loanNumber}: ${message}`);
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
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const filePath = get('--file');
  const orgCode = get('--org-code');

  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`ERROR: --file <path> is required and must exist. Got: ${filePath}`);
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
    batchSize: parseInt(get('--batch-size') ?? '50', 10),
    skipDuplicates: args.includes('--skip-duplicates'),
    regenerateSchedule: args.includes('--regenerate-schedule'),
  };
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('              BankOS Loan Migration Script');
  console.log('═══════════════════════════════════════════════════════════');

  const options = parseArgs();
  console.log(`File:                ${options.filePath}`);
  console.log(`Org Code:            ${options.orgCode}`);
  console.log(`Dry Run:             ${options.dryRun}`);
  console.log(`Batch Size:          ${options.batchSize}`);
  console.log(`Skip Duplicates:     ${options.skipDuplicates}`);
  console.log(`Regenerate Schedule: ${options.regenerateSchedule}`);
  console.log('───────────────────────────────────────────────────────────');

  const result = await migrateLoans(options);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   MIGRATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Rows:          ${result.totalRows}`);
  console.log(`Succeeded:           ${result.successCount}`);
  console.log(`Skipped:             ${result.skipCount}`);
  console.log(`Errors:              ${result.errorCount}`);
  console.log(`Schedules Generated: ${result.scheduleGeneratedCount}`);
  console.log(`Warnings:            ${result.warnings.length}`);
  console.log(`Duration:            ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.warnings.length > 0) {
    console.log('\nWarnings (EMI mismatches):');
    result.warnings.forEach((w) => {
      console.log(`  Line ${w.line} [${w.loanNumber}]: ${w.warning}`);
    });
  }

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e) => {
      console.log(`  Line ${e.line} [${e.loanNumber}]: ${e.error}`);
    });

    const logPath = `loan-migration-errors-${Date.now()}.json`;
    fs.writeFileSync(logPath, JSON.stringify({ errors: result.errors, warnings: result.warnings }, null, 2));
    console.log(`\nError log: ${logPath}`);
  }

  process.exit(result.errorCount > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
