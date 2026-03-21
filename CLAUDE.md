# BankOS Coding Conventions

## Financial Rules (CRITICAL - NEVER VIOLATE)
- ALL monetary amounts stored as INTEGER in PAISA (1 rupee = 100 paisa)
- Use decimal.js library for ALL financial calculations
- NEVER use JavaScript floating point for money (0.1 + 0.2 !== 0.3)
- Interest rates stored as basis points INTEGER (14% = 1400 bps)
- Convert to rupees/percentage ONLY in API response serialization
- Round EMI to nearest rupee (not paisa) for customer display
- All financial functions must have JSDoc with calculation formula

## Database Conventions
- Primary keys: UUID v4 (use @default(uuid()) in Prisma)
- Every table has: id, createdAt, updatedAt, createdBy, updatedBy
- Soft delete: deletedAt DateTime? (nullable, null = active)
- Multi-tenant: every table has organizationId (mandatory, indexed)
- Amounts: Int type (paisa), column name suffix: AmountPaisa
- Rates: Int type (basis points), column name suffix: RateBps
- Status fields: enum type with SCREAMING_SNAKE naming
- Indexes on: organizationId, status, createdAt (minimum)
- Foreign keys with onDelete: RESTRICT (never CASCADE for financial data)

## API Conventions
- Base path: /api/v1/{resource}
- Use kebab-case for URL paths: /loan-applications
- Use camelCase for JSON fields: sanctionedAmount
- Pagination: cursor-based { cursor, limit, hasMore }
- Filters as query params: ?status=ACTIVE&productId=xxx
- Dates in API: ISO 8601 format, UTC timezone
- Amounts in API response: convert from paisa to rupees (number with 2 decimals)
- Error format: { statusCode, message, errorCode, details? }
- Every mutation returns the full updated object
- Every list endpoint supports: sort, filter, pagination

## Naming Conventions
- Files: kebab-case (loan-application.service.ts)
- Classes: PascalCase (LoanApplicationService)
- Functions/methods: camelCase (calculateEmi)
- Database tables: snake_case (loan_applications)
- Enums: SCREAMING_SNAKE_CASE (APPLICATION_STATUS.SANCTIONED)
- Constants: SCREAMING_SNAKE_CASE (MAX_LOAN_TENURE_MONTHS)
- Test files: *.spec.ts (co-located with source)

## Indian Regulatory Specifics
- PAN: 5 upper alpha + 4 digits + 1 upper alpha (ABCDE1234F)
- Aadhaar: 12 digits (validate with Verhoeff algorithm)
- GSTIN: 2-digit state + PAN + 1 alphanum + Z + check digit
- IFSC: 4 alpha + 0 + 6 alphanumeric (11 chars total)
- Mobile: 10 digits starting with 6, 7, 8, or 9
- NPA: 90 days past due per RBI IRAC norms
- SMA-0: 1-30 DPD, SMA-1: 31-60 DPD, SMA-2: 61-90 DPD
- Provisioning: Standard 0.40%, Sub-standard 15%, Doubtful-1yr 25%, Doubtful-2yr 40%, Doubtful-3yr 100%, Loss 100%
- CRAR minimum: 15% for Middle Layer NBFCs

## Testing Rules
- Financial calculation tests: 100% pass, 0 tolerance for errors
- Compare EMI against Excel PPMT/IPMT functions
- Every API endpoint must have integration test
- Mock all external services (bureau, KYC, payment)
- Test data uses deterministic seed (reproducible)
- Minimum coverage: 95% financial, 80% overall

## Security Rules
- Never log PII (Aadhaar, PAN, bank account numbers)
- Mask Aadhaar in API responses: XXXX-XXXX-1234
- Mask PAN: XXXXX1234X
- Encrypt at rest: Aadhaar, PAN, bank account in database
- All API endpoints behind JWT auth (except /health)
- RBAC check on every mutation endpoint
- Audit log every financial transaction
