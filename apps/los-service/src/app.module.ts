import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { ApplicationModule } from './application/application.module';
import { CustomerModule } from './customer/customer.module';
import { DocumentModule } from './document/document.module';
import { SanctionModule } from './sanction/sanction.module';
import { DisbursementModule } from './disbursement/disbursement.module';
import { CommissionModule } from './commission/commission.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    ApplicationModule,
    CustomerModule,
    DocumentModule,
    SanctionModule,
    DisbursementModule,
    CommissionModule,
  ],
})
export class AppModule {}
