import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { MSMEController } from './msme.controller';
import { MSMEService } from './msme.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MSMEController],
  providers: [MSMEService],
  exports: [MSMEService],
})
export class MSMEModule {}
