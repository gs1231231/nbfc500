# BankOS Data Migration Guide

This directory contains scripts to migrate legacy NBFC data into BankOS.

## Scripts

| Script | Purpose |
|--------|---------|
| `migrate-customers.ts` | Import customers from CSV |
| `migrate-loans.ts` | Import existing loans with amortization schedules |

---

## Prerequisites

1. BankOS database must be running and migrated:
   ```bash
   pnpm prisma:migrate
   pnpm prisma:seed          # seed org, branches, products, users
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set `DATABASE_URL` in your environment:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/bankos"
   ```

---

## Step 1: Migrate Customers

### CSV Format

Create `data/customers.csv` with these columns (first row = header):

```
customer_number,customer_type,first_name,middle_name,last_name,date_of_birth,gender,pan_number,aadhaar_number,email,phone,alternate_phone,employment_type,employer_name,monthly_income_inr,kyc_status,current_address1,current_address2,current_city,current_state,current_pincode,permanent_address1,permanent_address2,permanent_city,permanent_state,permanent_pincode
```

### Field Validations

| Field | Format | Example |
|-------|--------|---------|
| `customer_number` | Unique string | `CUST/2024/001` |
| `customer_type` | INDIVIDUAL \| PROPRIETORSHIP \| PARTNERSHIP \| PRIVATE_LIMITED \| PUBLIC_LIMITED \| LLP \| HUF \| TRUST | `INDIVIDUAL` |
| `date_of_birth` | YYYY-MM-DD | `1985-06-15` |
| `gender` | MALE \| FEMALE \| OTHER | `MALE` |
| `pan_number` | AAAAA9999A (10 chars, uppercase) | `ABCDE1234F` |
| `phone` | 10-digit, starts with 6-9 | `9876543210` |
| `employment_type` | SALARIED \| SELF_EMPLOYED_PROFESSIONAL \| SELF_EMPLOYED_BUSINESS \| RETIRED \| HOMEMAKER \| STUDENT \| UNEMPLOYED | `SALARIED` |
| `monthly_income_inr` | Decimal, INR | `75000.00` |
| `kyc_status` | PENDING \| IN_PROGRESS \| VERIFIED \| REJECTED \| EXPIRED | `VERIFIED` |

### Running the Migration

```bash
# Dry run first (no DB writes):
ts-node scripts/migration/migrate-customers.ts \
  --file data/customers.csv \
  --org-code GROWTH \
  --dry-run

# Execute:
ts-node scripts/migration/migrate-customers.ts \
  --file data/customers.csv \
  --org-code GROWTH \
  --skip-duplicates \
  --batch-size 100

# All options:
ts-node scripts/migration/migrate-customers.ts \
  --file data/customers.csv \
  --org-code GROWTH \
  --dry-run            # Validate only, do not write
  --skip-duplicates    # Skip rows where PAN already exists in DB
  --batch-size 100     # Process N rows at a time (default: 100)
```

---

## Step 2: Migrate Loans

### CSV Format

Create `data/loans.csv`:

```
loan_number,application_number,customer_pan,product_code,branch_code,disbursed_amount_inr,disbursement_date,interest_rate_percent,tenure_months,emi_amount_inr,outstanding_principal_inr,total_overdue_inr,dpd,loan_status,maturity_date,closure_date
```

### Field Validations

| Field | Format | Example |
|-------|--------|---------|
| `loan_number` | Unique string | `LOAN/2024/001` |
| `customer_pan` | Must exist from customer migration | `ABCDE1234F` |
| `product_code` | Must match a `LoanProduct.code` in DB | `PL` |
| `branch_code` | Must match a `Branch.code` in DB | `HO` |
| `disbursed_amount_inr` | Decimal, INR | `500000.00` |
| `disbursement_date` | YYYY-MM-DD | `2024-01-15` |
| `interest_rate_percent` | Decimal, annual | `14.00` |
| `tenure_months` | Integer, 1–360 | `36` |
| `emi_amount_inr` | Decimal, INR | `17090.50` |
| `outstanding_principal_inr` | Decimal, INR | `450000.00` |
| `total_overdue_inr` | Decimal, INR | `0.00` |
| `dpd` | Integer, ≥ 0 | `0` |
| `loan_status` | ACTIVE \| CLOSED \| WRITTEN_OFF \| RESTRUCTURED \| FORECLOSED \| SETTLED | `ACTIVE` |
| `maturity_date` | YYYY-MM-DD | `2027-01-15` |
| `closure_date` | YYYY-MM-DD or empty | `2024-12-31` |

### Running the Migration

```bash
# Dry run first:
ts-node scripts/migration/migrate-loans.ts \
  --file data/loans.csv \
  --org-code GROWTH \
  --dry-run \
  --regenerate-schedule

# Execute:
ts-node scripts/migration/migrate-loans.ts \
  --file data/loans.csv \
  --org-code GROWTH \
  --skip-duplicates \
  --regenerate-schedule \
  --batch-size 50
```

### `--regenerate-schedule` Flag

When this flag is set, the script:
1. Uses the BankOS `generateSchedule()` function to recompute the full amortization schedule
2. Creates `LoanSchedule` records in the database
3. Warns if the source EMI differs from the calculated EMI by more than Rs 10

This ensures mathematical correctness. If your source system used a different formula, review warnings carefully.

---

## Migration Order

Run in this order:

```
1. pnpm prisma:seed                              # Seed org/products/branches
2. migrate-customers  --dry-run                  # Validate customers
3. migrate-customers                             # Import customers
4. migrate-loans      --dry-run --regenerate-schedule  # Validate loans
5. migrate-loans      --regenerate-schedule      # Import loans with schedules
```

---

## Error Handling

- Each script writes a JSON error log file on partial failure
- Exit code 0 = full success
- Exit code 1 = fatal (no rows processed)
- Exit code 2 = partial failure (some rows errored)

---

## Rollback

If a migration needs to be rolled back:

```sql
-- Remove migrated customers (by pattern):
DELETE FROM customers WHERE customer_number LIKE 'OLD-SYSTEM/%';

-- Remove migrated loans (by pattern):
DELETE FROM loan_schedules WHERE loan_id IN (
  SELECT id FROM loans WHERE loan_number LIKE 'OLD-SYSTEM/%'
);
DELETE FROM loans WHERE loan_number LIKE 'OLD-SYSTEM/%';
```

---

## Performance Expectations

| Dataset Size | Customers | Loans + Schedules |
|-------------|-----------|-------------------|
| 1,000 records | ~30s | ~90s |
| 10,000 records | ~5min | ~15min |
| 100,000 records | ~45min | ~2.5hr |

For large datasets, consider:
- Increasing `--batch-size` to 500
- Running during off-peak hours
- Disabling DB logging (`LOG_LEVEL=error`)
