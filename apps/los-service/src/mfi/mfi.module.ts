import { Module } from '@nestjs/common';
import { MfiService } from './mfi.service';
import { MfiController } from './mfi.controller';

@Module({
  controllers: [MfiController],
  providers: [MfiService],
  exports: [MfiService],
})
export class MfiModule {}
