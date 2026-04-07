import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { WorkflowService } from './workflow.service';
import { WorkflowController, ApplicationWorkflowController } from './workflow.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkflowController, ApplicationWorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
