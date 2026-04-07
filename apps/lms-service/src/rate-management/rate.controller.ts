import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { RateService } from './rate.service';
import { UpdateBenchmarkRateDto, RateImpactAnalysisDto } from './dto/rate.dto';

@Controller('api/v1/rates')
@UseGuards(JwtAuthGuard, OrgGuard)
export class RateController {
  constructor(private readonly rateService: RateService) {}

  /**
   * POST /api/v1/rates/benchmark
   * Updates the REPO/MCLR benchmark rate and closes previous rate cards.
   */
  @Post('benchmark')
  @HttpCode(HttpStatus.OK)
  async updateBenchmarkRate(
    @Body() dto: UpdateBenchmarkRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rateService.updateBenchmarkRate(user.orgId, dto);
  }

  /**
   * POST /api/v1/rates/reset
   * Applies rate reset to all floating-rate loans that are due for reset.
   * Calculates new effective rate = benchmark + spread, then regenerates
   * the remaining amortization schedule.
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async applyRateReset(@CurrentUser() user: AuthenticatedUser) {
    return this.rateService.applyRateReset(user.orgId);
  }

  /**
   * GET /api/v1/rates/upcoming-resets
   * Returns loans with rate resets due within the next 30 days.
   */
  @Get('upcoming-resets')
  async getUpcomingResets(@CurrentUser() user: AuthenticatedUser) {
    return this.rateService.getUpcomingResets(user.orgId);
  }

  /**
   * POST /api/v1/rates/impact-analysis
   * Simulates the NIM impact of a benchmark rate change.
   * Body: { benchmarkChangeBps: number, benchmark?: "REPO"|"MCLR" }
   */
  @Post('impact-analysis')
  @HttpCode(HttpStatus.OK)
  async rateChangeImpact(
    @Body() dto: RateImpactAnalysisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rateService.rateChangeImpact(user.orgId, dto);
  }
}
