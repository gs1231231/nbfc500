import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { PropertyService } from './property.service';
import { AddPropertyDetailDto, UpdateConstructionProgressDto } from './dto/add-property-detail.dto';

/**
 * Controller for Home Loan / LAP (Loan Against Property) operations.
 *
 * Handles property registration, construction stage tracking for tranche disbursements,
 * CERSAI filing/release, and LTV calculation.
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 */
@ApiTags('Property Loans (Home Loan / LAP)')
@Controller('api/v1/property-loans')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  // ============================================================
  // POST /api/v1/property-loans/details
  // ============================================================

  @Post('details')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add property details to a loan application',
    description:
      'Registers a property for a home loan or LAP application. ' +
      'Property types: RESIDENTIAL_FLAT, HOUSE, PLOT, COMMERCIAL, INDUSTRIAL. ' +
      'Captures address, valuation, title status, encumbrance, and construction info.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: AddPropertyDetailDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Property details added successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid property type or validation error' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async addPropertyDetail(
    @Query('orgId') orgId: string,
    @Body() dto: AddPropertyDetailDto,
  ) {
    return this.propertyService.addPropertyDetail(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/property-loans/details/:propertyId
  // ============================================================

  @Get('details/:propertyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get property detail by ID' })
  @ApiParam({ name: 'propertyId', description: 'Property detail UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Property detail' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Property detail not found' })
  async getPropertyDetail(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.propertyService.getPropertyDetail(orgId, propertyId);
  }

  // ============================================================
  // PATCH /api/v1/property-loans/construction/:propertyId
  // ============================================================

  @Patch('construction/:propertyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update construction stage and progress',
    description:
      'Updates the construction stage and completion percentage for tranche disbursement. ' +
      'Stages: NOT_STARTED, FOUNDATION, STRUCTURE, FINISHING, COMPLETED. ' +
      'Progress is 0-100%. Used by field inspection teams to record site visits.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property detail UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: UpdateConstructionProgressDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Construction progress updated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Property detail not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid stage or progress value' })
  async updateConstructionProgress(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('orgId') orgId: string,
    @Body() dto: UpdateConstructionProgressDto,
  ) {
    return this.propertyService.updateConstructionProgress(orgId, propertyId, dto);
  }

  // ============================================================
  // POST /api/v1/property-loans/cersai/file/:loanId
  // ============================================================

  @Post('cersai/file/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'File CERSAI registration for a property loan',
    description:
      'Registers the security interest with CERSAI (Central Registry of Securitisation ' +
      'Asset Reconstruction and Security Interest of India). ' +
      'Mandatory for property loans under SARFAESI Act. ' +
      'Must be done within 30 days of loan creation. Mock API in development.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CERSAI registration filed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Property detail not found for this loan' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'CERSAI already confirmed' })
  async fileCersai(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.propertyService.fileCersai(orgId, loanId);
  }

  // ============================================================
  // POST /api/v1/property-loans/cersai/release/:loanId
  // ============================================================

  @Post('cersai/release/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release CERSAI registration after loan closure',
    description:
      'Submits CERSAI release request after loan is fully repaid. ' +
      'Must be completed within 30 days of loan closure per regulations. ' +
      'Mock API in development.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CERSAI release submitted' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Property detail not found for this loan' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'CERSAI not yet filed' })
  async releaseCersai(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.propertyService.releaseCersai(orgId, loanId);
  }

  // ============================================================
  // GET /api/v1/property-loans/ltv/:applicationId
  // ============================================================

  @Get('ltv/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate LTV for a property loan application',
    description:
      'Calculates Loan-to-Value ratio based on forced sale value (or market value if FSV not set). ' +
      'Max LTV: 75% for residential properties, 65% for commercial/industrial. ' +
      'Returns valuation basis, LTV%, and max eligible amount.',
  })
  @ApiParam({ name: 'applicationId', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'LTV calculation result' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'No property or valuation data' })
  async calculateLTV(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.propertyService.calculateLTV(orgId, applicationId);
  }
}
