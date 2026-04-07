import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@bankos/auth';
import { CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { WorkflowService, WorkflowStage, WorkflowTransition } from './workflow.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  TransitionApplicationDto,
} from './workflow.dto';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * GET /api/v1/workflows
   * List all active workflow templates for the authenticated user's organisation.
   */
  @Get()
  async listWorkflows(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.listWorkflows(user.orgId);
  }

  /**
   * POST /api/v1/workflows
   * Create a new workflow template.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(user.orgId, {
      name: dto.name,
      productId: dto.productId,
      isDefault: dto.isDefault,
      stages: dto.stages as unknown as WorkflowStage[],
      transitions: dto.transitions as unknown as WorkflowTransition[],
      createdBy: user.userId,
    });
  }

  /**
   * PATCH /api/v1/workflows/:id
   * Update an existing workflow template.
   */
  @Patch(':id')
  async updateWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(user.orgId, id, {
      name: dto.name,
      isDefault: dto.isDefault,
      isActive: dto.isActive,
      stages: dto.stages as unknown as WorkflowStage[] | undefined,
      transitions: dto.transitions as unknown as WorkflowTransition[] | undefined,
      updatedBy: user.userId,
    });
  }

  /**
   * GET /api/v1/workflows/:id/stages
   * Retrieve the stage list for a specific workflow template.
   */
  @Get(':id/stages')
  async getStages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.workflowService.getStages(user.orgId, id);
  }
}

// ── Application-scoped workflow endpoints ─────────────────────────────────────

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationWorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * POST /api/v1/applications/:id/workflow/transition
   * Execute a workflow stage transition for an application.
   */
  @Post(':id/workflow/transition')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') applicationId: string,
    @Body() dto: TransitionApplicationDto,
  ) {
    return this.workflowService.executeTransition(
      user.orgId,
      applicationId,
      dto.toStage,
      user.userId,
      dto.remarks,
    );
  }

  /**
   * GET /api/v1/applications/:id/workflow/available-transitions
   * Return the transitions the current user can perform on this application right now.
   */
  @Get(':id/workflow/available-transitions')
  async availableTransitions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') applicationId: string,
  ) {
    return this.workflowService.getAvailableTransitions(
      user.orgId,
      applicationId,
      user.userId,
    );
  }
}
