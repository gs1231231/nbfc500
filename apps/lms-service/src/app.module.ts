import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@bankos/database';
import { PaymentModule } from './payment/payment.module';
import { NpaModule } from './npa/npa.module';
import { AccrualModule } from './accrual/accrual.module';
import { OtsModule } from './ots/ots.module';
import { WriteoffModule } from './writeoff/writeoff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    PaymentModule,
    NpaModule,
    AccrualModule,
    OtsModule,
    WriteoffModule,
  ],
})
export class AppModule {}
