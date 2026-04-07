import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { GlController } from './gl.controller';
import { GlService } from './gl.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GlController],
  providers: [GlService],
  exports: [GlService],
})
export class GlModule {}
