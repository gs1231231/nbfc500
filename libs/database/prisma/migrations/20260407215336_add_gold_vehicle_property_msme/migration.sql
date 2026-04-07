-- CreateTable
CREATE TABLE "fund_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sanctionedPaisa" BIGINT NOT NULL,
    "drawnPaisa" BIGINT NOT NULL DEFAULT 0,
    "outstandingPaisa" BIGINT NOT NULL DEFAULT 0,
    "costOfFundsBps" INTEGER NOT NULL,
    "drawdownDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "repaymentFrequency" TEXT,
    "covenants" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alm_buckets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "bucketName" TEXT NOT NULL,
    "inflowPaisa" BIGINT NOT NULL DEFAULT 0,
    "outflowPaisa" BIGINT NOT NULL DEFAULT 0,
    "gapPaisa" BIGINT NOT NULL DEFAULT 0,
    "cumulativeGapPaisa" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alm_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "policyNumber" TEXT,
    "premiumPaisa" INTEGER NOT NULL,
    "sumInsuredPaisa" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "renewalDueDate" TIMESTAMP(3),
    "nomineeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "itemNumber" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "description" TEXT,
    "grossWeightGrams" DECIMAL(10,3) NOT NULL,
    "netWeightGrams" DECIMAL(10,3) NOT NULL,
    "purityKarat" DECIMAL(4,1) NOT NULL,
    "purityPercentage" DECIMAL(6,3) NOT NULL,
    "hallmarkNumber" TEXT,
    "stoneWeightGrams" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "appraisedValuePaisa" INTEGER NOT NULL,
    "sealNumber" TEXT,
    "packetNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_CUSTODY',
    "custodyBranchId" TEXT,
    "custodyInDate" TIMESTAMP(3),
    "custodyOutDate" TIMESTAMP(3),
    "releaseApprovedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_rate_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "ratePer10GramsPaisa" INTEGER NOT NULL,
    "purity" TEXT NOT NULL DEFAULT '22K',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_details" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "vehicleType" TEXT NOT NULL,
    "isNewVehicle" BOOLEAN NOT NULL DEFAULT true,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "yearOfManufacture" INTEGER NOT NULL,
    "registrationNumber" TEXT,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "color" TEXT,
    "exShowroomPaisa" INTEGER,
    "onRoadPricePaisa" INTEGER,
    "insuranceValuePaisa" INTEGER,
    "dealerName" TEXT,
    "dealerCode" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "hypothecationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "hypothecationDate" TIMESTAMP(3),
    "rcVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_details" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "propertyType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "areaSquareFeet" DECIMAL(10,2),
    "marketValuePaisa" INTEGER,
    "forcedSaleValuePaisa" INTEGER,
    "registrationNumber" TEXT,
    "titleHolder" TEXT,
    "titleStatus" TEXT,
    "encumbranceFree" BOOLEAN NOT NULL DEFAULT false,
    "cersaiId" TEXT,
    "cersaiStatus" TEXT,
    "constructionStage" TEXT,
    "constructionProgress" INTEGER,
    "builderName" TEXT,
    "projectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "msme_details" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "loanId" TEXT,
    "gstin" TEXT,
    "udyamNumber" TEXT,
    "msmeCategory" TEXT,
    "businessType" TEXT,
    "businessVintageMonths" INTEGER,
    "annualTurnoverPaisa" BIGINT,
    "gstTurnoverPaisa" BIGINT,
    "bankingLimitPaisa" INTEGER,
    "drawingPowerPaisa" INTEGER,
    "stockStatementDate" TIMESTAMP(3),
    "stockValuePaisa" INTEGER,
    "debtorValuePaisa" INTEGER,
    "creditorValuePaisa" INTEGER,
    "currentRatioPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msme_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fund_sources_organizationId_idx" ON "fund_sources"("organizationId");

-- CreateIndex
CREATE INDEX "alm_buckets_organizationId_reportDate_idx" ON "alm_buckets"("organizationId", "reportDate");

-- CreateIndex
CREATE INDEX "insurance_policies_organizationId_idx" ON "insurance_policies"("organizationId");

-- CreateIndex
CREATE INDEX "insurance_policies_loanId_idx" ON "insurance_policies"("loanId");

-- CreateIndex
CREATE INDEX "gold_items_organizationId_idx" ON "gold_items"("organizationId");

-- CreateIndex
CREATE INDEX "gold_items_loanId_idx" ON "gold_items"("loanId");

-- CreateIndex
CREATE INDEX "gold_rate_history_organizationId_rateDate_idx" ON "gold_rate_history"("organizationId", "rateDate");

-- CreateIndex
CREATE INDEX "vehicle_details_organizationId_idx" ON "vehicle_details"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_details_loanId_idx" ON "vehicle_details"("loanId");

-- CreateIndex
CREATE INDEX "property_details_organizationId_idx" ON "property_details"("organizationId");

-- CreateIndex
CREATE INDEX "property_details_loanId_idx" ON "property_details"("loanId");

-- CreateIndex
CREATE INDEX "msme_details_organizationId_idx" ON "msme_details"("organizationId");

-- AddForeignKey
ALTER TABLE "fund_sources" ADD CONSTRAINT "fund_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alm_buckets" ADD CONSTRAINT "alm_buckets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_items" ADD CONSTRAINT "gold_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_rate_history" ADD CONSTRAINT "gold_rate_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_details" ADD CONSTRAINT "vehicle_details_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_details" ADD CONSTRAINT "property_details_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msme_details" ADD CONSTRAINT "msme_details_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
