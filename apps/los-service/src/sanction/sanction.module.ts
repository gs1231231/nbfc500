import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { SanctionController } from './sanction.controller';
import { SanctionService } from './sanction.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SanctionController],
  providers: [SanctionService],
  exports: [SanctionService],
})
export class SanctionModule {}
