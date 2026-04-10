-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "loanId" TEXT,
    "complaintNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "slaDeadline" TIMESTAMP(3) NOT NULL,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_privacy_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "requestDetails" JSONB,
    "responseDetails" JSONB,
    "slaDeadline" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfi_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "centerName" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "groupLeaderId" TEXT,
    "meetingDay" TEXT,
    "meetingTime" TEXT,
    "formationDate" TIMESTAMP(3) NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfi_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfi_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "mfi_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "segmentCode" TEXT NOT NULL,
    "segmentName" TEXT NOT NULL,
    "description" TEXT,
    "segmentType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAutoAssign" BOOLEAN NOT NULL DEFAULT true,
    "rules" JSONB NOT NULL,
    "mappedSchemeIds" JSONB,
    "mappedProductIds" JSONB,
    "defaultLanguage" TEXT,
    "preferredChannel" TEXT,
    "communicationFrequency" TEXT,
    "maxOffersToShow" INTEGER NOT NULL DEFAULT 3,
    "offerPriority" TEXT NOT NULL DEFAULT 'BEST_RATE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment_members" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "score" DECIMAL(5,2),
    "metadata" JSONB,

    CONSTRAINT "customer_segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "complaints_complaintNumber_key" ON "complaints"("complaintNumber");

-- CreateIndex
CREATE INDEX "complaints_organizationId_idx" ON "complaints"("organizationId");

-- CreateIndex
CREATE INDEX "complaints_customerId_idx" ON "complaints"("customerId");

-- CreateIndex
CREATE INDEX "data_privacy_requests_organizationId_idx" ON "data_privacy_requests"("organizationId");

-- CreateIndex
CREATE INDEX "mfi_groups_organizationId_idx" ON "mfi_groups"("organizationId");

-- CreateIndex
CREATE INDEX "mfi_group_members_groupId_idx" ON "mfi_group_members"("groupId");

-- CreateIndex
CREATE INDEX "mfi_group_members_customerId_idx" ON "mfi_group_members"("customerId");

-- CreateIndex
CREATE INDEX "customer_segments_organizationId_isActive_idx" ON "customer_segments"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segments_organizationId_segmentCode_key" ON "customer_segments"("organizationId", "segmentCode");

-- CreateIndex
CREATE INDEX "customer_segment_members_customerId_idx" ON "customer_segment_members"("customerId");

-- CreateIndex
CREATE INDEX "customer_segment_members_segmentId_idx" ON "customer_segment_members"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segment_members_segmentId_customerId_key" ON "customer_segment_members"("segmentId", "customerId");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_privacy_requests" ADD CONSTRAINT "data_privacy_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfi_groups" ADD CONSTRAINT "mfi_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfi_group_members" ADD CONSTRAINT "mfi_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "mfi_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
