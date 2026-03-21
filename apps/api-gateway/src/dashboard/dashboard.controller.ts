import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, OrgGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/v1/dashboard/stats
   * Returns today's application count, sanctioned count, disbursed count,
   * and pending approval count.
   */
  @Get('stats')
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user.orgId);
  }

  /**
   * GET /api/v1/dashboard/pipeline
   * Returns applications grouped by status with counts.
   */
  @Get('pipeline')
  async getPipeline(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getPipeline(user.orgId);
  }

  /**
   * GET /api/v1/dashboard/npa-summary
   * Returns loans grouped by NPA classification with count and total outstanding.
   */
  @Get('npa-summary')
  async getNpaSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getNpaSummary(user.orgId);
  }

  /**
   * GET /api/v1/dashboard/collection-efficiency
   * Returns collection efficiency percentage for the current month.
   */
  @Get('collection-efficiency')
  async getCollectionEfficiency(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getCollectionEfficiency(user.orgId);
  }
}
