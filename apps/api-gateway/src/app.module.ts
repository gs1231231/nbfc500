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
// Improvements 15-18: Audit Trail, Bulk Operations, Data Export
import { AuditModule } from './audit/audit.module';
import { BulkModule } from './bulk/bulk.module';
import { ExportModule } from './export/export.module';

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
    // Improvements 15-18
    AuditModule,
    BulkModule,
    ExportModule,
  ],
})
export class AppModule {}
