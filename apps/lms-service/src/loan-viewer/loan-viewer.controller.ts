import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OrgGuard, CurrentUser, AuthenticatedUser } from '@bankos/auth';
import { LoanViewerService } from './loan-viewer.service';

@Controller('api/v1/loans')
@UseGuards(JwtAuthGuard, OrgGuard)
export class LoanViewerController {
  constructor(private readonly loanViewerService: LoanViewerService) {}

  /**
   * GET /api/v1/loans/:id/view?role=CREDIT_OFFICER
   * Returns role-appropriate loan data based on the requester's role.
   *
   * Roles: CREDIT_OFFICER | OPS_OFFICER | COLLECTION_AGENT |
   *        ACCOUNTS_OFFICER | MANAGEMENT | CUSTOMER
   */
  @Get(':id/view')
  async getLoanView(
    @Param('id') id: string,
    @Query('role') role: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanViewerService.getLoanView(user.orgId, id, role);
  }
}
