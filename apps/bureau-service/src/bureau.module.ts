import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { BureauService } from './bureau.service';
import { BureauController } from './bureau.controller';
import { MockBureauAdapter } from './adapters/mock-bureau.adapter';
import { CibilBureauAdapter } from './adapters/cibil-bureau.adapter';

/**
 * BureauModule — encapsulates all credit bureau functionality.
 *
 * Provides:
 *  - BureauService: orchestrates pulls, caching, and persistence
 *  - BureauController: HTTP endpoints for triggering pulls and fetching reports
 *
 * Adapters:
 *  - MockBureauAdapter: deterministic, PAN-seeded mock (used in dev/test)
 *  - CibilBureauAdapter: production CIBIL stub (not yet implemented)
 *
 * The active adapter is selected at runtime via the BUREAU_ADAPTER env var:
 *   BUREAU_ADAPTER=mock   → MockBureauAdapter (default)
 *   BUREAU_ADAPTER=cibil  → CibilBureauAdapter
 *
 * DatabaseModule is imported here to make PrismaService available.
 * Since DatabaseModule is @Global(), it is sufficient to import it once
 * in AppModule, but importing it here keeps BureauModule self-contained.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    BureauService,
    MockBureauAdapter,
    CibilBureauAdapter,
  ],
  controllers: [BureauController],
  exports: [BureauService],
})
export class BureauModule {}
