import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { RateController } from './rate.controller';
import { RateService } from './rate.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RateController],
  providers: [RateService],
  exports: [RateService],
})
export class RateModule {}
