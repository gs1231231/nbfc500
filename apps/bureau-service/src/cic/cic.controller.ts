import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CicService, CicSubmissionResult, SubmissionRecord } from './cic.service';
import { GenerateSubmissionDto } from './dto/generate-submission.dto';

/**
 * CicController — HTTP interface for CIBIL/CIC data submission.
 *
 * All endpoints require the X-Organization-Id header to identify the tenant.
 *
 * Base path: /api/v1/cic
 */
@ApiTags('CIC')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Tenant organization UUID (injected by API Gateway)',
  required: true,
  example: '550e8400-e29b-41d4-a716-446655440001',
})
@Controller('api/v1/cic')
export class CicController {
  constructor(private readonly cicService: CicService) {}

  /**
   * POST /api/v1/cic/generate-submission
   *
   * Generate a TUEF-format data submission file for the given bureau, month, and year.
   * Includes all active loans and loans closed within the last 36 months.
   */
  @Post('generate-submission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate bureau data submission',
    description:
      'Generates a simplified TUEF fixed-width submission file for all active and ' +
      'recently closed loans (within 36 months). Returns the file content, record count, ' +
      'and any validation errors.',
  })
  @ApiOkResponse({
    description: 'Submission file generated successfully',
  })
  async generateSubmission(
    @Headers('x-organization-id') orgId: string,
    @Body() dto: GenerateSubmissionDto,
  ): Promise<{
    success: boolean;
    data: CicSubmissionResult;
  }> {
    const result = await this.cicService.generateSubmission(
      orgId,
      dto.bureauType,
      dto.month,
      dto.year,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/v1/cic/submissions
   *
   * List all past submissions generated for this organization.
   */
  @Get('submissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List past submissions',
    description:
      'Returns a list of all bureau data submissions previously generated ' +
      'for this organization (in-memory log, cleared on service restart).',
  })
  @ApiOkResponse({
    description: 'List of past submissions',
  })
  listSubmissions(
    @Headers('x-organization-id') orgId: string,
  ): {
    success: boolean;
    data: SubmissionRecord[];
  } {
    const submissions = this.cicService.listSubmissions(orgId);

    return {
      success: true,
      data: submissions,
    };
  }
}
