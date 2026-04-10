-- CreateTable
CREATE TABLE "lead_score_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "configName" TEXT NOT NULL,
    "productId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalMaxScore" INTEGER NOT NULL DEFAULT 100,
    "factors" JSONB NOT NULL,
    "grades" JSONB NOT NULL,
    "autoAssignGrades" JSONB,
    "autoNotifyGrades" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_score_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_scores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeLabel" TEXT NOT NULL,
    "factorScores" JSONB NOT NULL,
    "recommendedAction" TEXT,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousScore" INTEGER,
    "scoreChange" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_score_configs_organizationId_isActive_idx" ON "lead_score_configs"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "lead_score_configs_organizationId_configName_key" ON "lead_score_configs"("organizationId", "configName");

-- CreateIndex
CREATE INDEX "lead_scores_organizationId_idx" ON "lead_scores"("organizationId");

-- CreateIndex
CREATE INDEX "lead_scores_applicationId_idx" ON "lead_scores"("applicationId");

-- CreateIndex
CREATE INDEX "lead_scores_organizationId_grade_idx" ON "lead_scores"("organizationId", "grade");

-- CreateIndex
CREATE INDEX "lead_scores_organizationId_totalScore_idx" ON "lead_scores"("organizationId", "totalScore");

-- AddForeignKey
ALTER TABLE "lead_score_configs" ADD CONSTRAINT "lead_score_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_configId_fkey" FOREIGN KEY ("configId") REFERENCES "lead_score_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
