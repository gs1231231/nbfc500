import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { LeadService } from './lead.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@Controller('api/v1/leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  // ─── POST /api/v1/leads/aadhaar/send-otp ─────────────────────────────────

  @Post('aadhaar/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Aadhaar OTP',
    description:
      'Initiates the Aadhaar eKYC flow by sending an OTP to the mobile number ' +
      'linked to the given Aadhaar. Returns a txnId that must be used in verify-otp.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: { txnId: 'MOCK-TXN-1700000000000', maskedAadhaar: 'XXXX-XXXX-1234' },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Aadhaar format' })
  sendOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendOtpDto,
  ) {
    return this.leadService.initiateAadhaarOtp(user.orgId, dto.aadhaarNumber);
  }

  // ─── POST /api/v1/leads/aadhaar/verify-otp ───────────────────────────────

  @Post('aadhaar/verify-otp')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify Aadhaar OTP and create lead',
    description:
      'Verifies the OTP, fetches eKYC data, runs dedupe check, creates ' +
      '(or reuses) a Customer record, then creates a LoanApplication with ' +
      'status = LEAD. Returns customer and application details.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 201,
    description: 'Lead created successfully',
    schema: {
      example: {
        customer: { id: 'uuid', customerNumber: 'NBFC/CUST/000001', fullName: 'Ramesh Kumar Sharma' },
        application: { id: 'uuid', applicationNumber: 'NBFC/PL/2026/000001', status: 'LEAD' },
        isExisting: false,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid OTP' })
  @ApiResponse({ status: 400, description: 'Invalid transaction ID or eKYC failure' })
  verifyOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyOtpDto,
  ) {
    return this.leadService.verifyOtpAndCreateLead(user.orgId, dto);
  }

  // ─── GET /api/v1/leads/:applicationId ────────────────────────────────────

  @Get(':applicationId')
  @ApiOperation({
    summary: 'Get lead status',
    description: 'Returns the loan application and associated customer details for the given ID.',
  })
  @ApiParam({ name: 'applicationId', description: 'LoanApplication UUID' })
  @ApiResponse({ status: 200, description: 'Lead detail' })
  @ApiResponse({ status: 400, description: 'Application not found' })
  getLeadStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.leadService.getLeadStatus(user.orgId, applicationId);
  }
}
