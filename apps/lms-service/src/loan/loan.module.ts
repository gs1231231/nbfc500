import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LoanController],
  providers: [LoanService],
  exports: [LoanService],
})
export class LoanModule {}
