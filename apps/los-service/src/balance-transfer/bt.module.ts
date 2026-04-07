import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { BtController } from './bt.controller';
import { BtService } from './bt.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BtController],
  providers: [BtService],
  exports: [BtService],
})
export class BtModule {}
