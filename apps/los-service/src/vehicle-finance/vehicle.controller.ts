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
import { VehicleService } from './vehicle.service';
import { AddVehicleDetailDto } from './dto/add-vehicle-detail.dto';

/**
 * Controller for Vehicle Finance product-specific operations.
 *
 * Handles vehicle registration, LTV calculation, hypothecation filing/release
 * and RC verification via Vahan API (mock).
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 */
@ApiTags('Vehicle Finance')
@Controller('api/v1/vehicle-finance')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // ============================================================
  // POST /api/v1/vehicle-finance/details
  // ============================================================

  @Post('details')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add vehicle details to a loan application',
    description:
      'Registers a vehicle for a vehicle finance loan application. ' +
      'Vehicle types: TWO_WHEELER, CAR, COMMERCIAL, TRACTOR, CONSTRUCTION. ' +
      'Captures make, model, variant, year, pricing, dealer and invoice details.',
  })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: AddVehicleDetailDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Vehicle details added successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid vehicle type or validation error' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application not found' })
  async addVehicleDetail(
    @Query('orgId') orgId: string,
    @Body() dto: AddVehicleDetailDto,
  ) {
    return this.vehicleService.addVehicleDetail(orgId, dto);
  }

  // ============================================================
  // GET /api/v1/vehicle-finance/details/:vehicleId
  // ============================================================

  @Get('details/:vehicleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get vehicle detail by ID' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle detail UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Vehicle detail' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Vehicle detail not found' })
  async getVehicleDetail(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.vehicleService.getVehicleDetail(orgId, vehicleId);
  }

  // ============================================================
  // GET /api/v1/vehicle-finance/ltv/:applicationId
  // ============================================================

  @Get('ltv/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate LTV for a vehicle loan application',
    description:
      'Calculates Loan-to-Value ratio vs on-road price. ' +
      'Max LTV: 90% for new vehicles, 80% for used vehicles. ' +
      'Returns max eligible amount and whether request is within limit.',
  })
  @ApiParam({ name: 'applicationId', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'LTV calculation result' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Application or vehicle not found' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'On-road price not set' })
  async calculateLTV(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.vehicleService.calculateLTV(orgId, applicationId);
  }

  // ============================================================
  // POST /api/v1/vehicle-finance/hypothecation/file/:loanId
  // ============================================================

  @Post('hypothecation/file/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'File hypothecation with RTO',
    description:
      'Marks the vehicle hypothecation as FILED with the Regional Transport Office. ' +
      'Called after loan disbursement to register lender as hypothecatee on RC. ' +
      'Sets hypothecationDate to current date.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Hypothecation filed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Vehicle detail not found for this loan' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Hypothecation already confirmed' })
  async fileHypothecation(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.vehicleService.fileHypothecation(orgId, loanId);
  }

  // ============================================================
  // POST /api/v1/vehicle-finance/hypothecation/release/:loanId
  // ============================================================

  @Post('hypothecation/release/:loanId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release hypothecation after loan closure',
    description:
      'Marks hypothecation as RELEASED. Called after loan is fully repaid. ' +
      'Customer must then visit RTO to get lender endorsement removed from RC.',
  })
  @ApiParam({ name: 'loanId', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Hypothecation released successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Vehicle detail not found for this loan' })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Cannot release — not yet filed or already released' })
  async releaseHypothecation(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.vehicleService.releaseHypothecation(orgId, loanId);
  }

  // ============================================================
  // POST /api/v1/vehicle-finance/verify-rc/:vehicleId
  // ============================================================

  @Post('verify-rc/:vehicleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify vehicle RC via Vahan API',
    description:
      'Performs a mock Vahan API check to verify the vehicle registration certificate. ' +
      'In production, calls https://vahan.nic.in with RC number. ' +
      'Marks rcVerified = true on success.',
  })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle detail UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'RC verified successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Vehicle detail not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Registration number not set' })
  async verifyRC(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.vehicleService.verifyRC(orgId, vehicleId);
  }
}
