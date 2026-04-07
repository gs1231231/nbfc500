import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Domain interfaces ─────────────────────────────────────────────────────────

export interface WorkflowStage {
  code: string;
  name: string;
  displayOrder: number;
  slaDays?: number;
  requiredFields?: string[];
  requiredDocuments?: string[];
  autoActions?: {
    type: 'NOTIFY' | 'BUREAU_PULL' | 'BRE_EVALUATE' | 'ASSIGN';
    config: Record<string, unknown>;
  }[];
  assignmentRule?: 'ROUND_ROBIN' | 'SPECIFIC_USER' | 'MANUAL' | 'KEEP_CURRENT';
  assignToRole?: string;
  canEdit?: boolean;
  isTerminal?: boolean;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  requiredRole?: string;
  requiresRemarks?: boolean;
  conditions?: {
    type:
      | 'DOCUMENTS_COMPLETE'
      | 'BUREAU_COMPLETED'
      | 'BRE_COMPLETED'
      | 'CUSTOM_FIELD_FILLED'
      | 'ALL_CONDITIONS_MET';
    config?: Record<string, unknown>;
  }[];
  amountLimit?: number;
}

export interface WorkflowTemplate {
  id: string;
  organizationId: string;
  name: string;
  productId: string | null;
  isDefault: boolean;
  isActive: boolean;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface AvailableTransition {
  toStage: string;
  toStageName: string;
  requiresRemarks: boolean;
}

export interface SlaBreachRecord {
  applicationId: string;
  applicationNumber: string;
  currentStage: string;
  slaDays: number;
  daysElapsed: number;
  daysBreached: number;
}

// ── Default workflow seeds ────────────────────────────────────────────────────

export const STANDARD_LENDING_STAGES: WorkflowStage[] = [
  { code: 'LEAD', name: 'Lead', displayOrder: 1, slaDays: 2, canEdit: true },
  { code: 'APPLICATION', name: 'Application', displayOrder: 2, slaDays: 3, canEdit: true, requiredFields: ['requestedAmountPaisa', 'requestedTenureMonths'] },
  { code: 'DOCUMENT_COLLECTION', name: 'Document Collection', displayOrder: 3, slaDays: 5, canEdit: true, requiredDocuments: ['PAN_CARD', 'AADHAAR_FRONT', 'BANK_STATEMENT'] },
  { code: 'BUREAU_CHECK', name: 'Bureau Check', displayOrder: 4, slaDays: 2, autoActions: [{ type: 'BUREAU_PULL', config: { bureauType: 'CIBIL', pullType: 'HARD' } }] },
  { code: 'UNDERWRITING', name: 'Underwriting', displayOrder: 5, slaDays: 7, autoActions: [{ type: 'BRE_EVALUATE', config: {} }], assignmentRule: 'ROUND_ROBIN', assignToRole: 'CREDIT_ANALYST' },
  { code: 'APPROVED', name: 'Approved', displayOrder: 6, isTerminal: false, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_APPROVED' } }] },
  { code: 'REJECTED', name: 'Rejected', displayOrder: 7, isTerminal: true, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_REJECTED' } }] },
  { code: 'SANCTIONED', name: 'Sanctioned', displayOrder: 8, slaDays: 3 },
  { code: 'DISBURSEMENT_PENDING', name: 'Disbursement Pending', displayOrder: 9, slaDays: 2 },
  { code: 'DISBURSED', name: 'Disbursed', displayOrder: 10, isTerminal: true, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_DISBURSED' } }] },
];

export const STANDARD_LENDING_TRANSITIONS: WorkflowTransition[] = [
  { from: 'LEAD', to: 'APPLICATION' },
  { from: 'APPLICATION', to: 'DOCUMENT_COLLECTION' },
  { from: 'DOCUMENT_COLLECTION', to: 'BUREAU_CHECK', conditions: [{ type: 'DOCUMENTS_COMPLETE' }] },
  { from: 'BUREAU_CHECK', to: 'UNDERWRITING', conditions: [{ type: 'BUREAU_COMPLETED' }] },
  { from: 'UNDERWRITING', to: 'APPROVED', requiredRole: 'CREDIT_HEAD', conditions: [{ type: 'BRE_COMPLETED' }] },
  { from: 'UNDERWRITING', to: 'REJECTED', requiredRole: 'CREDIT_HEAD', requiresRemarks: true, conditions: [{ type: 'BRE_COMPLETED' }] },
  { from: 'APPROVED', to: 'SANCTIONED', requiredRole: 'CREDIT_HEAD' },
  { from: 'SANCTIONED', to: 'DISBURSEMENT_PENDING', requiredRole: 'OPERATIONS' },
  { from: 'DISBURSEMENT_PENDING', to: 'DISBURSED', requiredRole: 'OPERATIONS' },
];

export const GOLD_LOAN_STAGES: WorkflowStage[] = [
  { code: 'LEAD', name: 'Lead', displayOrder: 1, slaDays: 1, canEdit: true },
  { code: 'KYC_CHECK', name: 'KYC Check', displayOrder: 2, slaDays: 1, requiredDocuments: ['PAN_CARD', 'AADHAAR_FRONT'] },
  { code: 'GOLD_ASSESSMENT', name: 'Gold Assessment', displayOrder: 3, slaDays: 1, requiredFields: ['collateralValue'], autoActions: [{ type: 'NOTIFY', config: { template: 'GOLD_ASSESSMENT_SCHEDULED' } }] },
  { code: 'APPROVED', name: 'Approved', displayOrder: 4, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_APPROVED' } }] },
  { code: 'REJECTED', name: 'Rejected', displayOrder: 5, isTerminal: true, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_REJECTED' } }] },
  { code: 'DISBURSED', name: 'Disbursed', displayOrder: 6, isTerminal: true, autoActions: [{ type: 'NOTIFY', config: { template: 'LOAN_DISBURSED' } }] },
];

export const GOLD_LOAN_TRANSITIONS: WorkflowTransition[] = [
  { from: 'LEAD', to: 'KYC_CHECK' },
  { from: 'KYC_CHECK', to: 'GOLD_ASSESSMENT', conditions: [{ type: 'DOCUMENTS_COMPLETE' }] },
  { from: 'GOLD_ASSESSMENT', to: 'APPROVED', requiredRole: 'BRANCH_MANAGER' },
  { from: 'GOLD_ASSESSMENT', to: 'REJECTED', requiredRole: 'BRANCH_MANAGER', requiresRemarks: true },
  { from: 'APPROVED', to: 'DISBURSED', requiredRole: 'OPERATIONS' },
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Template CRUD ───────────────────────────────────────────────────────────

  async listWorkflows(organizationId: string): Promise<WorkflowTemplate[]> {
    const records = await this.prisma.workflowTemplate.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return records.map(this.mapRecord);
  }

  async createWorkflow(
    organizationId: string,
    data: {
      name: string;
      productId?: string;
      isDefault?: boolean;
      stages: WorkflowStage[];
      transitions: WorkflowTransition[];
      createdBy?: string;
    },
  ): Promise<WorkflowTemplate> {
    // If marking as default for this product, unset previous default
    if (data.isDefault) {
      await this.prisma.workflowTemplate.updateMany({
        where: { organizationId, productId: data.productId ?? null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const record = await this.prisma.workflowTemplate.create({
      data: {
        organizationId,
        name: data.name,
        productId: data.productId ?? null,
        isDefault: data.isDefault ?? false,
        isActive: true,
        stages: data.stages as unknown as import('@prisma/client').Prisma.JsonArray,
        transitions: data.transitions as unknown as import('@prisma/client').Prisma.JsonArray,
        createdBy: data.createdBy ?? null,
        updatedBy: data.createdBy ?? null,
      },
    });
    return this.mapRecord(record);
  }

  async updateWorkflow(
    organizationId: string,
    id: string,
    data: {
      name?: string;
      isDefault?: boolean;
      isActive?: boolean;
      stages?: WorkflowStage[];
      transitions?: WorkflowTransition[];
      updatedBy?: string;
    },
  ): Promise<WorkflowTemplate> {
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException(`Workflow template ${id} not found`);
    }

    if (data.isDefault) {
      await this.prisma.workflowTemplate.updateMany({
        where: { organizationId, productId: existing.productId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const record = await this.prisma.workflowTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.stages !== undefined && { stages: data.stages as unknown as import('@prisma/client').Prisma.JsonArray }),
        ...(data.transitions !== undefined && { transitions: data.transitions as unknown as import('@prisma/client').Prisma.JsonArray }),
        updatedBy: data.updatedBy ?? null,
      },
    });
    return this.mapRecord(record);
  }

  async getStages(organizationId: string, id: string): Promise<WorkflowStage[]> {
    const record = await this.prisma.workflowTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!record) {
      throw new NotFoundException(`Workflow template ${id} not found`);
    }
    return record.stages as unknown as WorkflowStage[];
  }

  // ── Core engine ─────────────────────────────────────────────────────────────

  /**
   * Resolve the best matching workflow template for a given org + optional product.
   * Product-specific template takes priority over the org-wide default.
   */
  async getWorkflow(organizationId: string, productId?: string): Promise<WorkflowTemplate | null> {
    if (productId) {
      const productSpecific = await this.prisma.workflowTemplate.findFirst({
        where: { organizationId, productId, isActive: true, isDefault: true },
      });
      if (productSpecific) return this.mapRecord(productSpecific);
    }

    const orgDefault = await this.prisma.workflowTemplate.findFirst({
      where: { organizationId, productId: null, isActive: true, isDefault: true },
    });
    return orgDefault ? this.mapRecord(orgDefault) : null;
  }

  /**
   * Check whether a given user may execute a stage transition on an application.
   */
  async validateTransition(
    organizationId: string,
    applicationId: string,
    fromStage: string,
    toStage: string,
    userId: string,
  ): Promise<TransitionValidationResult> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId },
      include: {
        documents: true,
        bureauRequests: { include: { bureauResponse: true } },
        breDecision: true,
      },
    });
    if (!application) {
      return { allowed: false, reason: 'Application not found' };
    }

    const workflow = await this.getWorkflow(organizationId, application.productId);
    if (!workflow) {
      return { allowed: false, reason: 'No active workflow template configured for this organisation' };
    }

    const transition = workflow.transitions.find(
      (t) => t.from === fromStage && t.to === toStage,
    );
    if (!transition) {
      return { allowed: false, reason: `Transition from ${fromStage} to ${toStage} is not defined in the workflow` };
    }

    // Role check
    if (transition.requiredRole) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const roleCodes = userRoles.map((ur: { role: { code: string } }) => ur.role.code);
      if (!roleCodes.includes(transition.requiredRole)) {
        return {
          allowed: false,
          reason: `Role ${transition.requiredRole} is required to perform this transition`,
        };
      }
    }

    // Amount limit check
    if (transition.amountLimit !== undefined) {
      if (application.requestedAmountPaisa > transition.amountLimit) {
        return {
          allowed: false,
          reason: `Requested amount exceeds the approval limit (${transition.amountLimit} paisa) for your role`,
        };
      }
    }

    // Condition checks
    if (transition.conditions && transition.conditions.length > 0) {
      for (const condition of transition.conditions) {
        const conditionResult = await this.evaluateCondition(condition, application as ApplicationWithRelations);
        if (!conditionResult.passed) {
          return { allowed: false, reason: conditionResult.reason };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Execute a validated transition: update the application status + stage,
   * record the history entry, and return the updated application.
   */
  async executeTransition(
    organizationId: string,
    applicationId: string,
    toStage: string,
    userId: string,
    remarks?: string,
  ): Promise<Record<string, unknown>> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const fromStage = application.currentWorkflowStage ?? application.status;

    const validation = await this.validateTransition(
      organizationId,
      applicationId,
      fromStage,
      toStage,
      userId,
    );
    if (!validation.allowed) {
      throw new ForbiddenException(validation.reason ?? 'Transition not allowed');
    }

    const workflow = await this.getWorkflow(organizationId, application.productId);
    const transition = workflow!.transitions.find(
      (t) => t.from === fromStage && t.to === toStage,
    )!;

    if (transition.requiresRemarks && !remarks) {
      throw new BadRequestException('Remarks are required for this transition');
    }

    // Map workflow stage code → ApplicationStatus enum value where possible
    const statusValue = this.stageToApplicationStatus(toStage);

    const [updatedApplication] = await this.prisma.$transaction([
      this.prisma.loanApplication.update({
        where: { id: applicationId },
        data: {
          currentWorkflowStage: toStage,
          ...(statusValue && { status: statusValue as import('@prisma/client').ApplicationStatus }),
          updatedBy: userId,
        },
      }),
      this.prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: fromStage,
          toStatus: toStage,
          changedBy: userId,
          remarks: remarks ?? null,
        },
      }),
    ]);

    return updatedApplication as unknown as Record<string, unknown>;
  }

  /**
   * Return the list of stages the given user can immediately transition to
   * from the current stage of the application.
   */
  async getAvailableTransitions(
    organizationId: string,
    applicationId: string,
    userId: string,
  ): Promise<AvailableTransition[]> {
    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const currentStage = application.currentWorkflowStage ?? application.status;

    const workflow = await this.getWorkflow(organizationId, application.productId);
    if (!workflow) return [];

    const candidateTransitions = workflow.transitions.filter(
      (t) => t.from === currentStage,
    );

    const available: AvailableTransition[] = [];
    for (const transition of candidateTransitions) {
      const validation = await this.validateTransition(
        organizationId,
        applicationId,
        currentStage,
        transition.to,
        userId,
      );
      if (validation.allowed) {
        const targetStage = workflow.stages.find((s) => s.code === transition.to);
        available.push({
          toStage: transition.to,
          toStageName: targetStage?.name ?? transition.to,
          requiresRemarks: transition.requiresRemarks ?? false,
        });
      }
    }
    return available;
  }

  /**
   * Find applications where the time spent in the current stage exceeds slaDays.
   */
  async checkSlaBreaches(organizationId: string): Promise<SlaBreachRecord[]> {
    const applications = await this.prisma.loanApplication.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: ['DISBURSED', 'REJECTED', 'CANCELLED', 'EXPIRED'] },
      },
      include: { product: true },
    });

    const breaches: SlaBreachRecord[] = [];
    const now = new Date();

    for (const app of applications) {
      const workflow = await this.getWorkflow(organizationId, app.productId);
      if (!workflow) continue;

      const currentStageCode = app.currentWorkflowStage ?? app.status;
      const stage = workflow.stages.find((s) => s.code === currentStageCode);
      if (!stage?.slaDays) continue;

      // Use updatedAt as proxy for when the stage last changed
      const daysElapsed = Math.floor(
        (now.getTime() - app.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysElapsed > stage.slaDays) {
        breaches.push({
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          currentStage: currentStageCode,
          slaDays: stage.slaDays,
          daysElapsed,
          daysBreached: daysElapsed - stage.slaDays,
        });
      }
    }
    return breaches;
  }

  // ── Seed helpers ─────────────────────────────────────────────────────────────

  async seedDefaultWorkflows(organizationId: string, createdBy?: string): Promise<void> {
    const existing = await this.prisma.workflowTemplate.count({
      where: { organizationId },
    });
    if (existing > 0) return; // already seeded

    await this.prisma.workflowTemplate.createMany({
      data: [
        {
          organizationId,
          name: 'Standard Lending Flow',
          productId: null,
          isDefault: true,
          isActive: true,
          stages: STANDARD_LENDING_STAGES as unknown as import('@prisma/client').Prisma.JsonArray,
          transitions: STANDARD_LENDING_TRANSITIONS as unknown as import('@prisma/client').Prisma.JsonArray,
          createdBy: createdBy ?? null,
          updatedBy: createdBy ?? null,
        },
        {
          organizationId,
          name: 'Gold Loan Express',
          productId: null,
          isDefault: false,
          isActive: true,
          stages: GOLD_LOAN_STAGES as unknown as import('@prisma/client').Prisma.JsonArray,
          transitions: GOLD_LOAN_TRANSITIONS as unknown as import('@prisma/client').Prisma.JsonArray,
          createdBy: createdBy ?? null,
          updatedBy: createdBy ?? null,
        },
      ],
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private mapRecord(record: {
    id: string;
    organizationId: string;
    name: string;
    productId: string | null;
    isDefault: boolean;
    isActive: boolean;
    stages: import('@prisma/client').Prisma.JsonValue;
    transitions: import('@prisma/client').Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    updatedBy: string | null;
  }): WorkflowTemplate {
    return {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      productId: record.productId,
      isDefault: record.isDefault,
      isActive: record.isActive,
      stages: record.stages as unknown as WorkflowStage[],
      transitions: record.transitions as unknown as WorkflowTransition[],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    };
  }

  private async evaluateCondition(
    condition: { type: string; config?: Record<string, unknown> },
    application: ApplicationWithRelations,
  ): Promise<{ passed: boolean; reason?: string }> {
    switch (condition.type) {
      case 'DOCUMENTS_COMPLETE': {
        const verified = application.documents.filter((d) => d.isVerified);
        if (verified.length === 0) {
          return { passed: false, reason: 'No verified documents found. Please upload and verify required documents.' };
        }
        return { passed: true };
      }

      case 'BUREAU_COMPLETED': {
        const successfulBureau = application.bureauRequests.some(
          (br) => br.status === 'SUCCESS' && br.bureauResponse != null,
        );
        if (!successfulBureau) {
          return { passed: false, reason: 'Bureau check has not been completed for this application.' };
        }
        return { passed: true };
      }

      case 'BRE_COMPLETED': {
        if (!application.breDecisionId) {
          return { passed: false, reason: 'BRE (Business Rule Engine) evaluation has not been completed.' };
        }
        return { passed: true };
      }

      case 'CUSTOM_FIELD_FILLED': {
        const fieldName = condition.config?.field as string | undefined;
        if (!fieldName) return { passed: true };
        const customFields = (application as Record<string, unknown>).customFields as Record<string, unknown> | undefined;
        if (!customFields || customFields[fieldName] === undefined || customFields[fieldName] === null) {
          return { passed: false, reason: `Required custom field "${fieldName}" is not filled.` };
        }
        return { passed: true };
      }

      case 'ALL_CONDITIONS_MET':
        // Composite — child conditions should be evaluated by the caller
        return { passed: true };

      default:
        return { passed: true };
    }
  }

  /**
   * Map a workflow stage code to the Prisma ApplicationStatus enum value.
   * Returns null when the stage code is workflow-specific and has no direct DB enum equivalent.
   */
  private stageToApplicationStatus(stageCode: string): string | null {
    const mapping: Record<string, string> = {
      LEAD: 'LEAD',
      APPLICATION: 'APPLICATION',
      DOCUMENT_COLLECTION: 'DOCUMENT_COLLECTION',
      BUREAU_CHECK: 'BUREAU_CHECK',
      UNDERWRITING: 'UNDERWRITING',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
      SANCTIONED: 'SANCTIONED',
      DISBURSEMENT_PENDING: 'DISBURSEMENT_PENDING',
      DISBURSED: 'DISBURSED',
    };
    return mapping[stageCode] ?? null;
  }
}

// ── Internal type for application with relations ──────────────────────────────

type ApplicationWithRelations = {
  id: string;
  breDecisionId: string | null;
  requestedAmountPaisa: number;
  documents: { isVerified: boolean }[];
  bureauRequests: {
    status: string;
    bureauResponse: Record<string, unknown> | null;
  }[];
};
