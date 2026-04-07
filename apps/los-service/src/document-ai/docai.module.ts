import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { DocaiController } from './docai.controller';
import { DocaiService } from './docai.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DocaiController],
  providers: [DocaiService],
  exports: [DocaiService],
})
export class DocaiModule {}
