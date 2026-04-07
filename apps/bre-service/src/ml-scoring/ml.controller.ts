import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { MlService } from './ml.service';

@Controller('api/v1/ml-scoring')
@UseGuards(JwtAuthGuard, OrgGuard)
export class MlController {
  constructor(private readonly mlService: MlService) {}

  /**
   * POST /api/v1/ml-scoring/score/:applicationId
   * Calculate ML credit score for an application.
   */
  @Post('score/:applicationId')
  @HttpCode(HttpStatus.OK)
  async score(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.mlService.calculateScore(user.orgId, applicationId);
  }

  /**
   * POST /api/v1/ml-scoring/compare/:applicationId
   * Compare BRE decision and ML score for an application.
   */
  @Post('compare/:applicationId')
  @HttpCode(HttpStatus.OK)
  async compare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.mlService.compareModels(user.orgId, applicationId);
  }

  /**
   * GET /api/v1/ml-scoring/model-metrics
   * Return mock ML model performance metrics.
   */
  @Get('model-metrics')
  getModelMetrics() {
    return this.mlService.getModelMetrics();
  }
}
