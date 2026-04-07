import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { NachController } from './nach.controller';
import { NachService } from './nach.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NachController],
  providers: [NachService],
  exports: [NachService],
})
export class NachModule {}
