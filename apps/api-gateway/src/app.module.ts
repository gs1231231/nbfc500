import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@bankos/database';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PartnerModule } from './partner-api/partner.module';
import { RealtimeModule } from './realtime/realtime.module';
// GAP 11: 20 Standard MIS Reports
import { ReportsModule } from './reports/reports.module';
// GAP 12: Customer Service, DPDPA, Complaint Management
import { CustomerServiceModule } from './customer-service/customer-service.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    DashboardModule,
    PartnerModule,
    RealtimeModule,
    ReportsModule,
    CustomerServiceModule,
  ],
})
export class AppModule {}
