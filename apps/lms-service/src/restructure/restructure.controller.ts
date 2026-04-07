import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { RestructureService, InitiateRestructureDto } from './restructure.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, OrgGuard)
export class RestructureController {
  constructor(private readonly restructureService: RestructureService) {}

  /**
   * POST /api/v1/loans/:id/restructure
   * Initiates a loan restructure — snapshots old terms, calculates new schedule.
   * Body: { restructureType, newTenureMonths?, newRateBps?, moratoriumMonths? }
   */
  @Post('loans/:id/restructure')
  @HttpCode(HttpStatus.CREATED)
  async initiateRestructure(
    @Param('id') id: string,
    @Body() dto: InitiateRestructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restructureService.initiateRestructure(user.orgId, id, dto);
  }

  /**
   * POST /api/v1/restructures/:id/approve
   * Approves a pending restructure, applies new terms, and regenerates the schedule.
   */
  @Post('restructures/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveRestructure(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restructureService.approveRestructure(user.orgId, id, user.userId);
  }

  /**
   * GET /api/v1/loans/:id/restructures
   * Lists all restructure records for a loan.
   */
  @Get('loans/:id/restructures')
  async getRestructureHistory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restructureService.getRestructureHistory(user.orgId, id);
  }
}
