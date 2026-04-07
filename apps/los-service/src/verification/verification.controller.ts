import {
  Body,
  Controller,
  Get,
  Headers,
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
import { VerificationService } from './verification.service';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { AssignVerificationDto } from './dto/assign-verification.dto';
import { SubmitReportDto } from './dto/submit-report.dto';

@ApiTags('Verifications')
@Controller('api/v1/verifications')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  private resolveOrgId(headers: Record<string, string | string[]>): string {
    const orgId = headers['x-organization-id'];
    if (!orgId || Array.isArray(orgId)) {
      throw new Error('X-Organization-Id header is required');
    }
    return orgId;
  }

  // POST /api/v1/verifications/request
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a new verification for a loan application' })
  @ApiBody({ type: RequestVerificationDto })
  @ApiResponse({ status: 201, description: 'Verification request created' })
  async requestVerification(
    @Headers() headers: Record<string, string>,
    @Body() dto: RequestVerificationDto,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.verificationService.requestVerification(orgId, dto);
  }

  // PATCH /api/v1/verifications/:id/assign
  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a verification to an agent or vendor' })
  @ApiParam({ name: 'id', description: 'Verification request ID' })
  @ApiBody({ type: AssignVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification assigned' })
  async assignVerification(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVerificationDto,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.verificationService.assignVerification(orgId, id, dto);
  }

  // PATCH /api/v1/verifications/:id/submit-report
  @Patch(':id/submit-report')
  @ApiOperation({ summary: 'Submit verification report with outcome' })
  @ApiParam({ name: 'id', description: 'Verification request ID' })
  @ApiBody({ type: SubmitReportDto })
  @ApiResponse({ status: 200, description: 'Report submitted' })
  async submitReport(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitReportDto,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.verificationService.submitReport(orgId, id, dto);
  }

  // GET /api/v1/verifications?applicationId=X
  @Get()
  @ApiOperation({ summary: 'List all verifications for an application' })
  @ApiQuery({ name: 'applicationId', required: true, description: 'Loan application ID' })
  @ApiResponse({ status: 200, description: 'List of verification requests' })
  async getVerifications(
    @Headers() headers: Record<string, string>,
    @Query('applicationId') applicationId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.verificationService.getVerifications(orgId, applicationId);
  }

  // GET /api/v1/verifications/completeness?applicationId=X
  @Get('completeness')
  @ApiOperation({ summary: 'Check if all required verifications are complete and positive' })
  @ApiQuery({ name: 'applicationId', required: true, description: 'Loan application ID' })
  @ApiResponse({ status: 200, description: 'Completeness status' })
  async checkCompleteness(
    @Headers() headers: Record<string, string>,
    @Query('applicationId') applicationId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.verificationService.areAllVerificationsComplete(orgId, applicationId);
  }
}
