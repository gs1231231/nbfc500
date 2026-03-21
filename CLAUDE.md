# CLAUDE.md — BankOS: Complete NBFC Lending Platform
# Pass this ENTIRE file to Claude Code. It contains everything needed to build the system.
# Command: "Read this file and build BankOS step by step. Start with project setup, then database, then each module in order."

---

# PROJECT OVERVIEW

BankOS is a cloud-native lending operating system for Indian NBFCs with 500 Cr+ AUM.
It covers the full credit lifecycle: Lead → Application → Bureau → Underwriting → Sanction → Disbursal → Servicing → Collections → Recovery.

Tech Stack:
- Backend: NestJS 10+ monorepo, TypeScript strict
- Database: PostgreSQL 16 + Prisma ORM
- Cache: Redis 7
- Queue: BullMQ (upgrade to Kafka later)
- Mobile: React Native (Expo)
- Web: Next.js 14 App Router + Tailwind + shadcn/ui
- Auth: JWT + RBAC + Keycloak (or custom)
- Storage: S3 / MinIO
- Testing: Jest + Supertest + Cypress + k6
- CI/CD: GitHub Actions + Docker
- Package Manager: pnpm

---

# CODING CONVENTIONS (FOLLOW STRICTLY)

## Financial Rules — NEVER VIOLATE
- ALL monetary amounts: INTEGER in PAISA (1 rupee = 100 paisa). Column suffix: AmountPaisa
- ALL interest rates: INTEGER in BASIS POINTS (14% = 1400). Column suffix: RateBps
- Use decimal.js for ALL financial math. NEVER native JS float for money.
- Convert to rupees/percentage ONLY in API response serializers
- Round EMI to nearest rupee for display. Internal = paisa precision.
- Every financial function: JSDoc with formula + unit test

## Database
- Primary keys: UUID v4 (@default(uuid()))
- Every table: id, createdAt, updatedAt, createdBy (UUID), updatedBy (UUID)
- Soft delete: deletedAt DateTime? (null = active)
- Multi-tenant: organizationId on EVERY table (indexed, mandatory)
- Foreign keys: onDelete RESTRICT (NEVER cascade financial data)
- Enums: SCREAMING_SNAKE (APPLICATION_STATUS, LOAN_STATUS, NPA_CLASSIFICATION)
- Indexes minimum: organizationId, status, createdAt

## API
- Path: /api/v1/{kebab-case-resource}
- JSON fields: camelCase
- Pagination: cursor-based { cursor, limit, hasMore, data[] }
- Amounts in response: convert paisa→rupees (2 decimals)
- Rates in response: convert bps→percentage (2 decimals)
- Error: { statusCode, message, errorCode, details? }
- Every mutation returns full updated object
- Swagger/OpenAPI decorators on every endpoint

## Naming
- Files: kebab-case.ts | Classes: PascalCase | Functions: camelCase
- DB tables: snake_case plural | Enums: SCREAMING_SNAKE
- Test files: *.spec.ts co-located with source

## Indian Specifics
- PAN: ABCDE1234F (5 alpha + 4 digit + 1 alpha)
- Aadhaar: 12 digits, Verhoeff checksum validation
- Phone: 10 digits starting with 6/7/8/9
- IFSC: 4 alpha + 0 + 6 alphanumeric
- GSTIN: 2 digit state + PAN + 1 alphanum + Z + check
- Pincode: 6 digits, first digit 1-9
- NPA: 90 DPD per RBI IRAC. SMA-0: 1-30, SMA-1: 31-60, SMA-2: 61-90
- Provision: Standard 0.40%, Sub-standard 15%, Doubtful-1 25%, Doubtful-2 40%, Doubtful-3 100%, Loss 100%
- CRAR minimum: 15% for Middle Layer NBFCs

## Security
- Encrypt at rest: Aadhaar, PAN, bank account numbers (use AES-256 or pgcrypto)
- Mask in API: PAN → XXXXX1234X, Aadhaar → XXXX-XXXX-1234
- Never log PII
- All endpoints behind JWT auth except /health
- RBAC on every mutation
- Audit log every financial transaction (who, when, what, before/after)

## Testing
- Financial calculations: 95% coverage, ZERO tolerance for errors
- All other code: 80% coverage minimum
- Mock all external APIs (bureau, KYC, payment)
- Deterministic seed for reproducibility
- Compare EMI output against Excel PMT() function

---

# PROJECT STRUCTURE

```
bankos/
├── apps/
│   ├── api-gateway/           # NestJS — auth, routing, rate limiting
│   ├── los-service/           # Loan Origination System
│   ├── lms-service/           # Loan Management / Servicing
│   ├── bre-service/           # Business Rule Engine
│   ├── collection-service/    # Collections + field agent
│   ├── bureau-service/        # CIBIL/Experian/CRIF integration
│   ├── payment-service/       # NACH, UPI, NEFT disbursement
│   ├── notification-service/  # SMS, Email, WhatsApp
│   ├── colending-service/     # Co-lending with banks
│   ├── compliance-service/    # Regulatory reporting, CIC submission
│   ├── web-portal/            # Next.js admin dashboard
│   ├── mobile-app/            # React Native borrower app (Expo)
│   └── agent-app/             # React Native field agent app
├── libs/
│   ├── common/                # Shared DTOs, enums, interfaces, constants
│   ├── database/              # Prisma schema, migrations, seed
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts
│   │       └── migrations/
│   ├── auth/                  # JWT strategy, RBAC guards, decorators
│   ├── financial/             # EMI calculator, NPA classifier, validators
│   └── events/                # Event names, payloads, BullMQ setup
├── infra/
│   ├── docker-compose.yml     # PostgreSQL, Redis, MinIO
│   ├── Dockerfile             # Multi-stage build
│   └── k8s/                   # Kubernetes manifests (later)
├── docs/
│   └── api/                   # Generated OpenAPI specs
├── .github/
│   └── workflows/ci.yml       # Lint + test + build pipeline
├── CLAUDE.md                  # THIS FILE
├── .env.example
├── .eslintrc.js
├── .prettierrc
└── package.json
```

---

# DATABASE SCHEMA (PRISMA)

## Enums

```prisma
enum LicenseType { NBFC_ICC NBFC_MFI HFC NBFC_FACTOR }
enum BranchType { HEAD_OFFICE BRANCH HUB SATELLITE }
enum Gender { MALE FEMALE OTHER }
enum CustomerType { INDIVIDUAL PROPRIETORSHIP PARTNERSHIP PRIVATE_LIMITED PUBLIC_LIMITED LLP HUF TRUST }
enum EmploymentType { SALARIED SELF_EMPLOYED_PROFESSIONAL SELF_EMPLOYED_BUSINESS RETIRED HOMEMAKER STUDENT UNEMPLOYED }
enum KycStatus { PENDING IN_PROGRESS VERIFIED REJECTED EXPIRED }
enum RiskCategory { LOW MEDIUM HIGH VERY_HIGH }

enum ProductType { PERSONAL_LOAN BUSINESS_LOAN VEHICLE_FINANCE LAP HOME_LOAN GOLD_LOAN EDUCATION_LOAN MSME_LOAN SUPPLY_CHAIN_FINANCE MICROFINANCE }
enum ApplicationStatus { LEAD APPLICATION DOCUMENT_COLLECTION BUREAU_CHECK UNDERWRITING APPROVED SANCTIONED DISBURSEMENT_PENDING DISBURSED REJECTED CANCELLED EXPIRED }
enum SourceType { DSA BRANCH WEB MOBILE_APP API WALKIN }
enum LoanStatus { ACTIVE CLOSED WRITTEN_OFF RESTRUCTURED FORECLOSED SETTLED }
enum NpaClassification { STANDARD SMA_0 SMA_1 SMA_2 NPA_SUBSTANDARD NPA_DOUBTFUL_1 NPA_DOUBTFUL_2 NPA_DOUBTFUL_3 NPA_LOSS }
enum ScheduleStatus { PENDING PAID PARTIALLY_PAID OVERDUE }
enum PaymentMode { NACH UPI NEFT RTGS CASH CHEQUE ONLINE DEMAND_DRAFT }
enum PaymentStatus { SUCCESS FAILED PENDING REVERSED }

enum BureauType { CIBIL EXPERIAN CRIF EQUIFAX }
enum PullType { SOFT HARD }
enum BureauRequestStatus { INITIATED SUCCESS FAILED TIMEOUT }

enum BreRuleCategory { ELIGIBILITY POLICY SCORECARD PRICING DEVIATION }
enum BreRuleAction { APPROVE REJECT REFER }
enum BreDecisionResult { APPROVED REJECTED REFERRED }

enum CollectionTaskType { SMS WHATSAPP IVR TELECALL FIELD_VISIT LEGAL_NOTICE AGENCY_ALLOCATION }
enum Disposition { PAID PTP NOT_AVAILABLE REFUSED SHIFTED CALLBACK WRONG_NUMBER DECEASED NO_DISPOSITION }
enum TaskStatus { PENDING IN_PROGRESS COMPLETED OVERDUE CANCELLED }

enum DsaType { INDIVIDUAL AGENCY CORPORATE DIGITAL_PARTNER }
enum CoLendingStatus { ALLOCATED DISBURSED ACTIVE CLOSED }

enum DocumentType { AADHAAR_FRONT AADHAAR_BACK PAN_CARD SALARY_SLIP_1 SALARY_SLIP_2 SALARY_SLIP_3 BANK_STATEMENT ITR_ACKNOWLEDGEMENT PHOTO SIGNATURE PROPERTY_DOC VEHICLE_RC GOLD_ASSESSMENT SANCTION_LETTER LOAN_AGREEMENT NOC OTHER }
enum AuditAction { CREATE UPDATE DELETE LOGIN TRANSITION APPROVE REJECT OVERRIDE }
```

## Models (22 tables)

1. **Organization** — id UUID, name, code (unique), licenseType, rbiRegistrationNumber, cinNumber, gstNumber?, address, city, state, pincode, isActive, settings Json, timestamps
2. **Branch** — id, organizationId FK, name, code, branchType, address, city, state, pincode, lat?, lng?, managerId FK?, isActive, timestamps
3. **User** — id, organizationId FK, branchId FK?, email (unique), phone, firstName, lastName, passwordHash, mfaEnabled, employeeCode, designation, isActive, lastLoginAt, timestamps
4. **Role** — id, organizationId FK, name, code (unique), permissions Json, isSystemRole
5. **UserRole** — userId FK, roleId FK, branchId? (composite unique)
6. **AuditLog** — id, organizationId FK, userId FK, action AuditAction, entityType, entityId, changes Json, ipAddress, userAgent, createdAt
7. **Customer** — id, organizationId FK, customerNumber (unique), customerType, firstName, middleName?, lastName, fullName, dob, gender, panNumber (encrypted), aadhaarNumber? (encrypted), email?, phone, alternatePhone?, address fields, employmentType, employerName?, monthlyIncomePaisa?, kycStatus, riskCategory?, timestamps, deletedAt?
8. **LoanProduct** — id, organizationId FK, name, code (unique), productType, minAmountPaisa, maxAmountPaisa, minTenureMonths, maxTenureMonths, minInterestRateBps, maxInterestRateBps, processingFeePercent Decimal, isSecured, collateralTypes Json?, isActive, settings Json
9. **DSA** — id, organizationId FK, name, contactPerson, phone, email, panNumber, gstNumber?, dsaCode (unique), dsaType, commissionPercent Decimal, products Json, isActive, empanelmentDate, timestamps
10. **LoanApplication** — id, organizationId FK, branchId FK, applicationNumber (unique), customerId FK, productId FK, requestedAmountPaisa, requestedTenureMonths, status ApplicationStatus, sourceType, dsaId FK?, assignedToId FK?, sanctionedAmountPaisa?, sanctionedTenureMonths?, sanctionedInterestRateBps?, rejectionReason?, breDecisionId FK?, timestamps, deletedAt?
11. **ApplicationStatusHistory** — id, applicationId FK, fromStatus, toStatus, changedBy FK, remarks?, createdAt
12. **Document** — id, organizationId FK, applicationId FK?, customerId FK, documentType, fileName, mimeType, s3Key, fileSizeBytes, isVerified, verifiedBy?, verifiedAt?, timestamps, deletedAt?
13. **BureauRequest** — id, organizationId FK, applicationId FK, customerId FK, bureauType, pullType, requestPayload Json, responsePayload Json?, status BureauRequestStatus, costPaisa?, createdAt
14. **BureauResponse** — id, bureauRequestId FK, applicationId FK, score?, totalActiveLoans?, totalEmiObligationPaisa?, maxDpdLast12Months?, maxDpdLast24Months?, enquiriesLast3Months?, enquiriesLast6Months?, hasWriteOff, hasSettlement, oldestLoanAgeMonths?, tradelines Json, validUntil DateTime
15. **BreRule** — id, organizationId FK, productId FK, name, description, category BreRuleCategory, priority Int, condition Json, action BreRuleAction, reason, isActive, effectiveFrom, effectiveTo?, version, createdBy, updatedBy
16. **BreDecision** — id, organizationId FK, applicationId FK, finalDecision BreDecisionResult, approvedInterestRateBps?, ruleResults Json, evaluationContext Json, decidedAt, overriddenBy?, overrideReason?
17. **Loan** — id, organizationId FK, branchId FK, loanNumber (unique), applicationId FK, customerId FK, productId FK, disbursedAmountPaisa, disbursementDate, interestRateBps, tenureMonths, emiAmountPaisa, totalInterestPaisa, outstandingPrincipalPaisa, outstandingInterestPaisa, totalOverduePaisa, dpd default 0, npaClassification default STANDARD, npaDate?, loanStatus default ACTIVE, maturityDate, closureDate?, timestamps
18. **LoanSchedule** — id, loanId FK, installmentNumber, dueDate, emiAmountPaisa, principalComponentPaisa, interestComponentPaisa, openingBalancePaisa, closingBalancePaisa, paidAmountPaisa default 0, paidDate?, paidPrincipalPaisa default 0, paidInterestPaisa default 0, penalInterestPaisa default 0, status ScheduleStatus default PENDING (unique: loanId + installmentNumber)
19. **Payment** — id, organizationId FK, loanId FK, paymentNumber (unique), amountPaisa, paymentDate, paymentMode, referenceNumber?, status PaymentStatus, allocatedToPrincipalPaisa default 0, allocatedToInterestPaisa default 0, allocatedToPenalPaisa default 0, timestamps
20. **CollectionTask** — id, organizationId FK, loanId FK, dpdAtCreation, taskType CollectionTaskType, assignedToId?, scheduledDate, completedDate?, disposition?, ptpDate?, ptpAmountPaisa?, remarks?, status TaskStatus, timestamps
21. **CoLendingPartner** — id, organizationId FK, bankName, bankCode, apiEndpoint?, defaultBankSharePercent, defaultNbfcSharePercent, bankInterestRateBps, nbfcInterestRateBps, maxExposurePaisa BigInt, currentExposurePaisa BigInt default 0, dlgCapPercent default 5, dlgUtilizedPaisa BigInt default 0, isActive
22. **CoLendingAllocation** — id, loanId FK, partnerId FK, bankSharePaisa BigInt, nbfcSharePaisa BigInt, blendedInterestRateBps, escrowAccountNumber?, status CoLendingStatus
23. **GlEntry** — id, organizationId FK, branchId FK, entryDate, valueDate, accountCode, accountName, debitAmountPaisa default 0, creditAmountPaisa default 0, narration, referenceType, referenceId UUID, isReversed default false, timestamps

---

# FINANCIAL FORMULAS (IMPLEMENT IN libs/financial/)

## EMI (Reducing Balance)
```
r = annualRateBps / 12 / 10000    // monthly rate as decimal
EMI = P × r × (1+r)^n / ((1+r)^n - 1)
Where: P = principal in paisa, n = tenure in months
If r = 0: EMI = P / n
Round to nearest paisa. Adjust last installment to eliminate rounding error.
```

## Schedule Generation
```
For each installment i (1 to n):
  interestComponent = openingBalance × r
  principalComponent = EMI - interestComponent
  closingBalance = openingBalance - principalComponent
  
Broken period: if disbursement→firstEMI ≠ exactly 1 month
  brokenDays = daysBetween(disbursementDate, firstEmiDate)
  brokenInterest = principal × annualRate / 365 × brokenDays
  
CRITICAL: sum(principalComponent) MUST equal principal exactly.
Adjust last installment's principal to absorb rounding difference.
```

## FOIR (Fixed Obligation to Income Ratio)
```
FOIR = (existingEMI + proposedEMI) / monthlyIncome × 100
```

## DPD (Days Past Due)
```
If not paid: DPD = daysBetween(dueDate, today)
If paid late: DPD = daysBetween(dueDate, paymentDate)
If paid on/before due: DPD = 0
```

## NPA Classification (per RBI IRAC)
```
DPD 0: STANDARD | DPD 1-30: SMA_0 | DPD 31-60: SMA_1 | DPD 61-90: SMA_2
DPD 91+: NPA_SUBSTANDARD | 12m as NPA: DOUBTFUL_1 | 24m: DOUBTFUL_2 | 36m: DOUBTFUL_3
```

## Provisioning
```
STANDARD: 0.40% of outstanding
NPA_SUBSTANDARD: 15% | DOUBTFUL_1: 25% | DOUBTFUL_2: 40% | DOUBTFUL_3: 100% | LOSS: 100%
```

## Co-Lending Blended Rate
```
blendedRate = (bankRate × bankSharePercent + nbfcRate × nbfcSharePercent) / 100
Each RE must retain minimum 10% (MRR per RBI CLA 2025)
DLG cap: 5% of co-lending portfolio
```

---

# API ENDPOINTS (COMPLETE LIST)

## Auth (api-gateway)
- POST /api/v1/auth/login → { accessToken, refreshToken, user }
- POST /api/v1/auth/refresh → { accessToken, refreshToken }
- POST /api/v1/auth/logout

## Customers (los-service)
- POST /api/v1/customers
- GET /api/v1/customers (search, filter, paginate)
- GET /api/v1/customers/:id
- PATCH /api/v1/customers/:id
- POST /api/v1/customers/dedupe → { isDuplicate, existingId?, matchedOn }
- GET /api/v1/customers/:id/360 → full relationship view

## Loan Applications (los-service)
- POST /api/v1/applications
- GET /api/v1/applications (filter by status, product, branch, DSA, date, amount)
- GET /api/v1/applications/:id (include customer, bureau, BRE, docs)
- PATCH /api/v1/applications/:id
- DELETE /api/v1/applications/:id (soft)
- POST /api/v1/applications/:id/transition → { toStatus, remarks }
- POST /api/v1/applications/:id/documents (multipart upload)
- GET /api/v1/applications/:id/documents
- POST /api/v1/applications/:id/documents/:docId/verify
- GET /api/v1/applications/:id/document-checklist
- POST /api/v1/applications/:id/sanction
- POST /api/v1/applications/:id/disburse

## Bureau (bureau-service)
- POST /api/v1/bureau/pull → { applicationId, bureauPreference[] }
- GET /api/v1/bureau/report/:applicationId

## BRE (bre-service)
- POST /api/v1/bre/evaluate → { applicationId } returns decision + rule results
- POST /api/v1/bre/simulate → { productId, testContext } returns decision without saving
- POST /api/v1/bre/rules
- GET /api/v1/bre/rules?productId=X
- PUT /api/v1/bre/rules/:id
- DELETE /api/v1/bre/rules/:id

## Loans (lms-service)
- GET /api/v1/loans (filter, paginate)
- GET /api/v1/loans/:id (include schedule summary)
- GET /api/v1/loans/:id/schedule
- GET /api/v1/loans/:id/statement (SOA)
- POST /api/v1/loans/:id/payments
- GET /api/v1/loans/:id/payments
- POST /api/v1/loans/:id/prepay → calculate prepayment amount
- POST /api/v1/loans/:id/foreclose
- POST /api/v1/loans/:id/restructure
- GET /api/v1/loans/:id/certificates/interest → interest certificate PDF
- GET /api/v1/loans/:id/certificates/noc → NOC PDF

## Collections (collection-service)
- GET /api/v1/collections/tasks (filter: status, assignedTo, date)
- POST /api/v1/collections/tasks/:id/disposition
- GET /api/v1/collections/dashboard
- POST /api/v1/collections/send-payment-link → { loanId, channel }

## Co-Lending (colending-service)
- POST /api/v1/colending/partners
- GET /api/v1/colending/partners
- PUT /api/v1/colending/partners/:id
- POST /api/v1/colending/allocate → { applicationId }
- POST /api/v1/colending/disburse/:allocationId
- GET /api/v1/colending/portfolio

## CIC Submission (compliance-service)
- POST /api/v1/cic/generate-submission → { bureauType, month, year }
- GET /api/v1/cic/submissions
- GET /api/v1/cic/submissions/:id/download
- POST /api/v1/cic/process-rejection
- GET /api/v1/cic/data-quality

## Notifications (notification-service)
- POST /api/v1/notifications/send → { customerId, channel, templateCode, variables }
- GET /api/v1/notifications?customerId=X

## Dashboard (api-gateway aggregation)
- GET /api/v1/dashboard/stats → today's applications, sanctioned, disbursed, pending
- GET /api/v1/dashboard/pipeline → applications by status with counts
- GET /api/v1/dashboard/npa-summary → classification-wise breakdown
- GET /api/v1/dashboard/collection-efficiency → CE% trend

---

# BRE DEFAULT RULES (SEED FOR PERSONAL LOAN)

```json
[
  { "category": "ELIGIBILITY", "priority": 1, "condition": { "field": "customer.age", "operator": "BETWEEN", "value": 21, "value2": 58 }, "action": "REJECT", "reason": "Age must be between 21 and 58 years" },
  { "category": "ELIGIBILITY", "priority": 2, "condition": { "field": "customer.kycStatus", "operator": "EQ", "value": "VERIFIED" }, "action": "REJECT", "reason": "KYC must be verified" },
  { "category": "POLICY", "priority": 10, "condition": { "field": "bureau.score", "operator": "GTE", "value": 650 }, "action": "REJECT", "reason": "CIBIL score must be 650 or above" },
  { "category": "POLICY", "priority": 11, "condition": { "field": "calculated.foir", "operator": "LTE", "value": 60 }, "action": "REJECT", "reason": "FOIR must not exceed 60%" },
  { "category": "POLICY", "priority": 12, "condition": { "field": "bureau.hasWriteOff", "operator": "EQ", "value": false }, "action": "REJECT", "reason": "No write-offs allowed in credit history" },
  { "category": "POLICY", "priority": 13, "condition": { "field": "bureau.maxDpdLast12Months", "operator": "LTE", "value": 30 }, "action": "REJECT", "reason": "Max DPD in last 12 months must not exceed 30 days" },
  { "category": "POLICY", "priority": 14, "condition": { "field": "bureau.enquiriesLast3Months", "operator": "LTE", "value": 5 }, "action": "REJECT", "reason": "Max 5 bureau enquiries in last 3 months" },
  { "category": "DEVIATION", "priority": 20, "condition": { "field": "bureau.score", "operator": "BETWEEN", "value": 620, "value2": 649 }, "action": "REFER", "reason": "CIBIL 620-649: requires Credit Head approval" },
  { "category": "PRICING", "priority": 30, "condition": { "field": "bureau.score", "operator": "GTE", "value": 750 }, "action": "APPROVE", "reason": "Grade A: 14% interest rate", "metadata": { "interestRateBps": 1400 } },
  { "category": "PRICING", "priority": 31, "condition": { "field": "bureau.score", "operator": "BETWEEN", "value": 700, "value2": 749 }, "action": "APPROVE", "reason": "Grade B: 16% interest rate", "metadata": { "interestRateBps": 1600 } },
  { "category": "PRICING", "priority": 32, "condition": { "field": "bureau.score", "operator": "BETWEEN", "value": 650, "value2": 699 }, "action": "APPROVE", "reason": "Grade C: 18% interest rate", "metadata": { "interestRateBps": 1800 } }
]
```

---

# COLLECTION STRATEGIES (SEED DATA)

```
Strategy A — DPD 1-30 (Soft):
Day 1: SMS payment reminder with UPI link
Day 3: WhatsApp message with payment link
Day 7: IVR auto-call reminder
Day 10: Telecall by internal agent
Day 15: WhatsApp firm reminder
Day 20: Second telecall
Day 25: Field visit assignment

Strategy B — DPD 31-60 (Medium):
Day 1: Telecall + demand letter email
Day 5: Field visit
Day 10: Telecall with escalation
Day 15: Legal notice warning via WhatsApp
Day 25: Field visit
Day 30: Legal notice generation

Strategy C — DPD 61-90 (Hard):
Day 1: Legal notice dispatch
Day 7: Senior agent telecall
Day 15: Field visit
Day 25: Agency allocation or SARFAESI initiation
```

---

# MOCK BUREAU ADAPTER LOGIC

For development/testing, mock bureau returns deterministic data based on PAN:
```
PAN first char A-E: score 720-850, 0-1 active loans, no write-off, low EMI
PAN first char F-J: score 650-720, 1-3 active loans, no write-off, moderate EMI
PAN first char K-O: score 500-650, 2-4 active loans, possible settlement, higher EMI
PAN first char P-T: score 300-500, 3-5 active loans, write-off present, high EMI
PAN first char U-Z: score -1 (no bureau history), 0 loans
Same PAN always returns exactly the same response (use PAN as seed for random generator).
```

---

# DAILY BATCH JOBS

1. **Interest Accrual** (10:00 PM IST daily)
   For each ACTIVE loan: dailyInterest = outstandingPrincipalPaisa × annualRateBps / 10000 / 365
   Post GL entry: Dr Accrued Interest, Cr Interest Income. Update loan.outstandingInterestPaisa.

2. **NPA Classification** (11:00 PM IST daily)
   For each ACTIVE loan: find oldest unpaid installment, calculate DPD, classify per IRAC norms.
   If classification changed: update loan, recalculate provision, post GL, emit event.

3. **Collection Allocation** (8:00 AM IST daily)
   For each overdue loan: match strategy by DPD bucket, determine today's action, create task, assign to agent.

4. **PTP Follow-up** (9:00 AM IST daily)
   For each PTP where ptpDate = today: check if payment received. If not, mark PTP BROKEN, escalate.

5. **CIC Submission** (7th of each month, or weekly from July 2026)
   Extract all active + recently closed loans, build TUEF format file, validate, upload to CIC.

6. **Co-Lending Settlement** (6:00 PM IST daily)
   For each co-lent loan with today's payment: split per partner share, record settlement entries.

All jobs: must be idempotent (safe to re-run), log progress, handle failures gracefully (skip failed record, continue), emit completion event.

---

# GL ACCOUNT CODES (CHART OF ACCOUNTS)

```
1000 - Loan Assets (Dr on disbursal, Cr on repayment)
1100 - Accrued Interest Receivable
1200 - Processing Fee Receivable
2000 - Bank Account (Dr on collection, Cr on disbursal)
3000 - Interest Income (Cr on accrual/collection)
3100 - Processing Fee Income
3200 - Penal Interest Income
4000 - Provision for NPAs (Dr on provision increase, Cr on reversal)
5000 - Write-off Account
6000 - Co-Lending - Bank Partner Payable
6100 - Co-Lending - Escrow Account
```

Every financial transaction creates balanced GL entries: total debit = total credit. ALWAYS.

---

# BUILD ORDER (FOLLOW THIS SEQUENCE)

Phase 0 — Foundation:
1. Scaffold NestJS monorepo + docker-compose
2. Create Prisma schema (all 22 models above)
3. Run migrations + create seed data
4. Build auth module (JWT + RBAC + org guard + audit)
5. Build financial calculator library (EMI, schedule, NPA, provision, validators)
6. Write 40+ financial tests. DO NOT PROCEED until all pass.

Phase 1 — LOS Core:
7. Customer CRUD with dedupe + 360 view
8. Application CRUD with status transitions
9. Document upload/management
10. Bureau service (mock adapter + caching)
11. BRE rule engine (evaluate + simulate + CRUD)
12. Sanction + Disbursement (creates Loan + EMI schedule + GL entries)
13. E2E test: full origination flow (approve, reject, refer paths)

Phase 2 — LMS + Collections:
14. Payment processing (apply to schedule, update DPD, GL entries)
15. NPA classification daily job
16. Interest accrual daily job
17. Collection strategy engine + task allocation job
18. Collection disposition + PTP tracking

Phase 3 — Compliance + Co-Lending:
19. CIC/CIBIL monthly submission generator
20. Co-lending: partner CRUD + allocation + blended rate + settlement + NPA mirror
21. Regulatory reporting (NPA report, provision report, CRAR)

Phase 4 — Frontend:
22. Next.js admin dashboard (pipeline, detail, 360, BRE, collections, reports)
23. React Native borrower app (dashboard, loan detail, pay EMI)
24. React Native agent app (tasks, GPS visit, disposition)

Phase 5 — Integrations:
25. Real CIBIL/bureau adapter
26. Aadhaar eKYC + PAN verification
27. NACH mandate + NEFT disbursement
28. SMS + WhatsApp + Email notifications
29. eSign integration

Phase 6 — Advanced:
30. Repossession + yard + auction
31. Legal recovery (SARFAESI/DRT/OTS)
32. ECL computation (IndAS 109)
33. Portfolio analytics dashboards

Phase 7 — Production:
34. Kubernetes deployment
35. CI/CD pipeline
36. Monitoring + alerting
37. Security hardening
38. Load testing
39. DR drill
40. Go-live checklist

---

# CRITICAL TEST SCENARIOS (MUST PASS BEFORE PRODUCTION)

1. EMI for 10L at 14% for 36m matches Excel PMT() = Rs 34,178
2. EMI schedule: sum of all principal components = disbursed amount (ZERO variance)
3. EMI schedule: first installment interest > last (confirms reducing balance)
4. Broken period interest for mid-month disbursement calculated correctly
5. Payment allocation: oldest unpaid installment paid first
6. Partial payment: correct split between principal and interest
7. Overpayment: excess rolls to next installment
8. NPA: DPD 89 = SMA_2, DPD 90 = SMA_2, DPD 91 = NPA_SUBSTANDARD
9. NPA upgrade: all overdue cleared → back to STANDARD
10. Provision: correct percentage applied per classification
11. BRE: score 750+ → APPROVED at 1400 bps
12. BRE: score 600 → REJECTED with clear reason
13. BRE: score 635 → REFERRED to credit head
14. Bureau cache: second pull within 30 days returns cached response
15. GL balancing: total debits = total credits across all entries
16. Co-lending blended rate calculation matches manual formula
17. Co-lending settlement: split proportional to partner share
18. Co-lending NPA mirror: triggers when loan classified NPA
19. CIBIL TUEF file: valid fixed-width format, correct record count
20. RBAC: credit officer cannot approve above their sanctioned limit
21. Concurrent payments on same loan: no double-posting
22. Daily interest accrual matches manual: 10L × 14% / 365 = Rs 383.56/day
23. Prepayment amount: correct outstanding + accrued interest + penalty
24. Application dedupe: same customer + product within 30 days blocked
25. PAN/Aadhaar encrypted in database, masked in API responses

---

# END OF SPECIFICATION
# Pass this entire file to Claude Code and say:
# "Build BankOS following this specification. Start with Phase 0 Step 1."
