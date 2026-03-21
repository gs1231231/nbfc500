import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BureauType } from '@prisma/client';
import { BureauService, BureauServiceResponse } from './bureau.service';
import { BureauPullDto } from './dto/bureau-pull.dto';

/**
 * BureauController — HTTP interface for the Credit Bureau service.
 *
 * All endpoints require the X-Organization-Id header to identify the tenant.
 * In production this header is injected by the API Gateway after JWT validation.
 *
 * Base path: /api/v1/bureau
 */
@ApiTags('Bureau')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Tenant organization UUID (injected by API Gateway)',
  required: true,
  example: '550e8400-e29b-41d4-a716-446655440001',
})
@Controller('api/v1/bureau')
export class BureauController {
  constructor(private readonly bureauService: BureauService) {}

  /**
   * POST /api/v1/bureau/pull
   *
   * Trigger a bureau report pull for a loan application.
   * Returns a cached result if a valid report was pulled within the last 30 days.
   *
   * Amounts in the response are in paisa. Divide by 100 to get rupees.
   */
  @Post('pull')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pull bureau report',
    description:
      'Trigger a credit bureau pull for a loan application. ' +
      'Returns cached data if a valid report exists within 30 days. ' +
      'The `fromCache` field indicates whether the response was served from cache.',
  })
  @ApiOkResponse({
    description: 'Bureau report pulled (or returned from cache) successfully',
  })
  async pullBureauReport(
    @Headers('x-organization-id') orgId: string,
    @Body() dto: BureauPullDto,
  ): Promise<{
    success: boolean;
    data: BureauServiceResponse;
  }> {
    const result = await this.bureauService.pull(
      orgId,
      dto.applicationId,
      dto.bureauPreference ?? BureauType.CIBIL,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/v1/bureau/report/:applicationId
   *
   * Retrieve the latest successful bureau report for a loan application.
   * Does NOT trigger a new pull — use POST /pull for that.
   */
  @Get('report/:applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get latest bureau report',
    description:
      'Retrieve the most recent successful bureau report for a loan application. ' +
      'Does not trigger a new pull. Use POST /pull to initiate a fresh bureau fetch.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'UUID of the loan application',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Bureau report found and returned',
  })
  @ApiNotFoundResponse({
    description:
      'No bureau report found for the given application. Trigger a pull first.',
  })
  async getBureauReport(
    @Headers('x-organization-id') orgId: string,
    @Param('applicationId') applicationId: string,
  ): Promise<{
    success: boolean;
    data: BureauServiceResponse;
  }> {
    const result = await this.bureauService.getReport(orgId, applicationId);

    return {
      success: true,
      data: result,
    };
  }
}
