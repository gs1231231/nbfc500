import { Module } from '@nestjs/common';
import { AccrualService } from './accrual.service';

@Module({
  providers: [AccrualService],
  exports: [AccrualService],
})
export class AccrualModule {}
