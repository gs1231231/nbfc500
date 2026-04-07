import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { LogsService, CreateCallLogDto, CreateVisitLogDto } from './logs.service';

@Controller('api/v1/collections')
@UseGuards(JwtAuthGuard, OrgGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * POST /api/v1/collections/call-logs
   * Records a collection call with duration, disposition, and optional PTP details.
   */
  @Post('call-logs')
  @HttpCode(HttpStatus.CREATED)
  async createCallLog(
    @Body() dto: CreateCallLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logsService.createCallLog(user.orgId, dto.loanId, dto);
  }

  /**
   * GET /api/v1/collections/call-logs?loanId=X
   * Lists call history for a loan.
   */
  @Get('call-logs')
  async getCallLogs(
    @Query('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logsService.getCallLogs(user.orgId, loanId);
  }

  /**
   * POST /api/v1/collections/visit-logs
   * Records a field visit with GPS check-in/out, photos, and outcome.
   */
  @Post('visit-logs')
  @HttpCode(HttpStatus.CREATED)
  async createVisitLog(
    @Body() dto: CreateVisitLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logsService.createVisitLog(user.orgId, dto.loanId, dto);
  }

  /**
   * GET /api/v1/collections/visit-logs?loanId=X
   * Lists visit history for a loan.
   */
  @Get('visit-logs')
  async getVisitLogs(
    @Query('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logsService.getVisitLogs(user.orgId, loanId);
  }
}
