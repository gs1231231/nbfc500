import { Module } from '@nestjs/common';
import { RepossessionService } from './repossession.service';
import { RepossessionController } from './repossession.controller';

@Module({
  controllers: [RepossessionController],
  providers: [RepossessionService],
  exports: [RepossessionService],
})
export class RepossessionModule {}
