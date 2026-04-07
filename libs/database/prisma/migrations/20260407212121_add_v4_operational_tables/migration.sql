-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logo" TEXT,
    "letterhead" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "cin" TEXT,
    "registeredAddress" TEXT,
    "signatoryName" TEXT,
    "signatoryDesignation" TEXT,
    "smsSenderId" TEXT,
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 4,
    "defaultInterestCalcMethod" TEXT NOT NULL DEFAULT 'REDUCING_MONTHLY',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_fee_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "deductFromDisbursement" BOOLEAN NOT NULL DEFAULT false,
    "collectUpfront" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_rate_cards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "riskGrade" TEXT NOT NULL,
    "cibilMin" INTEGER,
    "cibilMax" INTEGER,
    "rateBps" INTEGER NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'FIXED',
    "benchmark" TEXT,
    "spreadBps" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interest_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressType" TEXT NOT NULL,
    "residenceType" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "residenceSince" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_employments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "designation" TEXT,
    "industry" TEXT,
    "joiningDate" TIMESTAMP(3),
    "grossIncomePaisa" INTEGER,
    "netIncomePaisa" INTEGER,
    "annualIncomePaisa" INTEGER,
    "incomeProofType" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_bank_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'SAVINGS',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "pennyDropVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "vendorName" TEXT,
    "report" JSONB,
    "photos" JSONB,
    "geoLocation" JSONB,
    "slaDeadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_appraisal_memos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "camNumber" TEXT NOT NULL,
    "customerProfile" JSONB NOT NULL DEFAULT '{}',
    "incomeAssessment" JSONB NOT NULL DEFAULT '{}',
    "bankingAnalysis" JSONB NOT NULL DEFAULT '{}',
    "bureauAnalysis" JSONB NOT NULL DEFAULT '{}',
    "obligationMapping" JSONB NOT NULL DEFAULT '{}',
    "collateralAssessment" JSONB NOT NULL DEFAULT '{}',
    "riskAssessment" JSONB NOT NULL DEFAULT '{}',
    "deviations" JSONB NOT NULL DEFAULT '[]',
    "camStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_appraisal_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanction_letters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sanctionLetterNumber" TEXT NOT NULL,
    "sanctionDate" TIMESTAMP(3) NOT NULL,
    "validUntilDate" TIMESTAMP(3) NOT NULL,
    "terms" JSONB NOT NULL DEFAULT '{}',
    "mitcContent" JSONB NOT NULL DEFAULT '{}',
    "kfsContent" JSONB NOT NULL DEFAULT '{}',
    "conditionsPrecedent" JSONB NOT NULL DEFAULT '[]',
    "conditionsSubsequent" JSONB NOT NULL DEFAULT '[]',
    "securityDetails" JSONB,
    "generatedPdfUrl" TEXT,
    "eSigned" BOOLEAN NOT NULL DEFAULT false,
    "eSignTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sanction_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursement_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "loanId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "disbursementType" TEXT NOT NULL DEFAULT 'FULL',
    "trancheNumber" INTEGER NOT NULL DEFAULT 1,
    "grossAmountPaisa" INTEGER NOT NULL,
    "deductions" JSONB NOT NULL DEFAULT '{}',
    "netAmountPaisa" INTEGER NOT NULL,
    "payeeType" TEXT NOT NULL DEFAULT 'BORROWER',
    "payeeAccountNumber" TEXT,
    "payeeIfsc" TEXT,
    "payeeName" TEXT,
    "utrNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nach_mandates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "mandateType" TEXT NOT NULL DEFAULT 'NACH',
    "umrn" TEXT,
    "maxAmountPaisa" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bankAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "consecutiveBouncesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nach_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounce_register" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "bounceType" TEXT NOT NULL,
    "bounceDate" TIMESTAMP(3) NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "returnReason" TEXT NOT NULL,
    "penalChargesPaisa" INTEGER NOT NULL DEFAULT 0,
    "gstPaisa" INTEGER NOT NULL DEFAULT 0,
    "waivedPaisa" INTEGER NOT NULL DEFAULT 0,
    "rePresentationDate" TIMESTAMP(3),
    "rePresentationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounce_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_charge_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "gstPaisa" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidPaisa" INTEGER NOT NULL DEFAULT 0,
    "waivedPaisa" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_charge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soa_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "transactionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debitPaisa" INTEGER NOT NULL DEFAULT 0,
    "creditPaisa" INTEGER NOT NULL DEFAULT 0,
    "principalBalancePaisa" INTEGER NOT NULL DEFAULT 0,
    "interestBalancePaisa" INTEGER NOT NULL DEFAULT 0,
    "chargesBalancePaisa" INTEGER NOT NULL DEFAULT 0,
    "totalBalancePaisa" INTEGER NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soa_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "sentToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_call_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "taskId" TEXT,
    "callerUserId" TEXT NOT NULL,
    "calledNumber" TEXT NOT NULL,
    "duration" INTEGER,
    "personSpokenTo" TEXT,
    "disposition" TEXT NOT NULL,
    "ptpDate" TIMESTAMP(3),
    "ptpAmountPaisa" INTEGER,
    "followUpDate" TIMESTAMP(3),
    "remarks" TEXT,
    "callRecordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_visit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "taskId" TEXT,
    "agentUserId" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkInLocation" JSONB NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "checkOutLocation" JSONB,
    "addressVisited" TEXT NOT NULL,
    "personMet" TEXT,
    "visitOutcome" TEXT NOT NULL,
    "amountCollectedPaisa" INTEGER NOT NULL DEFAULT 0,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "customerSignature" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_restructures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "restructureType" TEXT NOT NULL,
    "oldTerms" JSONB NOT NULL,
    "newTerms" JSONB NOT NULL,
    "moratoriumMonths" INTEGER,
    "interestCapitalizedPaisa" INTEGER,
    "previousScheduleSnapshot" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_restructures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_organizationId_key" ON "system_configs"("organizationId");

-- CreateIndex
CREATE INDEX "product_fee_configs_organizationId_productId_idx" ON "product_fee_configs"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "interest_rate_cards_organizationId_productId_idx" ON "interest_rate_cards"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");

-- CreateIndex
CREATE INDEX "customer_employments_customerId_idx" ON "customer_employments"("customerId");

-- CreateIndex
CREATE INDEX "customer_bank_accounts_customerId_idx" ON "customer_bank_accounts"("customerId");

-- CreateIndex
CREATE INDEX "verification_requests_organizationId_idx" ON "verification_requests"("organizationId");

-- CreateIndex
CREATE INDEX "verification_requests_applicationId_idx" ON "verification_requests"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_appraisal_memos_applicationId_key" ON "credit_appraisal_memos"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_appraisal_memos_camNumber_key" ON "credit_appraisal_memos"("camNumber");

-- CreateIndex
CREATE INDEX "credit_appraisal_memos_organizationId_idx" ON "credit_appraisal_memos"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sanction_letters_applicationId_key" ON "sanction_letters"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "sanction_letters_sanctionLetterNumber_key" ON "sanction_letters"("sanctionLetterNumber");

-- CreateIndex
CREATE INDEX "sanction_letters_organizationId_idx" ON "sanction_letters"("organizationId");

-- CreateIndex
CREATE INDEX "disbursement_requests_organizationId_idx" ON "disbursement_requests"("organizationId");

-- CreateIndex
CREATE INDEX "disbursement_requests_applicationId_idx" ON "disbursement_requests"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "nach_mandates_umrn_key" ON "nach_mandates"("umrn");

-- CreateIndex
CREATE INDEX "nach_mandates_organizationId_idx" ON "nach_mandates"("organizationId");

-- CreateIndex
CREATE INDEX "nach_mandates_loanId_idx" ON "nach_mandates"("loanId");

-- CreateIndex
CREATE INDEX "bounce_register_organizationId_idx" ON "bounce_register"("organizationId");

-- CreateIndex
CREATE INDEX "bounce_register_loanId_idx" ON "bounce_register"("loanId");

-- CreateIndex
CREATE INDEX "loan_charge_entries_organizationId_idx" ON "loan_charge_entries"("organizationId");

-- CreateIndex
CREATE INDEX "loan_charge_entries_loanId_idx" ON "loan_charge_entries"("loanId");

-- CreateIndex
CREATE INDEX "soa_entries_organizationId_idx" ON "soa_entries"("organizationId");

-- CreateIndex
CREATE INDEX "soa_entries_loanId_entryDate_idx" ON "soa_entries"("loanId", "entryDate");

-- CreateIndex
CREATE INDEX "document_templates_organizationId_idx" ON "document_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_organizationId_templateCode_key" ON "document_templates"("organizationId", "templateCode");

-- CreateIndex
CREATE INDEX "generated_documents_organizationId_idx" ON "generated_documents"("organizationId");

-- CreateIndex
CREATE INDEX "generated_documents_entityType_entityId_idx" ON "generated_documents"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "collection_call_logs_organizationId_idx" ON "collection_call_logs"("organizationId");

-- CreateIndex
CREATE INDEX "collection_call_logs_loanId_idx" ON "collection_call_logs"("loanId");

-- CreateIndex
CREATE INDEX "field_visit_logs_organizationId_idx" ON "field_visit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "field_visit_logs_loanId_idx" ON "field_visit_logs"("loanId");

-- CreateIndex
CREATE INDEX "loan_restructures_organizationId_idx" ON "loan_restructures"("organizationId");

-- CreateIndex
CREATE INDEX "loan_restructures_loanId_idx" ON "loan_restructures"("loanId");

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fee_configs" ADD CONSTRAINT "product_fee_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fee_configs" ADD CONSTRAINT "product_fee_configs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_rate_cards" ADD CONSTRAINT "interest_rate_cards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_rate_cards" ADD CONSTRAINT "interest_rate_cards_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_employments" ADD CONSTRAINT "customer_employments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_bank_accounts" ADD CONSTRAINT "customer_bank_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_appraisal_memos" ADD CONSTRAINT "credit_appraisal_memos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_appraisal_memos" ADD CONSTRAINT "credit_appraisal_memos_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanction_letters" ADD CONSTRAINT "sanction_letters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanction_letters" ADD CONSTRAINT "sanction_letters_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_requests" ADD CONSTRAINT "disbursement_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement_requests" ADD CONSTRAINT "disbursement_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nach_mandates" ADD CONSTRAINT "nach_mandates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nach_mandates" ADD CONSTRAINT "nach_mandates_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounce_register" ADD CONSTRAINT "bounce_register_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounce_register" ADD CONSTRAINT "bounce_register_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_charge_entries" ADD CONSTRAINT "loan_charge_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_charge_entries" ADD CONSTRAINT "loan_charge_entries_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_entries" ADD CONSTRAINT "soa_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_entries" ADD CONSTRAINT "soa_entries_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_call_logs" ADD CONSTRAINT "collection_call_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_call_logs" ADD CONSTRAINT "collection_call_logs_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visit_logs" ADD CONSTRAINT "field_visit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visit_logs" ADD CONSTRAINT "field_visit_logs_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
