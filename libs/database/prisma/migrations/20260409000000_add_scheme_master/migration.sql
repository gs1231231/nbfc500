-- CreateTable
CREATE TABLE "schemes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "schemeCode" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "description" TEXT,
    "schemeType" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minCibilScore" INTEGER,
    "maxCibilScore" INTEGER,
    "minAmountPaisa" INTEGER,
    "maxAmountPaisa" INTEGER,
    "minTenureMonths" INTEGER,
    "maxTenureMonths" INTEGER,
    "eligibleEmploymentTypes" JSONB,
    "eligibleCustomerTypes" JSONB,
    "minAgeDays" INTEGER,
    "maxAgeDays" INTEGER,
    "eligibleBranches" JSONB,
    "eligibleDsas" JSONB,
    "eligibilityCriteria" JSONB,
    "interestRateDiscountBps" INTEGER,
    "fixedInterestRateBps" INTEGER,
    "processingFeeDiscountPercent" DECIMAL(5,2),
    "processingFeeWaiver" BOOLEAN NOT NULL DEFAULT false,
    "stampDutyWaiver" BOOLEAN NOT NULL DEFAULT false,
    "insuranceDiscount" DECIMAL(5,2),
    "cashbackAmountPaisa" INTEGER,
    "cashbackCondition" TEXT,
    "topUpEligibleAfterMonths" INTEGER,
    "balanceTransferMaxDays" INTEGER,
    "additionalBenefits" JSONB,
    "maxDisbursementCount" INTEGER,
    "maxDisbursementAmountPaisa" BIGINT,
    "currentDisbursementCount" INTEGER NOT NULL DEFAULT 0,
    "currentDisbursementAmountPaisa" BIGINT NOT NULL DEFAULT 0,
    "maxPerBranchCount" INTEGER,
    "maxPerDsaCount" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalAuthority" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_applications" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "loanId" TEXT,
    "benefitsApplied" JSONB NOT NULL DEFAULT '{}',
    "cashbackStatus" TEXT,
    "cashbackPaidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schemes_organizationId_isActive_idx" ON "schemes"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "schemes_organizationId_validFrom_validTo_idx" ON "schemes"("organizationId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "schemes_organizationId_schemeCode_key" ON "schemes"("organizationId", "schemeCode");

-- CreateIndex
CREATE INDEX "scheme_applications_schemeId_idx" ON "scheme_applications"("schemeId");

-- CreateIndex
CREATE INDEX "scheme_applications_applicationId_idx" ON "scheme_applications"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_applications_schemeId_applicationId_key" ON "scheme_applications"("schemeId", "applicationId");

-- AddForeignKey
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
