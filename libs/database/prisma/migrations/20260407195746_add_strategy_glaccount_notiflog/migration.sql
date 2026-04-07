-- AlterTable
ALTER TABLE "collection_tasks" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "currentWorkflowStage" TEXT,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleInList" BOOLEAN NOT NULL DEFAULT false,
    "enumOptions" JSONB,
    "defaultValue" TEXT,
    "validationRule" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "sectionName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stages" JSONB NOT NULL,
    "transitions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_strategies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dpdFrom" INTEGER NOT NULL,
    "dpdTo" INTEGER NOT NULL,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "parentCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "channel" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_field_definitions_organizationId_entityType_idx" ON "custom_field_definitions"("organizationId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organizationId_entityType_fieldKey_key" ON "custom_field_definitions"("organizationId", "entityType", "fieldKey");

-- CreateIndex
CREATE INDEX "workflow_templates_organizationId_idx" ON "workflow_templates"("organizationId");

-- CreateIndex
CREATE INDEX "workflow_templates_organizationId_productId_idx" ON "workflow_templates"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "collection_strategies_organizationId_idx" ON "collection_strategies"("organizationId");

-- CreateIndex
CREATE INDEX "gl_accounts_organizationId_idx" ON "gl_accounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_organizationId_accountCode_key" ON "gl_accounts"("organizationId", "accountCode");

-- CreateIndex
CREATE INDEX "notification_logs_organizationId_idx" ON "notification_logs"("organizationId");

-- CreateIndex
CREATE INDEX "notification_logs_organizationId_customerId_idx" ON "notification_logs"("organizationId", "customerId");

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_strategies" ADD CONSTRAINT "collection_strategies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
