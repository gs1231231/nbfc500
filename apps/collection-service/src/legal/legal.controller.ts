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
import { LegalService } from './legal.service';
import {
  CreateLegalCaseDto,
  UpdateLegalCaseDto,
  GenerateNoticeDto,
} from './dto/legal.dto';

@Controller('api/v1/legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Post('cases')
  createCase(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreateLegalCaseDto,
  ) {
    return this.legalService.createCase(orgId, dto);
  }

  @Get('cases')
  listCases(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.legalService.listCases(orgId, +page, +limit);
  }

  @Get('cases/:id')
  getCase(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
  ) {
    return this.legalService.getCase(orgId, caseId);
  }

  @Patch('cases/:id/status')
  updateStatus(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: UpdateLegalCaseDto,
  ) {
    return this.legalService.updateStatus(orgId, caseId, dto);
  }

  @Post('cases/:id/notices')
  generateNotice(
    @Headers('x-org-id') orgId: string,
    @Param('id') caseId: string,
    @Body() dto: GenerateNoticeDto,
  ) {
    return this.legalService.generateNotice(orgId, caseId, dto);
  }
}
