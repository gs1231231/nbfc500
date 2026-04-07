import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@bankos/database';
import { PaymentModule } from './payment/payment.module';
import { NpaModule } from './npa/npa.module';
import { AccrualModule } from './accrual/accrual.module';
import { OtsModule } from './ots/ots.module';
import { WriteoffModule } from './writeoff/writeoff.module';
import { LoanModule } from './loan/loan.module';
import { GlModule } from './gl/gl.module';
import { NachModule } from './nach/nach.module';
import { LoanViewerModule } from './loan-viewer/loan-viewer.module';
import { RestructureModule } from './restructure/restructure.module';
import { SoaModule } from './soa/soa.module';
import { TreasuryModule } from './treasury/treasury.module';
import { RateModule } from './rate-management/rate.module';
import { InsuranceModule } from './insurance/insurance.module';
// GAP 9: Bank Reconciliation, TDS, GST, EIR
import { AccountingModule } from './accounting/accounting.module';
// GAP 14: Welcome Kit, Annual Statements, Rate Change Notices
import { CommunicationsModule } from './communications/communications.module';

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
    LoanModule,
    GlModule,
    NachModule,
    LoanViewerModule,
    RestructureModule,
    SoaModule,
    TreasuryModule,
    RateModule,
    InsuranceModule,
    AccountingModule,
    CommunicationsModule,
  ],
})
export class AppModule {}
