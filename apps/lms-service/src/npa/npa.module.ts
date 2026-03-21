import { Module } from '@nestjs/common';
import { NpaService } from './npa.service';

@Module({
  providers: [NpaService],
  exports: [NpaService],
})
export class NpaModule {}
