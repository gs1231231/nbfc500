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
import { WriteoffService } from './writeoff.service';
import {
  InitiateWriteoffDto,
  ApproveWriteoffDto,
  RecordWriteoffRecoveryDto,
  TechnicalWriteOffDto,
  BoardApprovalDto,
  PostWriteOffRecoveryDto,
} from './dto/writeoff.dto';

@Controller('api/v1/writeoffs')
export class WriteoffController {
  constructor(private readonly writeoffService: WriteoffService) {}

  @Post()
  initiateWriteoff(
    @Headers('x-org-id') orgId: string,
    @Body() dto: InitiateWriteoffDto,
  ) {
    return this.writeoffService.initiateWriteoff(orgId, dto);
  }

  @Get()
  listWriteoffs(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.writeoffService.listWriteoffs(orgId, +page, +limit);
  }

  @Get(':id')
  getWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
  ) {
    return this.writeoffService.getWriteoff(orgId, writeoffId);
  }

  @Patch(':id/approve')
  approveWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
    @Body() dto: ApproveWriteoffDto,
  ) {
    return this.writeoffService.approveWriteoff(orgId, writeoffId, dto);
  }

  @Post(':id/execute')
  executeWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
  ) {
    return this.writeoffService.executeWriteoff(orgId, writeoffId);
  }

  @Post(':id/recovery')
  recordRecovery(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
    @Body() dto: RecordWriteoffRecoveryDto,
  ) {
    return this.writeoffService.recordRecovery(orgId, writeoffId, dto);
  }

  // ── GAP 10 endpoints ──────────────────────────────────────────────────────

  /**
   * POST /api/v1/writeoffs/loans/:loanId/technical
   * Technical write-off: removes from books, collection continues.
   */
  @Post('loans/:loanId/technical')
  technicalWriteOff(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
    @Body() dto: TechnicalWriteOffDto,
  ) {
    return this.writeoffService.technicalWriteOff(orgId, loanId, dto);
  }

  /**
   * POST /api/v1/writeoffs/:id/board-approval
   * Record board resolution number and date.
   */
  @Post(':id/board-approval')
  boardApproval(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
    @Body() dto: BoardApprovalDto,
  ) {
    return this.writeoffService.boardApproval(orgId, writeoffId, dto);
  }

  /**
   * POST /api/v1/writeoffs/loans/:loanId/post-writeoff-recovery
   * Record recovery after write-off.
   */
  @Post('loans/:loanId/post-writeoff-recovery')
  postWriteOffRecovery(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
    @Body() dto: PostWriteOffRecoveryDto,
  ) {
    return this.writeoffService.postWriteOffRecovery(orgId, loanId, dto);
  }

  /**
   * GET /api/v1/writeoffs/report?fy=2025-26
   * Write-off and recovery summary report.
   */
  @Get('report')
  getWriteOffReport(
    @Headers('x-org-id') orgId: string,
    @Query('fy') fy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.writeoffService.getWriteOffReport(orgId, fy, from, to);
  }

  /**
   * POST /api/v1/writeoffs/auto-identify
   * Auto-identify loans meeting write-off criteria (NPA > 4 years, Loss Assets).
   */
  @Post('auto-identify')
  suoMotoWriteOff(@Headers('x-org-id') orgId: string) {
    return this.writeoffService.suoMotoWriteOff(orgId);
  }
}
