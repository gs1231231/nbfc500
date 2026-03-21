import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { BreService } from './bre.service';
import { BreController } from './bre.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [BreController],
  providers: [BreService],
  exports: [BreService],
})
export class BreModule {}
