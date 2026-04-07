import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { MSMEService } from './msme.service';
import { AddMSMEDetailDto } from './dto/add-msme-detail.dto';

/**
 * Controller for MSME Working Capital loan operations.
 *
 * Handles MSME registration details, drawing power calculation,
 * GST and Udyam verification (mock integrations).
 *
 * Drawing power formula: (Stock × 75%) + (Debtors × 75%) − Creditors
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 */
@ApiTags('MSME Working Capital')
@Controller('api/v1/msme')
export class MSMEController {
  constructor(private readonly msmeService: MSMEService) {}

  // ============================================================
  // POST /api/v1/msme/details
  // ============================================================

  @Post('details')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add MSME details to a loan application',
    description:
      'Registers MSME business details for a working capital or business loan. ' +
      'Captures GSTIN, Udyam number, business category, financials, ' +
      'and stock statement data for drawing power calculation.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: AddMSMEDetailDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'MSME details added successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation error or invalid category/type' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async addMSMEDetail(
    @Query('orgId') orgId: string,
    @Body() dto: AddMSMEDetailDto,
  ) {
    return this.msmeService.addMSMEDetail(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/msme/details/:msmeId
  // ============================================================

  @Get('details/:msmeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get MSME detail by ID' })
  @ApiParam({ name: 'msmeId', description: 'MSME detail UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'MSME detail' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'MSME detail not found' })
  async getMSMEDetail(
    @Param('msmeId', ParseUUIDPipe) msmeId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.msmeService.getMSMEDetail(orgId, msmeId);
  }

  // ============================================================
  // GET /api/v1/msme/drawing-power/:applicationId
  // ============================================================

  @Get('drawing-power/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate drawing power for a working capital loan',
    description:
      'Calculates drawing power based on stock statement: ' +
      '(Stock × 75%) + (Debtors × 75%) − Creditors. ' +
      'Updates the drawingPowerPaisa field in the MSME detail. ' +
      'Used by credit officers to determine sanctionable CC/OD limit.',
  })
  @ApiParam({ name: 'applicationId', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Drawing power calculation result with component breakdown' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'No MSME details or stock value not set' })
  async calculateDrawingPower(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.msmeService.calculateDrawingPower(orgId, applicationId);
  }

  // ============================================================
  // GET /api/v1/msme/verify-gst/:gstin
  // ============================================================

  @Get('verify-gst/:gstin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify GST registration via GST portal',
    description:
      'Verifies the GSTIN with the GST portal (mock integration). ' +
      'In production, calls https://api.gst.gov.in. ' +
      'Returns registration status, trade name, and turnover bracket.',
  })
  @ApiParam({ name: 'gstin', description: '15-character GSTIN (e.g. 27AAPFU0939F1ZV)', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'GST verification result' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid GSTIN format' })
  async verifyGST(
    @Param('gstin') gstin: string,
    @Query('orgId') orgId: string,
  ) {
    return this.msmeService.verifyGST(orgId, gstin);
  }

  // ============================================================
  // GET /api/v1/msme/verify-udyam/:udyamNumber
  // ============================================================

  @Get('verify-udyam/:udyamNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Udyam registration',
    description:
      'Verifies the Udyam registration number with the Udyam portal (mock integration). ' +
      'In production, calls the Udyam Assist Portal API. ' +
      'Returns enterprise type (MICRO/SMALL/MEDIUM), NIC code, and validity.',
  })
  @ApiParam({ name: 'udyamNumber', description: 'Udyam registration number (e.g. UDYAM-MH-01-0001234)', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Udyam verification result' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid Udyam number format' })
  async verifyUdyam(
    @Param('udyamNumber') udyamNumber: string,
    @Query('orgId') orgId: string,
  ) {
    return this.msmeService.verifyUdyam(orgId, udyamNumber);
  }
}
