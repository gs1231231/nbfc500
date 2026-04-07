import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { WorkflowModule } from '@bankos/workflow';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';

@Module({
  imports: [DatabaseModule, WorkflowModule],
  controllers: [ApplicationController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}
