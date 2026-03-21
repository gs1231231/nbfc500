import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BreRuleCategory } from '@prisma/client';
import { BreService } from './bre.service';
import { EvaluateApplicationDto } from './dto/evaluate.dto';
import { SimulateDto } from './dto/simulate.dto';
import { CreateBreRuleDto } from './dto/create-rule.dto';
import { UpdateBreRuleDto } from './dto/update-rule.dto';

// ---------------------------------------------------------------------------
// NOTE: In a production setup this header value would come from a JWT guard.
// For now callers supply X-Org-Id directly for multi-tenant routing.
// ---------------------------------------------------------------------------

@ApiTags('BRE')
@Controller('api/v1/bre')
export class BreController {
  constructor(private readonly breService: BreService) {}

  // -------------------------------------------------------------------------
  // Evaluate
  // -------------------------------------------------------------------------

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Evaluate BRE rules for a loan application',
    description:
      'Fetches application, customer, bureau and product data, runs all active rules ' +
      'in priority order and persists a BreDecision record. Returns APPROVED, REJECTED or REFERRED.',
  })
  @ApiBody({ type: EvaluateApplicationDto })
  @ApiQuery({
    name: 'orgId',
    required: true,
    description: 'Organization UUID (multi-tenant scope)',
  })
  @ApiResponse({ status: 200, description: 'BRE evaluation result' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async evaluate(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: EvaluateApplicationDto,
  ) {
    return this.breService.evaluateApplication(orgId, dto.applicationId);
  }

  // -------------------------------------------------------------------------
  // Simulate
  // -------------------------------------------------------------------------

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate BRE evaluation without persisting a decision',
    description:
      'Runs all active rules for a product against the supplied test context. ' +
      'No BreDecision record is created. Useful for what-if analysis.',
  })
  @ApiBody({ type: SimulateDto })
  @ApiQuery({
    name: 'orgId',
    required: true,
    description: 'Organization UUID (multi-tenant scope)',
  })
  @ApiResponse({ status: 200, description: 'Simulated BRE evaluation result' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async simulate(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: SimulateDto,
  ) {
    return this.breService.simulate(orgId, dto.productId, dto.testContext);
  }

  // -------------------------------------------------------------------------
  // Rules CRUD
  // -------------------------------------------------------------------------

  @Post('rules')
  @ApiOperation({ summary: 'Create a new BRE rule' })
  @ApiBody({ type: CreateBreRuleDto })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async createRule(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateBreRuleDto,
  ) {
    return this.breService.createRule(orgId, dto);
  }

  @Get('rules')
  @ApiOperation({
    summary: 'List BRE rules',
    description: 'Returns all BRE rules for the org, optionally filtered by productId, category or isActive.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by loan product UUID' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: BreRuleCategory,
    description: 'Filter by rule category',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({ status: 200, description: 'List of BRE rules' })
  async findAllRules(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Query('productId') productId?: string,
    @Query('category') category?: BreRuleCategory,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.breService.findAllRules(orgId, {
      productId,
      category,
      isActive: isActiveBool,
    });
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get a BRE rule by ID' })
  @ApiParam({ name: 'id', description: 'BRE rule UUID' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiResponse({ status: 200, description: 'BRE rule details' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async findOneRule(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
  ) {
    return this.breService.findOneRule(orgId, ruleId);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a BRE rule' })
  @ApiParam({ name: 'id', description: 'BRE rule UUID' })
  @ApiBody({ type: UpdateBreRuleDto })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiResponse({ status: 200, description: 'Updated BRE rule' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateBreRuleDto,
  ) {
    return this.breService.updateRule(orgId, ruleId, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a BRE rule' })
  @ApiParam({ name: 'id', description: 'BRE rule UUID' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization UUID' })
  @ApiResponse({ status: 204, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRule(
    @Query('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
  ) {
    await this.breService.deleteRule(orgId, ruleId);
  }
}
