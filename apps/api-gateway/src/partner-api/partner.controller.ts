import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartnerService } from './partner.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class GenerateApiKeyDto {
  @IsString()
  partnerName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

class CreateLeadDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  monthlyIncomePaisa?: number;

  @IsNumber()
  @Min(1)
  requestedAmountPaisa!: number;

  @IsNumber()
  @Min(1)
  requestedTenureMonths!: number;

  @IsOptional()
  @IsString()
  productId?: string;
}

class RegisterWebhookDto {
  @IsString()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/v1/partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  /**
   * POST /api/v1/partner/api-keys
   * Generate a new API key for a partner. Requires JWT auth.
   */
  @Post('api-keys')
  @UseGuards(JwtAuthGuard, OrgGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateApiKeyDto,
  ) {
    return this.partnerService.generateApiKey(
      user.orgId,
      dto.partnerName,
      dto.permissions,
    );
  }

  /**
   * POST /api/v1/partner/leads
   * Create a lead via external API. Authenticated via x-api-key header.
   */
  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  async createLead(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateLeadDto,
  ) {
    const { orgId } = this.partnerService.validateApiKey(apiKey);
    return this.partnerService.createLeadViaApi(orgId, dto);
  }

  /**
   * GET /api/v1/partner/applications/:appNumber/status
   * Check application status. Authenticated via x-api-key header.
   */
  @Get('applications/:appNumber/status')
  async getApplicationStatus(
    @Headers('x-api-key') apiKey: string,
    @Param('appNumber') appNumber: string,
  ) {
    const { orgId } = this.partnerService.validateApiKey(apiKey);
    return this.partnerService.checkApplicationStatus(orgId, appNumber);
  }

  /**
   * GET /api/v1/partner/loans/:loanNumber/schedule
   * Get repayment schedule. Authenticated via x-api-key header.
   */
  @Get('loans/:loanNumber/schedule')
  async getRepaymentSchedule(
    @Headers('x-api-key') apiKey: string,
    @Param('loanNumber') loanNumber: string,
  ) {
    const { orgId } = this.partnerService.validateApiKey(apiKey);
    return this.partnerService.getRepaymentSchedule(orgId, loanNumber);
  }

  /**
   * POST /api/v1/partner/webhooks
   * Register a webhook URL. Authenticated via x-api-key header.
   */
  @Post('webhooks')
  @HttpCode(HttpStatus.CREATED)
  async registerWebhook(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    const { orgId } = this.partnerService.validateApiKey(apiKey);
    return this.partnerService.registerWebhook(orgId, dto.url, dto.events);
  }

  /**
   * GET /api/v1/partner/webhooks
   * List all registered webhooks. Authenticated via x-api-key header.
   */
  @Get('webhooks')
  async listWebhooks(@Headers('x-api-key') apiKey: string) {
    const { orgId } = this.partnerService.validateApiKey(apiKey);
    return this.partnerService.listWebhooks(orgId);
  }
}
