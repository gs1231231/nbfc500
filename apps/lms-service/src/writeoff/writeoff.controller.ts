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
import { WriteoffService } from './writeoff.service';
import {
  InitiateWriteoffDto,
  ApproveWriteoffDto,
  RecordWriteoffRecoveryDto,
} from './dto/writeoff.dto';

@Controller('api/v1/writeoffs')
export class WriteoffController {
  constructor(private readonly writeoffService: WriteoffService) {}

  @Post()
  initiateWriteoff(
    @Headers('x-org-id') orgId: string,
    @Body() dto: InitiateWriteoffDto,
  ) {
    return this.writeoffService.initiateWriteoff(orgId, dto);
  }

  @Get()
  listWriteoffs(
    @Headers('x-org-id') orgId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.writeoffService.listWriteoffs(orgId, +page, +limit);
  }

  @Get(':id')
  getWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
  ) {
    return this.writeoffService.getWriteoff(orgId, writeoffId);
  }

  @Patch(':id/approve')
  approveWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
    @Body() dto: ApproveWriteoffDto,
  ) {
    return this.writeoffService.approveWriteoff(orgId, writeoffId, dto);
  }

  @Post(':id/execute')
  executeWriteoff(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
  ) {
    return this.writeoffService.executeWriteoff(orgId, writeoffId);
  }

  @Post(':id/recovery')
  recordRecovery(
    @Headers('x-org-id') orgId: string,
    @Param('id') writeoffId: string,
    @Body() dto: RecordWriteoffRecoveryDto,
  ) {
    return this.writeoffService.recordRecovery(orgId, writeoffId, dto);
  }
}
