import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { LoanViewerController } from './loan-viewer.controller';
import { LoanViewerService } from './loan-viewer.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LoanViewerController],
  providers: [LoanViewerService],
  exports: [LoanViewerService],
})
export class LoanViewerModule {}
