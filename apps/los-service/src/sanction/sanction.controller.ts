import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SanctionService } from './sanction.service';
import { SanctionApplicationDto } from './dto/sanction-application.dto';

/**
 * Controller for loan sanction operations.
 *
 * Sanction is the formal approval of a loan with specific terms
 * (amount, tenure, interest rate) after BRE clearance.
 *
 * organizationId is passed via query param (TODO: replace with JWT auth).
 */
@ApiTags('Sanction')
@Controller('api/v1/applications')
export class SanctionController {
  constructor(private readonly sanctionService: SanctionService) {}

  // ============================================================
  // POST /api/v1/applications/:id/sanction
  // ============================================================

  @Post(':id/sanction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sanction a loan application',
    description:
      'Formally sanctions a loan application with specific terms. ' +
      'Validates: application must be in APPROVED status. ' +
      'BRE decision must exist and be APPROVED, or REFERRED with an override by a credit officer. ' +
      'Transitions application to SANCTIONED status and records: ' +
      'sanctionedAmountPaisa, sanctionedTenureMonths, sanctionedInterestRateBps, and conditions.',
  })
  @ApiParam({ name: 'id', description: 'Loan application UUID', type: 'string' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiBody({ type: SanctionApplicationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application sanctioned successfully — status transitions to SANCTIONED',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Application not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description:
      'Application is not in APPROVED status, or BRE decision is missing / not approved',
  })
  async sanctionApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Query('orgId') orgId: string,
    @Body() dto: SanctionApplicationDto,
  ) {
    return this.sanctionService.sanctionApplication(orgId, applicationId, dto);
  }
}
