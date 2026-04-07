import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { SoaController } from './soa.controller';
import { SoaService } from './soa.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SoaController],
  providers: [SoaService],
  exports: [SoaService],
})
export class SoaModule {}
