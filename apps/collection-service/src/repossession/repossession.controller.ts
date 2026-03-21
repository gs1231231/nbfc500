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
import { RepossessionService } from './repossession.service';
import {
  CreateRepossessionCaseDto,
  UpdateRepossessionCaseDto,
  RecordSeizureDto,
  YardEntryDto,
  CreateAuctionDto,
  RecordBidDto,
  RecordSaleDto,
} from './dto/repossession.dto';

@Controller('api/v1/repossession')
export class RepossessionController {
  constructor(private readonly repossessionService: RepossessionService) {}

  // -------------------------------------------------------------------------
  // Case endpoints
  // -------------------------------------------------------------------------

  @Post('cases')
  createCase(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreateRepossessionCaseDto,
  ) {
    return this.repossessionService.createCase(orgId, dto);
  }

  @Get('cases')
  listCases(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.repossessionService.listCases(orgId, +page, +limit);
  }

  @Get('cases/:id')
  getCase(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
  ) {
    return this.repossessionService.getCase(orgId, caseId);
  }

  @Patch('cases/:id')
  updateCase(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: UpdateRepossessionCaseDto,
  ) {
    return this.repossessionService.updateCase(orgId, caseId, dto);
  }

  @Post('cases/:id/agent')
  assignAgent(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body('agentId') agentId: string,
  ) {
    return this.repossessionService.assignAgent(orgId, caseId, agentId);
  }

  // -------------------------------------------------------------------------
  // Seizure
  // -------------------------------------------------------------------------

  @Post('cases/:id/seizure')
  recordSeizure(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: RecordSeizureDto,
  ) {
    return this.repossessionService.recordSeizure(orgId, caseId, dto);
  }

  // -------------------------------------------------------------------------
  // Yard
  // -------------------------------------------------------------------------

  @Post('cases/:id/yard')
  yardEntry(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: YardEntryDto,
  ) {
    return this.repossessionService.yardEntry(orgId, caseId, dto);
  }

  // -------------------------------------------------------------------------
  // Auction
  // -------------------------------------------------------------------------

  @Post('cases/:id/auction')
  createAuction(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: CreateAuctionDto,
  ) {
    return this.repossessionService.createAuction(orgId, caseId, dto);
  }

  // -------------------------------------------------------------------------
  // Bids
  // -------------------------------------------------------------------------

  @Post('cases/:id/bids')
  recordBid(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: RecordBidDto,
  ) {
    return this.repossessionService.recordBid(orgId, caseId, dto);
  }

  // -------------------------------------------------------------------------
  // Sale
  // -------------------------------------------------------------------------

  @Post('cases/:id/sale')
  recordSale(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: RecordSaleDto,
  ) {
    return this.repossessionService.recordSale(orgId, caseId, dto);
  }
}
