import { Module } from '@nestjs/common';
import { WriteoffService } from './writeoff.service';
import { WriteoffController } from './writeoff.controller';

@Module({
  controllers: [WriteoffController],
  providers: [WriteoffService],
  exports: [WriteoffService],
})
export class WriteoffModule {}
