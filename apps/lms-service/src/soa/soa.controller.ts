import {
  Body,
  Controller,
  Get,
  Headers,
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
import { SoaService } from './soa.service';
import { AddSoaEntryDto } from './dto/add-entry.dto';

@ApiTags('Statement of Account (SOA)')
@Controller('api/v1/loans')
export class SoaController {
  constructor(private readonly soaService: SoaService) {}

  private resolveOrgId(headers: Record<string, string | string[]>): string {
    const orgId = headers['x-organization-id'];
    if (!orgId || Array.isArray(orgId)) {
      throw new Error('X-Organization-Id header is required');
    }
    return orgId;
  }

  // POST /api/v1/loans/:id/soa/entries  (internal use by other services)
  @Post(':id/soa/entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a SOA entry with running balance computation' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  @ApiBody({ type: AddSoaEntryDto })
  @ApiResponse({ status: 201, description: 'SOA entry created' })
  async addEntry(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) loanId: string,
    @Body() dto: AddSoaEntryDto,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.soaService.addEntry(orgId, loanId, dto);
  }

  // GET /api/v1/loans/:id/soa
  @Get(':id/soa')
  @ApiOperation({ summary: 'Get Statement of Account for a loan' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date ISO string' })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({ status: 200, description: 'Statement of Account' })
  async getSOA(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) loanId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.soaService.getSOA(orgId, loanId, from, to);
  }

  // GET /api/v1/loans/:id/foreclosure-quote
  @Get(':id/foreclosure-quote')
  @ApiOperation({ summary: 'Get foreclosure quote with breakdown (valid 7 days)' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  @ApiResponse({ status: 200, description: 'Foreclosure quote' })
  async getForeclosureQuote(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) loanId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.soaService.getForeclosureQuote(orgId, loanId);
  }

  // GET /api/v1/loans/:id/interest-certificate
  @Get(':id/interest-certificate')
  @ApiOperation({ summary: 'Get interest certificate for a financial year' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  @ApiQuery({ name: 'fy', required: true, description: 'Financial year in format "2025-26"', example: '2025-26' })
  @ApiResponse({ status: 200, description: 'Interest certificate for income tax purposes' })
  async getInterestCertificate(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) loanId: string,
    @Query('fy') fy: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.soaService.getInterestCertificate(orgId, loanId, fy);
  }

  // GET /api/v1/loans/:id/noc
  @Get(':id/noc')
  @ApiOperation({ summary: 'Get No Objection Certificate (only for closed loans)' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  @ApiResponse({ status: 200, description: 'No Objection Certificate' })
  async getNOC(
    @Headers() headers: Record<string, string>,
    @Param('id', ParseUUIDPipe) loanId: string,
  ) {
    const orgId = this.resolveOrgId(headers);
    return this.soaService.getNOC(orgId, loanId);
  }
}
