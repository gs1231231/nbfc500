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
import { IsString } from 'class-validator';
import { AaService } from './aa.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateConsentDto {
  @IsString()
  customerId!: string;
}

class FetchStatementsDto {
  @IsString()
  consentId!: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/v1/account-aggregator')
@UseGuards(JwtAuthGuard, OrgGuard)
export class AaController {
  constructor(private readonly aaService: AaService) {}

  /**
   * POST /api/v1/account-aggregator/consent
   * Create an AA consent request for a customer.
   */
  @Post('consent')
  @HttpCode(HttpStatus.CREATED)
  async createConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConsentDto,
  ) {
    return this.aaService.createConsent(user.orgId, dto.customerId);
  }

  /**
   * POST /api/v1/account-aggregator/fetch
   * Fetch bank statements using an active consent.
   */
  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetchStatements(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FetchStatementsDto,
  ) {
    return this.aaService.fetchStatements(user.orgId, dto.consentId);
  }

  /**
   * POST /api/v1/account-aggregator/analyze/:applicationId
   * Fetch statements and analyze them, then store results in the application.
   */
  @Post('analyze/:applicationId')
  @HttpCode(HttpStatus.OK)
  async analyzeAndFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: FetchStatementsDto,
  ) {
    const statements = await this.aaService.fetchStatements(user.orgId, dto.consentId);
    const analysis = this.aaService.analyzeStatements(statements);
    const feedResult = await this.aaService.feedToBre(user.orgId, applicationId, analysis);
    return { analysis, ...feedResult };
  }

  /**
   * GET /api/v1/account-aggregator/report/:applicationId
   * Retrieve stored AA analysis from the application's customFields.
   */
  @Get('report/:applicationId')
  async getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.aaService.getReport(user.orgId, applicationId);
  }
}
