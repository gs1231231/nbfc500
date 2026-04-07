import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { GoldLoanController } from './gold-loan.controller';
import { GoldLoanService } from './gold-loan.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GoldLoanController],
  providers: [GoldLoanService],
  exports: [GoldLoanService],
})
export class GoldLoanModule {}
