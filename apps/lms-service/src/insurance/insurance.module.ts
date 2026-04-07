import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
