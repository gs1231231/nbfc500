/**
 * app.module.prod.ts — Consolidated production module
 *
 * On a t3.small (2 GB RAM) running everything in Docker Compose, launching 9
 * separate Node processes is prohibitively expensive (~150–200 MB each).
 * Instead, this module imports every service's feature modules into a single
 * NestJS process so we pay for V8 / libuv only once.
 *
 * Each feature module is still self-contained (its own controllers, services,
 * repositories); only the process boundary has been removed.
 *
 * Route namespacing is handled by the global prefix 'api/v1' set in
 * main.prod.ts, and each module's controllers use their own @Controller()
 * path decorators (e.g. @Controller('applications'), @Controller('loans')).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// ── Shared infrastructure libs ─────────────────────────────────────────────
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { CustomFieldsModule } from '@bankos/custom-fields';
import { WorkflowModule } from '@bankos/workflow';

// ── API Gateway modules ────────────────────────────────────────────────────
import { HealthModule } from './health/health.module';
import { AuthModule as GatewayAuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PartnerModule } from './partner-api/partner.module';
import { RealtimeModule } from './realtime/realtime.module';

// ── LOS (Loan Origination System) modules ─────────────────────────────────
import { ApplicationModule } from '../../los-service/src/application/application.module';
import { CustomerModule } from '../../los-service/src/customer/customer.module';
import { DocumentModule } from '../../los-service/src/document/document.module';
import { SanctionModule } from '../../los-service/src/sanction/sanction.module';
import { DisbursementModule } from '../../los-service/src/disbursement/disbursement.module';
import { CommissionModule } from '../../los-service/src/commission/commission.module';
import { LeadModule } from '../../los-service/src/lead/lead.module';
import { AaModule } from '../../los-service/src/account-aggregator/aa.module';
import { DocaiModule } from '../../los-service/src/document-ai/docai.module';
// ── LOS Product-Specific Operations (Gap 1–4) ─────────────────────────────
import { GoldLoanModule } from '../../los-service/src/gold-loan/gold-loan.module';
import { VehicleModule } from '../../los-service/src/vehicle-finance/vehicle.module';
import { PropertyModule } from '../../los-service/src/property-loan/property.module';
import { MSMEModule } from '../../los-service/src/msme/msme.module';

// ── LMS (Loan Management System) modules ──────────────────────────────────
import { PaymentModule as LmsPaymentModule } from '../../lms-service/src/payment/payment.module';
import { NpaModule } from '../../lms-service/src/npa/npa.module';
import { AccrualModule } from '../../lms-service/src/accrual/accrual.module';
import { OtsModule } from '../../lms-service/src/ots/ots.module';
import { WriteoffModule } from '../../lms-service/src/writeoff/writeoff.module';
import { LoanModule } from '../../lms-service/src/loan/loan.module';
import { GlModule } from '../../lms-service/src/gl/gl.module';
import { NachModule } from '../../lms-service/src/nach/nach.module';
import { LoanViewerModule } from '../../lms-service/src/loan-viewer/loan-viewer.module';
import { RestructureModule } from '../../lms-service/src/restructure/restructure.module';

// ── BRE (Business Rule Engine) ────────────────────────────────────────────
import { BreModule } from '../../bre-service/src/bre.module';
import { MlModule } from '../../bre-service/src/ml-scoring/ml.module';

// ── Collection ─────────────────────────────────────────────────────────────
import { CollectionModule } from '../../collection-service/src/collection/collection.module';
import { RepossessionModule } from '../../collection-service/src/repossession/repossession.module';
import { LegalModule } from '../../collection-service/src/legal/legal.module';
import { LogsModule } from '../../collection-service/src/logs/logs.module';

// ── Bureau (Credit Bureau) ─────────────────────────────────────────────────
import { BureauModule } from '../../bureau-service/src/bureau.module';
import { CicModule } from '../../bureau-service/src/cic/cic.module';

// ── Notification ───────────────────────────────────────────────────────────
import { NotificationModule } from '../../notification-service/src/notification/notification.module';
import { ChatbotModule } from '../../notification-service/src/chatbot/chatbot.module';

// ── Co-Lending ─────────────────────────────────────────────────────────────
import { CoLendingModule } from '../../colending-service/src/colending/colending.module';

// ── Gap 9: Accounting (Bank Recon, TDS, GST, EIR) ─────────────────────────
import { AccountingModule } from '../../lms-service/src/accounting/accounting.module';
// ── Gap 10: Enhanced Write-Off — already included via WriteoffModule
// ── Gap 11: MIS Reports ────────────────────────────────────────────────────
import { ReportsModule } from './reports/reports.module';
// ── Gap 12: Customer Service + DPDPA ──────────────────────────────────────
import { CustomerServiceModule } from './customer-service/customer-service.module';
// ── Gap 13: MFI Operations ────────────────────────────────────────────────
import { MfiModule } from '../../los-service/src/mfi/mfi.module';
// ── Scheme Master ─────────────────────────────────────────────────────────
import { SchemeModule } from '../../los-service/src/scheme/scheme.module';
// ── VAS / Fee Templates ────────────────────────────────────────────────────
import { VasModule } from '../../los-service/src/vas/vas.module';
// ── Customer Segmentation Engine ──────────────────────────────────────────
import { SegmentationModule } from '../../los-service/src/segmentation/segmentation.module';
// ── Gap 14: Welcome Kit + Annual Communications ───────────────────────────
import { CommunicationsModule } from '../../lms-service/src/communications/communications.module';
// ── Improvements 15-18: Audit Trail, Bulk Operations, Data Export ─────────
import { AuditModule } from './audit/audit.module';
import { BulkModule } from './bulk/bulk.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    // ── Global config (loaded once, isGlobal = true shares across all modules)
    ConfigModule.forRoot({
      isGlobal: true,
      // In production the .env.prod file is bind-mounted or variables are
      // injected by Docker Compose / EC2 user-data.
      envFilePath: ['.env.prod', '.env'],
    }),

    // ── Task scheduling (needed by LMS and Collection cron jobs)
    ScheduleModule.forRoot(),

    // ── Infrastructure
    DatabaseModule,
    AuthModule,

    // ── API Gateway
    HealthModule,
    GatewayAuthModule,
    DashboardModule,
    PartnerModule,
    RealtimeModule,

    // ── LOS
    ApplicationModule,
    CustomerModule,
    DocumentModule,
    SanctionModule,
    DisbursementModule,
    CommissionModule,
    LeadModule,
    AaModule,
    DocaiModule,
    // ── LOS Product-Specific (Gap 1–4)
    GoldLoanModule,
    VehicleModule,
    PropertyModule,
    MSMEModule,

    // ── LMS
    LmsPaymentModule,
    NpaModule,
    AccrualModule,
    OtsModule,
    WriteoffModule,
    LoanModule,
    GlModule,
    NachModule,
    LoanViewerModule,
    RestructureModule,

    // ── BRE
    BreModule,
    MlModule,

    // ── Collection
    CollectionModule,
    RepossessionModule,
    LegalModule,
    LogsModule,

    // ── Bureau
    BureauModule,
    CicModule,

    // ── Notification
    NotificationModule,
    ChatbotModule,

    // ── Co-Lending
    CoLendingModule,

    // ── Custom Fields Engine
    CustomFieldsModule,

    // ── Workflow Engine
    WorkflowModule,

    // ── Gap 9–14
    AccountingModule,
    ReportsModule,
    CustomerServiceModule,
    MfiModule,
    CommunicationsModule,

    // ── Improvements 15-18
    AuditModule,
    BulkModule,
    ExportModule,

    // ── Scheme Master
    SchemeModule,

    // ── VAS / Fee Templates
    VasModule,

    // ── Customer Segmentation Engine
    SegmentationModule,
  ],
})
export class AppModuleProd {}
