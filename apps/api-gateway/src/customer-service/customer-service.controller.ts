import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import {
  CustomerServiceService,
  CreateComplaintDto,
  ResolveComplaintDto,
  HandlePrivacyRequestDto,
  UpdatePrivacyRequestDto,
} from './customer-service.service';

@Controller('api/v1')
export class CustomerServiceController {
  constructor(private readonly customerServiceService: CustomerServiceService) {}

  // ── Complaints ────────────────────────────────────────────────────────────

  /** POST /api/v1/complaints */
  @Post('complaints')
  createComplaint(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.customerServiceService.createComplaint(orgId, dto);
  }

  /** GET /api/v1/complaints */
  @Get('complaints')
  listComplaints(
    @Headers('x-org-id') orgId: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.customerServiceService.listComplaints(orgId, status, +page, +limit);
  }

  /** GET /api/v1/complaints/sla-breaches */
  @Get('complaints/sla-breaches')
  getSLABreaches(@Headers('x-org-id') orgId: string) {
    return this.customerServiceService.getSLABreaches(orgId);
  }

  /** GET /api/v1/complaints/:id */
  @Get('complaints/:id')
  getComplaint(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
  ) {
    return this.customerServiceService.getComplaint(orgId, id);
  }

  /** PATCH /api/v1/complaints/:id */
  @Patch('complaints/:id')
  updateComplaint(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateComplaintDto>,
  ) {
    return this.customerServiceService.updateComplaint(orgId, id, dto);
  }

  /** POST /api/v1/complaints/:id/escalate */
  @Post('complaints/:id/escalate')
  escalateComplaint(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
  ) {
    return this.customerServiceService.escalateComplaint(orgId, id);
  }

  /** POST /api/v1/complaints/:id/resolve */
  @Post('complaints/:id/resolve')
  resolveComplaint(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.customerServiceService.resolveComplaint(orgId, id, dto);
  }

  // ── Privacy Requests (DPDPA) ──────────────────────────────────────────────

  /** POST /api/v1/privacy-requests */
  @Post('privacy-requests')
  handlePrivacyRequest(
    @Headers('x-org-id') orgId: string,
    @Body() dto: HandlePrivacyRequestDto,
  ) {
    return this.customerServiceService.handlePrivacyRequest(orgId, dto);
  }

  /** GET /api/v1/privacy-requests */
  @Get('privacy-requests')
  listPrivacyRequests(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.customerServiceService.listPrivacyRequests(orgId, +page, +limit);
  }

  /** GET /api/v1/privacy-requests/:id */
  @Get('privacy-requests/:id')
  getPrivacyRequest(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
  ) {
    return this.customerServiceService.getPrivacyRequest(orgId, id);
  }

  /** PATCH /api/v1/privacy-requests/:id */
  @Patch('privacy-requests/:id')
  updatePrivacyRequest(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrivacyRequestDto,
  ) {
    return this.customerServiceService.updatePrivacyRequest(orgId, id, dto);
  }
}
