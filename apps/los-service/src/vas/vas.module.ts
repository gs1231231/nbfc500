import { Module } from '@nestjs/common';
import { VasService } from './vas.service';
import { VasController } from './vas.controller';

@Module({
  controllers: [VasController],
  providers: [VasService],
  exports: [VasService],
})
export class VasModule {}
