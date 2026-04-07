import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
