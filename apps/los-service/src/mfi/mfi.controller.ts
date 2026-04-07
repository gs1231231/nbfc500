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
  MfiService,
  CreateGroupDto,
  AddMemberDto,
  CGTDto,
  GRTDto,
  GroupCollectionDto,
} from './mfi.service';

@Controller('api/v1/mfi')
export class MfiController {
  constructor(private readonly mfiService: MfiService) {}

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  /** POST /api/v1/mfi/groups */
  @Post('groups')
  createGroup(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.mfiService.createGroup(orgId, dto);
  }

  /** GET /api/v1/mfi/groups */
  @Get('groups')
  listGroups(
    @Headers('x-org-id') orgId: string,
    @Query('branchId') branchId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.mfiService.listGroups(orgId, branchId, +page, +limit);
  }

  /** GET /api/v1/mfi/groups/:id */
  @Get('groups/:id')
  getGroup(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
  ) {
    return this.mfiService.getGroup(orgId, id);
  }

  /** PATCH /api/v1/mfi/groups/:id */
  @Patch('groups/:id')
  updateGroup(
    @Headers('x-org-id') orgId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateGroupDto>,
  ) {
    return this.mfiService.updateGroup(orgId, id, dto);
  }

  // ── Member Operations ──────────────────────────────────────────────────────

  /** POST /api/v1/mfi/groups/:id/members */
  @Post('groups/:id/members')
  addMember(
    @Headers('x-org-id') orgId: string,
    @Param('id') groupId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.mfiService.addMember(orgId, groupId, dto);
  }

  // ── Training ───────────────────────────────────────────────────────────────

  /** POST /api/v1/mfi/groups/:id/cgt */
  @Post('groups/:id/cgt')
  conductCGT(
    @Headers('x-org-id') orgId: string,
    @Param('id') groupId: string,
    @Body() dto: CGTDto,
  ) {
    return this.mfiService.conductCGT(orgId, groupId, dto);
  }

  /** POST /api/v1/mfi/groups/:id/grt */
  @Post('groups/:id/grt')
  conductGRT(
    @Headers('x-org-id') orgId: string,
    @Param('id') groupId: string,
    @Body() dto: GRTDto,
  ) {
    return this.mfiService.conductGRT(orgId, groupId, dto);
  }

  // ── Disbursement & Collection ──────────────────────────────────────────────

  /** POST /api/v1/mfi/groups/:id/bulk-disburse */
  @Post('groups/:id/bulk-disburse')
  bulkDisburse(
    @Headers('x-org-id') orgId: string,
    @Param('id') groupId: string,
  ) {
    return this.mfiService.bulkDisburse(orgId, groupId);
  }

  /** POST /api/v1/mfi/groups/:id/collect */
  @Post('groups/:id/collect')
  groupCollection(
    @Headers('x-org-id') orgId: string,
    @Param('id') groupId: string,
    @Body() dto: GroupCollectionDto,
  ) {
    return this.mfiService.groupCollection(orgId, groupId, dto);
  }

  // ── Center Meeting Schedule ────────────────────────────────────────────────

  /** GET /api/v1/mfi/center-meeting-schedule?branchId=xxx */
  @Get('center-meeting-schedule')
  getCenterMeetingSchedule(
    @Headers('x-org-id') orgId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.mfiService.getCenterMeetingSchedule(orgId, branchId);
  }
}
