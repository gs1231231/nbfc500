import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { CommissionService } from './commission.service';
import { CreatePayoutDto, ListPayoutsDto } from './dto/commission.dto';

@Controller('api/v1/commissions')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get('rates')
  listDsaCommissionRates(@Headers('x-org-id') orgId: string) {
    return this.commissionService.listDsaCommissionRates(orgId);
  }

  @Get('loans/:loanId')
  calculateCommission(
    @Headers('x-org-id') orgId: string,
    @Param('loanId') loanId: string,
  ) {
    return this.commissionService.calculateCommission(orgId, loanId);
  }

  @Post('payouts')
  createPayout(
    @Headers('x-org-id') orgId: string,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.commissionService.createPayout(orgId, dto);
  }

  @Get('payouts')
  listPayouts(
    @Headers('x-org-id') orgId: string,
    @Query() query: ListPayoutsDto,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.commissionService.listPayouts(orgId, query, +page, +limit);
  }
}
