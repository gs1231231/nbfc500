-- CreateTable: fee_templates
CREATE TABLE "fee_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "feeCode" TEXT NOT NULL,
    "feeCategory" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productIds" JSONB,
    "minAmountPaisa" INTEGER,
    "maxAmountPaisa" INTEGER,
    "minRateBps" INTEGER,
    "maxRateBps" INTEGER,
    "minTenureMonths" INTEGER,
    "maxTenureMonths" INTEGER,
    "customerTypes" JSONB,
    "employmentTypes" JSONB,
    "sourceTypes" JSONB,
    "schemeIds" JSONB,
    "loanStatuses" JSONB,
    "triggerEvent" TEXT,
    "calculationType" TEXT NOT NULL,
    "flatAmountPaisa" INTEGER,
    "percentageValue" DECIMAL(8,4),
    "percentageBase" TEXT,
    "minCapPaisa" INTEGER,
    "maxCapPaisa" INTEGER,
    "slabs" JSONB,
    "perUnitAmountPaisa" INTEGER,
    "unitType" TEXT,
    "formula" TEXT,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "cessPercent" DECIMAL(5,2),
    "collectAt" TEXT NOT NULL DEFAULT 'DISBURSAL',
    "deductFromDisbursement" BOOLEAN NOT NULL DEFAULT false,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "refundCondition" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "showInSanctionLetter" BOOLEAN NOT NULL DEFAULT true,
    "showInKFS" BOOLEAN NOT NULL DEFAULT true,
    "isNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPercent" DECIMAL(5,2),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: applied_fees
CREATE TABLE "applied_fees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feeTemplateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "feeCode" TEXT NOT NULL,
    "feeName" TEXT NOT NULL,
    "baseAmountPaisa" INTEGER NOT NULL,
    "gstAmountPaisa" INTEGER NOT NULL DEFAULT 0,
    "cessAmountPaisa" INTEGER NOT NULL DEFAULT 0,
    "totalAmountPaisa" INTEGER NOT NULL,
    "discountPaisa" INTEGER NOT NULL DEFAULT 0,
    "waivedPaisa" INTEGER NOT NULL DEFAULT 0,
    "netPayablePaisa" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "collectedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waivedReason" TEXT,
    "deductedFromDisbursement" BOOLEAN NOT NULL DEFAULT false,
    "calculationDetails" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applied_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_templates_organizationId_isActive_idx" ON "fee_templates"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "fee_templates_organizationId_feeCode_idx" ON "fee_templates"("organizationId", "feeCode");

-- CreateIndex
CREATE INDEX "applied_fees_organizationId_idx" ON "applied_fees"("organizationId");

-- CreateIndex
CREATE INDEX "applied_fees_applicationId_idx" ON "applied_fees"("applicationId");

-- CreateIndex
CREATE INDEX "applied_fees_loanId_idx" ON "applied_fees"("loanId");

-- AddForeignKey
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_feeTemplateId_fkey" FOREIGN KEY ("feeTemplateId") REFERENCES "fee_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_fees" ADD CONSTRAINT "applied_fees_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
