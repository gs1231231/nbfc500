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
import { OtsService } from './ots.service';
import {
  CreateOtsProposalDto,
  ReviewOtsProposalDto,
  RecordOtsPaymentDto,
} from './dto/ots.dto';

@Controller('api/v1/ots')
export class OtsController {
  constructor(private readonly otsService: OtsService) {}

  @Post('proposals')
  createProposal(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreateOtsProposalDto,
  ) {
    return this.otsService.createProposal(orgId, dto);
  }

  @Get('proposals')
  listProposals(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.otsService.listProposals(orgId, +page, +limit);
  }

  @Get('proposals/:id')
  getProposal(
    @Headers('x-org-id') orgId: string,
    @Param('id') proposalId: string,
  ) {
    return this.otsService.getProposal(orgId, proposalId);
  }

  @Patch('proposals/:id/review')
  reviewProposal(
    @Headers('x-org-id') orgId: string,
    @Param('id') proposalId: string,
    @Body() dto: ReviewOtsProposalDto,
  ) {
    return this.otsService.reviewProposal(orgId, proposalId, dto);
  }

  @Post('proposals/:id/payments')
  recordPayment(
    @Headers('x-org-id') orgId: string,
    @Param('id') proposalId: string,
    @Body() dto: RecordOtsPaymentDto,
  ) {
    return this.otsService.recordPayment(orgId, proposalId, dto);
  }

  @Post('proposals/:id/close')
  closeProposal(
    @Headers('x-org-id') orgId: string,
    @Param('id') proposalId: string,
  ) {
    return this.otsService.closeProposal(orgId, proposalId);
  }
}
