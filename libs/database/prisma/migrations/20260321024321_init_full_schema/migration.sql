-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('NBFC_ICC', 'NBFC_MFI', 'HFC', 'NBFC_FACTOR');

-- CreateEnum
CREATE TYPE "BranchType" AS ENUM ('HEAD_OFFICE', 'BRANCH', 'HUB');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'HUF', 'TRUST');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED_PROFESSIONAL', 'SELF_EMPLOYED_BUSINESS', 'RETIRED', 'HOMEMAKER', 'STUDENT', 'UNEMPLOYED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PERSONAL_LOAN', 'BUSINESS_LOAN', 'VEHICLE_FINANCE', 'LAP', 'HOME_LOAN', 'GOLD_LOAN', 'EDUCATION_LOAN', 'MSME_LOAN', 'SUPPLY_CHAIN_FINANCE', 'MICROFINANCE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('LEAD', 'APPLICATION', 'DOCUMENT_COLLECTION', 'BUREAU_CHECK', 'UNDERWRITING', 'APPROVED', 'SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('DSA', 'BRANCH', 'WEB', 'MOBILE_APP', 'API', 'WALKIN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'WRITTEN_OFF', 'RESTRUCTURED', 'FORECLOSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "NpaClassification" AS ENUM ('STANDARD', 'SMA_0', 'SMA_1', 'SMA_2', 'NPA_SUBSTANDARD', 'NPA_DOUBTFUL_1', 'NPA_DOUBTFUL_2', 'NPA_DOUBTFUL_3', 'NPA_LOSS');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NACH', 'UPI', 'NEFT', 'RTGS', 'CASH', 'CHEQUE', 'ONLINE', 'DEMAND_DRAFT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'REVERSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "BureauType" AS ENUM ('CIBIL', 'EXPERIAN', 'CRIF', 'EQUIFAX');

-- CreateEnum
CREATE TYPE "BureauPullType" AS ENUM ('SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "BureauRequestStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "BreRuleCategory" AS ENUM ('ELIGIBILITY', 'POLICY', 'SCORECARD', 'PRICING', 'DEVIATION');

-- CreateEnum
CREATE TYPE "BreRuleAction" AS ENUM ('APPROVE', 'REJECT', 'REFER');

-- CreateEnum
CREATE TYPE "BreFinalDecision" AS ENUM ('APPROVED', 'REJECTED', 'REFERRED');

-- CreateEnum
CREATE TYPE "CollectionTaskType" AS ENUM ('SMS', 'WHATSAPP', 'IVR', 'TELECALL', 'FIELD_VISIT', 'LEGAL_NOTICE', 'AGENCY_ALLOCATION');

-- CreateEnum
CREATE TYPE "CollectionDisposition" AS ENUM ('PAID', 'PTP', 'NOT_AVAILABLE', 'REFUSED', 'SHIFTED', 'CALLBACK', 'WRONG_NUMBER', 'DECEASED', 'NO_DISPOSITION');

-- CreateEnum
CREATE TYPE "CollectionTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DsaType" AS ENUM ('INDIVIDUAL', 'AGENCY', 'CORPORATE', 'DIGITAL_PARTNER');

-- CreateEnum
CREATE TYPE "CoLendingStatus" AS ENUM ('ALLOCATED', 'DISBURSED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'SALARY_SLIP', 'BANK_STATEMENT', 'ITR', 'PHOTO', 'SIGNATURE', 'PROPERTY_DOC', 'VEHICLE_RC', 'GOLD_ASSESSMENT', 'SANCTION_LETTER', 'LOAN_AGREEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "rbiRegistrationNumber" TEXT NOT NULL,
    "cinNumber" TEXT NOT NULL,
    "gstNumber" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchType" "BranchType" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "employeeCode" TEXT NOT NULL,
    "designation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerNumber" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "panNumber" TEXT NOT NULL,
    "aadhaarNumber" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "currentAddressLine1" TEXT,
    "currentAddressLine2" TEXT,
    "currentCity" TEXT,
    "currentState" TEXT,
    "currentPincode" TEXT,
    "permanentAddressLine1" TEXT,
    "permanentAddressLine2" TEXT,
    "permanentCity" TEXT,
    "permanentState" TEXT,
    "permanentPincode" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "employerName" TEXT,
    "monthlyIncomePaisa" INTEGER,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "riskCategory" "RiskCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "minAmountPaisa" INTEGER NOT NULL,
    "maxAmountPaisa" INTEGER NOT NULL,
    "minTenureMonths" INTEGER NOT NULL,
    "maxTenureMonths" INTEGER NOT NULL,
    "minInterestRateBps" INTEGER NOT NULL,
    "maxInterestRateBps" INTEGER NOT NULL,
    "processingFeePercent" DECIMAL(5,2) NOT NULL,
    "isSecured" BOOLEAN NOT NULL DEFAULT false,
    "collateralTypes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedAmountPaisa" INTEGER NOT NULL,
    "requestedTenureMonths" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'LEAD',
    "sourceType" "SourceType" NOT NULL DEFAULT 'BRANCH',
    "dsaId" TEXT,
    "assignedToId" TEXT,
    "sanctionedAmountPaisa" INTEGER,
    "sanctionedTenureMonths" INTEGER,
    "sanctionedInterestRateBps" INTEGER,
    "rejectionReason" TEXT,
    "breDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "disbursedAmountPaisa" INTEGER NOT NULL,
    "disbursementDate" TIMESTAMP(3) NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "emiAmountPaisa" INTEGER NOT NULL,
    "totalInterestPaisa" INTEGER NOT NULL,
    "outstandingPrincipalPaisa" INTEGER NOT NULL,
    "outstandingInterestPaisa" INTEGER NOT NULL DEFAULT 0,
    "totalOverduePaisa" INTEGER NOT NULL DEFAULT 0,
    "dpd" INTEGER NOT NULL DEFAULT 0,
    "npaClassification" "NpaClassification" NOT NULL DEFAULT 'STANDARD',
    "npaDate" TIMESTAMP(3),
    "loanStatus" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "closureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedules" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "emiAmountPaisa" INTEGER NOT NULL,
    "principalComponentPaisa" INTEGER NOT NULL,
    "interestComponentPaisa" INTEGER NOT NULL,
    "openingBalancePaisa" INTEGER NOT NULL,
    "closingBalancePaisa" INTEGER NOT NULL,
    "paidAmountPaisa" INTEGER NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "paidPrincipalPaisa" INTEGER NOT NULL DEFAULT 0,
    "paidInterestPaisa" INTEGER NOT NULL DEFAULT 0,
    "penalInterestPaisa" INTEGER NOT NULL DEFAULT 0,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "allocatedToPrincipalPaisa" INTEGER NOT NULL DEFAULT 0,
    "allocatedToInterestPaisa" INTEGER NOT NULL DEFAULT 0,
    "allocatedToPenalPaisa" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bureau_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bureauType" "BureauType" NOT NULL,
    "pullType" "BureauPullType" NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "status" "BureauRequestStatus" NOT NULL DEFAULT 'INITIATED',
    "costPaisa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bureau_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bureau_responses" (
    "id" TEXT NOT NULL,
    "bureauRequestId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "score" INTEGER,
    "totalActiveLoans" INTEGER,
    "totalEmiObligationPaisa" INTEGER,
    "maxDpdLast12Months" INTEGER,
    "maxDpdLast24Months" INTEGER,
    "enquiriesLast3Months" INTEGER,
    "enquiriesLast6Months" INTEGER,
    "hasWriteOff" BOOLEAN NOT NULL DEFAULT false,
    "hasSettlement" BOOLEAN NOT NULL DEFAULT false,
    "oldestLoanAgeMonths" INTEGER,
    "tradelines" JSONB NOT NULL DEFAULT '[]',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bureau_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bre_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "BreRuleCategory" NOT NULL,
    "priority" INTEGER NOT NULL,
    "condition" JSONB NOT NULL,
    "action" "BreRuleAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "bre_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bre_decisions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "finalDecision" "BreFinalDecision" NOT NULL,
    "approvedInterestRateBps" INTEGER,
    "ruleResults" JSONB NOT NULL DEFAULT '[]',
    "evaluationContext" JSONB NOT NULL DEFAULT '{}',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overriddenBy" TEXT,
    "overrideReason" TEXT,

    CONSTRAINT "bre_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "dpdAtCreation" INTEGER NOT NULL,
    "taskType" "CollectionTaskType" NOT NULL,
    "assignedToId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "disposition" "CollectionDisposition",
    "ptpDate" TIMESTAMP(3),
    "ptpAmountPaisa" INTEGER,
    "remarks" TEXT,
    "status" "CollectionTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsas" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "panNumber" TEXT NOT NULL,
    "gstNumber" TEXT,
    "dsaCode" TEXT NOT NULL,
    "dsaType" "DsaType" NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "products" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "empanelmentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dsas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_lending_partners" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "apiEndpoint" TEXT,
    "defaultBankSharePercent" INTEGER NOT NULL,
    "defaultNbfcSharePercent" INTEGER NOT NULL,
    "bankInterestRateBps" INTEGER NOT NULL,
    "nbfcInterestRateBps" INTEGER NOT NULL,
    "maxExposurePaisa" BIGINT NOT NULL,
    "currentExposurePaisa" BIGINT NOT NULL DEFAULT 0,
    "dlgCapPercent" INTEGER NOT NULL DEFAULT 5,
    "dlgUtilizedPaisa" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "co_lending_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_lending_allocations" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "bankSharePaisa" BIGINT NOT NULL,
    "nbfcSharePaisa" BIGINT NOT NULL,
    "blendedInterestRateBps" INTEGER NOT NULL,
    "escrowAccountNumber" TEXT,
    "status" "CoLendingStatus" NOT NULL DEFAULT 'ALLOCATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "co_lending_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debitAmountPaisa" INTEGER NOT NULL DEFAULT 0,
    "creditAmountPaisa" INTEGER NOT NULL DEFAULT 0,
    "narration" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "customerId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_code_idx" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "branches_organizationId_idx" ON "branches"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organizationId_code_key" ON "branches"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_organizationId_email_key" ON "users"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_organizationId_phone_key" ON "users"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerNumber_key" ON "customers"("customerNumber");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_organizationId_phone_idx" ON "customers"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "customers_organizationId_panNumber_idx" ON "customers"("organizationId", "panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE INDEX "loan_products_organizationId_idx" ON "loan_products"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_applicationNumber_key" ON "loan_applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "loan_applications_organizationId_idx" ON "loan_applications"("organizationId");

-- CreateIndex
CREATE INDEX "loan_applications_organizationId_status_idx" ON "loan_applications"("organizationId", "status");

-- CreateIndex
CREATE INDEX "loan_applications_organizationId_customerId_idx" ON "loan_applications"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "loan_applications_applicationNumber_idx" ON "loan_applications"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loanNumber_key" ON "loans"("loanNumber");

-- CreateIndex
CREATE INDEX "loans_organizationId_idx" ON "loans"("organizationId");

-- CreateIndex
CREATE INDEX "loans_organizationId_loanStatus_idx" ON "loans"("organizationId", "loanStatus");

-- CreateIndex
CREATE INDEX "loans_organizationId_customerId_idx" ON "loans"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "loans_loanNumber_idx" ON "loans"("loanNumber");

-- CreateIndex
CREATE INDEX "loan_schedules_loanId_idx" ON "loan_schedules"("loanId");

-- CreateIndex
CREATE INDEX "loan_schedules_dueDate_idx" ON "loan_schedules"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "loan_schedules_loanId_installmentNumber_key" ON "loan_schedules"("loanId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "payments_loanId_idx" ON "payments"("loanId");

-- CreateIndex
CREATE INDEX "bureau_requests_organizationId_idx" ON "bureau_requests"("organizationId");

-- CreateIndex
CREATE INDEX "bureau_requests_applicationId_idx" ON "bureau_requests"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "bureau_responses_bureauRequestId_key" ON "bureau_responses"("bureauRequestId");

-- CreateIndex
CREATE INDEX "bureau_responses_applicationId_idx" ON "bureau_responses"("applicationId");

-- CreateIndex
CREATE INDEX "bre_rules_organizationId_idx" ON "bre_rules"("organizationId");

-- CreateIndex
CREATE INDEX "bre_rules_organizationId_productId_isActive_idx" ON "bre_rules"("organizationId", "productId", "isActive");

-- CreateIndex
CREATE INDEX "bre_decisions_applicationId_idx" ON "bre_decisions"("applicationId");

-- CreateIndex
CREATE INDEX "bre_decisions_organizationId_idx" ON "bre_decisions"("organizationId");

-- CreateIndex
CREATE INDEX "collection_tasks_organizationId_idx" ON "collection_tasks"("organizationId");

-- CreateIndex
CREATE INDEX "collection_tasks_loanId_idx" ON "collection_tasks"("loanId");

-- CreateIndex
CREATE INDEX "collection_tasks_organizationId_status_idx" ON "collection_tasks"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dsas_dsaCode_key" ON "dsas"("dsaCode");

-- CreateIndex
CREATE INDEX "dsas_organizationId_idx" ON "dsas"("organizationId");

-- CreateIndex
CREATE INDEX "co_lending_partners_organizationId_idx" ON "co_lending_partners"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "co_lending_allocations_loanId_key" ON "co_lending_allocations"("loanId");

-- CreateIndex
CREATE INDEX "co_lending_allocations_partnerId_idx" ON "co_lending_allocations"("partnerId");

-- CreateIndex
CREATE INDEX "gl_entries_organizationId_idx" ON "gl_entries"("organizationId");

-- CreateIndex
CREATE INDEX "gl_entries_organizationId_accountCode_idx" ON "gl_entries"("organizationId", "accountCode");

-- CreateIndex
CREATE INDEX "gl_entries_referenceType_referenceId_idx" ON "gl_entries"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

-- CreateIndex
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");

-- CreateIndex
CREATE INDEX "documents_applicationId_idx" ON "documents"("applicationId");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_dsaId_fkey" FOREIGN KEY ("dsaId") REFERENCES "dsas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_breDecisionId_fkey" FOREIGN KEY ("breDecisionId") REFERENCES "bre_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_requests" ADD CONSTRAINT "bureau_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_requests" ADD CONSTRAINT "bureau_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_requests" ADD CONSTRAINT "bureau_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_responses" ADD CONSTRAINT "bureau_responses_bureauRequestId_fkey" FOREIGN KEY ("bureauRequestId") REFERENCES "bureau_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bre_rules" ADD CONSTRAINT "bre_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bre_rules" ADD CONSTRAINT "bre_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bre_decisions" ADD CONSTRAINT "bre_decisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsas" ADD CONSTRAINT "dsas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_lending_partners" ADD CONSTRAINT "co_lending_partners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_lending_allocations" ADD CONSTRAINT "co_lending_allocations_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_lending_allocations" ADD CONSTRAINT "co_lending_allocations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "co_lending_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
