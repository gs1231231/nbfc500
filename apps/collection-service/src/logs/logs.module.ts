import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
