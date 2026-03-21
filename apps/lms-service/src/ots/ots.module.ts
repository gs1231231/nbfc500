import { Module } from '@nestjs/common';
import { OtsService } from './ots.service';
import { OtsController } from './ots.controller';

@Module({
  controllers: [OtsController],
  providers: [OtsService],
  exports: [OtsService],
})
export class OtsModule {}
