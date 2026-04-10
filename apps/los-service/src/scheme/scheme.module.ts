import { Module } from '@nestjs/common';
import { SchemeService } from './scheme.service';
import { SchemeController } from './scheme.controller';

@Module({
  controllers: [SchemeController],
  providers: [SchemeService],
  exports: [SchemeService],
})
export class SchemeModule {}
