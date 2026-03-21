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
import { DisbursementService } from './disbursement.service';
import { DisburseLoanDto } from './dto/disburse-loan.dto';

/**
 * Controller for loan disbursement operations.
 *
 * Handles:
 * - POST /api/v1/applications/:id/disburse — Disburse a sanctioned loan
 * - GET /api/v1/loans/:id                  — Get loan with repayment schedule
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 * Bank account numbers are NOT logged per security rules (PII).
 */
@ApiTags('Disbursement')
@Controller('api/v1')
export class DisbursementController {
  constructor(private readonly disbursementService: DisbursementService) {}

  // ============================================================
  // POST /api/v1/applications/:id/disburse
  // ============================================================

  @Post('applications/:id/disburse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Disburse a sanctioned loan application',
    description:
      'Disburses a loan for an application in SANCTIONED or DISBURSEMENT_PENDING status.\n\n' +
      'Workflow:\n' +
      '1. Validate application status (SANCTIONED or DISBURSEMENT_PENDING)\n' +
      '2. Create Loan record with EMI calculated via EMI formula (P*r*(1+r)^n / ((1+r)^n - 1))\n' +
      '3. Generate full amortization schedule (one LoanSchedule per installment)\n' +
      '4. Create GL entries: Dr "Loan Asset" (1001), Cr "Bank" (1000)\n' +
      '5. Transition application status to DISBURSED\n\n' +
      'All writes are atomic (single DB transaction).\n' +
      'First EMI date = disbursement date + 1 month.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: DisburseLoanDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Loan disbursed successfully — returns loan record with full EMI schedule',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description:
      'Application is not in a disbursable status, or sanction details are missing',
  })
  async disburseLoan(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
    @Body() dto: DisburseLoanDto,
  ) {
    return this.disbursementService.disburseLoan(orgId, applicationId, dto);
  }

  // ============================================================
  // GET /api/v1/loans/:id
  // ============================================================

  @Get('loans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a loan with its full repayment schedule',
    description:
      'Returns the full loan record including all installments in the repayment schedule, ' +
      'customer details, product details, and linked application number. ' +
      'All monetary amounts in response are in INR (rupees) with 2 decimal places.',
  })
  @ApiParam({ name: 'id', description: 'Loan UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan with full schedule',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
  })
  async getLoan(
    @Param('id', ParseUUIDPipe) loanId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.disbursementService.getLoan(orgId, loanId);
  }
}
