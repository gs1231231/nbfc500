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
import { LeadScoringService } from './lead-scoring.service';
import { CreateLeadScoreConfigDto } from './dto/create-config.dto';
import { UpdateLeadScoreConfigDto } from './dto/update-config.dto';
import { LeaderboardFilterDto } from './dto/leaderboard-filter.dto';

@Controller('api/v1/lead-scoring')
export class LeadScoringController {
  constructor(private readonly leadScoringService: LeadScoringService) {}

  /**
   * POST /api/v1/lead-scoring/configs
   * Create a new lead score configuration.
   */
  @Post('configs')
  createConfig(
    @Headers('x-org-id') orgId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateLeadScoreConfigDto,
  ) {
    return this.leadScoringService.createConfig(orgId, userId, dto);
  }

  /**
   * GET /api/v1/lead-scoring/configs
   * List all scoring configs for the organization.
   */
  @Get('configs')
  listConfigs(@Headers('x-org-id') orgId: string) {
    return this.leadScoringService.listConfigs(orgId);
  }

  /**
   * GET /api/v1/lead-scoring/configs/:id
   * Get a specific config with usage stats and grade distribution.
   */
  @Get('configs/:id')
  getConfig(
    @Headers('x-org-id') orgId: string,
    @Param('id') configId: string,
  ) {
    return this.leadScoringService.getConfig(orgId, configId);
  }

  /**
   * PATCH /api/v1/lead-scoring/configs/:id
   * Update an existing scoring config.
   */
  @Patch('configs/:id')
  updateConfig(
    @Headers('x-org-id') orgId: string,
    @Param('id') configId: string,
    @Body() dto: UpdateLeadScoreConfigDto,
  ) {
    return this.leadScoringService.updateConfig(orgId, configId, dto);
  }

  /**
   * POST /api/v1/lead-scoring/score/:applicationId
   * Score a specific loan application.
   */
  @Post('score/:applicationId')
  scoreApplication(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leadScoringService.scoreApplication(orgId, applicationId);
  }

  /**
   * POST /api/v1/lead-scoring/score/:applicationId/rescore
   * Re-score an application after new data (bureau pull, etc.).
   */
  @Post('score/:applicationId/rescore')
  rescoreApplication(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leadScoringService.rescoreApplication(orgId, applicationId);
  }

  /**
   * GET /api/v1/lead-scoring/score/:applicationId
   * Get the latest score for an application.
   */
  @Get('score/:applicationId')
  getScore(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leadScoringService.getScore(orgId, applicationId);
  }

  /**
   * GET /api/v1/lead-scoring/score/:applicationId/history
   * Get all score versions for an application (shows score evolution over time).
   */
  @Get('score/:applicationId/history')
  getScoreHistory(
    @Headers('x-org-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.leadScoringService.getScoreHistory(orgId, applicationId);
  }

  /**
   * POST /api/v1/lead-scoring/bulk-score
   * Score all active-stage applications in the organization.
   */
  @Post('bulk-score')
  bulkScore(@Headers('x-org-id') orgId: string) {
    return this.leadScoringService.bulkScoreApplications(orgId);
  }

  /**
   * GET /api/v1/lead-scoring/leaderboard
   * Ranked list of applications by score with filters.
   */
  @Get('leaderboard')
  getLeaderboard(
    @Headers('x-org-id') orgId: string,
    @Query() filters: LeaderboardFilterDto,
  ) {
    return this.leadScoringService.getLeaderboard(orgId, filters);
  }

  /**
   * GET /api/v1/lead-scoring/grade-distribution
   * Count of applications per grade for dashboard charts.
   */
  @Get('grade-distribution')
  getGradeDistribution(
    @Headers('x-org-id') orgId: string,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.leadScoringService.getGradeDistribution(orgId, { productId, branchId });
  }

  /**
   * GET /api/v1/lead-scoring/conversion-by-grade
   * Conversion rate per grade — what % of A-grade leads disbursed vs D-grade.
   */
  @Get('conversion-by-grade')
  getConversionByGrade(@Headers('x-org-id') orgId: string) {
    return this.leadScoringService.getConversionByGrade(orgId);
  }

  /**
   * GET /api/v1/lead-scoring/factor-analysis/:configId
   * Which factors contribute most to high scores vs low. Helps tune weights.
   */
  @Get('factor-analysis/:configId')
  getFactorAnalysis(
    @Headers('x-org-id') orgId: string,
    @Param('configId') configId: string,
  ) {
    return this.leadScoringService.getFactorAnalysis(orgId, configId);
  }
}
