import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
} from '@nestjs/common';
import { CommunicationsService } from './communications.service';

class SendRateChangeDto {
  newRateAnnual!: number;
  effectiveDate!: string;
  reason?: string;
}

@Controller('api/v1/communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  /**
   * POST /api/v1/communications/welcome-kit/:loanId
   * Send welcome kit after disbursement.
   */
  @Post('welcome-kit/:loanId')
  sendWelcomeKit(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
  ) {
    return this.communicationsService.sendWelcomeKit(orgId, loanId);
  }

  /**
   * POST /api/v1/communications/annual-statements
   * Trigger annual statements for all active loans in the org.
   */
  @Post('annual-statements')
  sendAnnualStatement(@Headers('x-org-id') orgId: string) {
    return this.communicationsService.sendAnnualStatement(orgId);
  }

  /**
   * POST /api/v1/communications/rate-change-notice/:loanId
   * Send rate change notice for a floating rate loan.
   */
  @Post('rate-change-notice/:loanId')
  sendRateChangeNotice(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
    @Body() dto: SendRateChangeDto,
  ) {
    return this.communicationsService.sendRateChangeNotice(
      orgId,
      loanId,
      dto.newRateAnnual,
      dto.effectiveDate,
      dto.reason,
    );
  }

  /**
   * POST /api/v1/communications/seed-templates
   * Seed all communication templates for the org (idempotent).
   */
  @Post('seed-templates')
  seedCommunicationTemplates(@Headers('x-org-id') orgId: string) {
    return this.communicationsService.seedCommunicationTemplates(orgId);
  }
}
