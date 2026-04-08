import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, OrgGuard, OrgId, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { FilterApplicationDto } from './dto/filter-application.dto';
import { TransitionApplicationDto } from './dto/transition-application.dto';

/**
 * Controller for Loan Application CRUD and lifecycle management.
 *
 * All monetary amounts in responses are in INR (rupees) with 2 decimal places.
 * All monetary amounts in request bodies must be in paisa (1 INR = 100 paisa).
 *
 * organizationId is extracted from the JWT token via the @OrgId() decorator.
 * The JwtAuthGuard + OrgGuard pair ensures every request is authenticated and
 * carries a valid orgId — callers cannot spoof a different org by passing a
 * query parameter.
 */
@ApiTags('Loan Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@Controller('api/v1/applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  // ============================================================
  // POST /api/v1/applications
  // ============================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new loan application',
    description:
      'Creates a new loan application (starts in LEAD status). ' +
      'Validates: requested amount within product limits, customer KYC = VERIFIED, ' +
      'no duplicate application (same customer + product within 30 days). ' +
      'Auto-generates applicationNumber in ORG/PROD/YYYY/NNNNNN format.',
  })
  @ApiBody({ type: CreateApplicationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Application created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error or amount/tenure out of product limits',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Customer KYC not verified',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate application within 30 days',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product or customer not found',
  })
  async create(
    @Body() dto: CreateApplicationDto,
    @OrgId() orgId: string,
  ) {
    return this.applicationService.create(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/applications
  // ============================================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List loan applications with cursor-based pagination',
    description:
      'Returns a paginated list of loan applications. ' +
      'Supports filtering by status, productId, branchId, dsaId, assignedToId, ' +
      'createdAt range, and requested amount range. ' +
      'Includes customer name and product name in the response.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by application status' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  @ApiQuery({ name: 'dsaId', required: false, description: 'Filter by DSA ID' })
  @ApiQuery({ name: 'assignedToId', required: false, description: 'Filter by assigned officer ID' })
  @ApiQuery({ name: 'createdAtFrom', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'createdAtTo', required: false, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'minAmountPaisa', required: false, description: 'Minimum requested amount in paisa' })
  @ApiQuery({ name: 'maxAmountPaisa', required: false, description: 'Maximum requested amount in paisa' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (last seen application ID)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Records per page (max 100, default 20)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of applications',
  })
  async findAll(
    @OrgId() orgId: string,
    @Query() filters: FilterApplicationDto,
  ) {
    return this.applicationService.findAll(orgId, filters);
  }

  // ============================================================
  // GET /api/v1/applications/:id
  // ============================================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a single loan application by ID',
    description:
      'Returns the full detail of a loan application including all relations: ' +
      'customer, product, branch, assigned officer, DSA, BRE decision, ' +
      'documents, bureau requests, and associated loans.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Full application detail',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @OrgId() orgId: string,
  ) {
    return this.applicationService.findOne(orgId, id);
  }

  // ============================================================
  // PATCH /api/v1/applications/:id
  // ============================================================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a loan application',
    description:
      'Updates editable fields of a loan application. ' +
      'Only allowed when application is in editable stages: LEAD, APPLICATION, DOCUMENT_COLLECTION. ' +
      'Returns the full updated application.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiBody({ type: UpdateApplicationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Application is not in an editable stage',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @OrgId() orgId: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationService.update(orgId, id, dto);
  }

  // ============================================================
  // DELETE /api/v1/applications/:id
  // ============================================================

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a loan application',
    description:
      'Soft-deletes a loan application by setting deletedAt. ' +
      'Only allowed when application is in an editable stage: LEAD, APPLICATION, DOCUMENT_COLLECTION.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Application is not in a deletable stage',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @OrgId() orgId: string,
  ) {
    return this.applicationService.remove(orgId, id);
  }

  // ============================================================
  // POST /api/v1/applications/:id/transition
  // ============================================================

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transition a loan application to a new status',
    description:
      'Transitions the application through the loan lifecycle pipeline.\n\n' +
      'Valid transitions:\n' +
      '- LEAD → APPLICATION\n' +
      '- APPLICATION → DOCUMENT_COLLECTION\n' +
      '- DOCUMENT_COLLECTION → BUREAU_CHECK\n' +
      '- BUREAU_CHECK → UNDERWRITING\n' +
      '- UNDERWRITING → APPROVED | REJECTED\n' +
      '- APPROVED → SANCTIONED\n' +
      '- SANCTIONED → DISBURSEMENT_PENDING\n' +
      '- DISBURSEMENT_PENDING → DISBURSED\n' +
      '- CANCELLED allowed from any stage except DISBURSED.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'userId', required: false, description: 'Acting user ID (for role checks) — defaults to JWT userId' })
  @ApiBody({ type: TransitionApplicationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application status transitioned successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Invalid status transition',
  })
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @OrgId() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userIdOverride: string | undefined,
    @Body() dto: TransitionApplicationDto,
  ) {
    // Prefer the JWT userId; allow explicit override only for backward-compat
    const actingUserId = userIdOverride ?? user.userId;
    return this.applicationService.transition(orgId, id, dto, actingUserId);
  }

  // ============================================================
  // GET /api/v1/applications/:id/available-transitions
  // ============================================================

  @Get(':id/available-transitions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available workflow transitions for an application',
    description:
      'Returns the list of stages the specified user can immediately transition to ' +
      'from the application\'s current stage. ' +
      'Uses the workflow engine when a template exists; falls back to static transitions.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'userId', required: false, description: 'Acting user ID — defaults to JWT userId' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available transitions',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  async availableTransitions(
    @Param('id', ParseUUIDPipe) id: string,
    @OrgId() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userIdOverride: string | undefined,
  ) {
    const actingUserId = userIdOverride ?? user.userId;
    return this.applicationService.getAvailableTransitions(orgId, id, actingUserId);
  }
}
