import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DisbursementController],
  providers: [DisbursementService],
  exports: [DisbursementService],
})
export class DisbursementModule {}
