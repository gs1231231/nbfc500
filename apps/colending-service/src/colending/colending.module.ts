import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { CoLendingService } from './colending.service';
import { CoLendingController } from './colending.controller';

/**
 * CoLendingModule — encapsulates all co-lending functionality.
 *
 * Provides:
 *  - CoLendingService: partner CRUD, allocation, disbursement, settlement, portfolio
 *  - CoLendingController: REST endpoints at /api/v1/colending
 *
 * RBI co-lending model compliance:
 *  - MRR (Minimum Risk Retention): NBFC retains at least 10% of each loan
 *  - Blended rate calculation: (bankRate*bankShare + nbfcRate*nbfcShare) / 100
 *  - DLG utilization tracking per partner
 */
@Module({
  imports: [DatabaseModule],
  providers: [CoLendingService],
  controllers: [CoLendingController],
  exports: [CoLendingService],
})
export class CoLendingModule {}
