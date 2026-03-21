import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

/**
 * NotificationModule — encapsulates all customer notification functionality.
 *
 * Provides:
 *  - NotificationService: template rendering, DND enforcement, mock channel adapters
 *  - NotificationController: REST endpoints at /api/v1/notifications
 *
 * Channels (all mock for MVP — log to console):
 *  - SMS: via sendSms() adapter
 *  - Email: via sendEmail() adapter
 *  - WhatsApp: via sendWhatsApp() adapter
 *
 * Templates (hardcoded):
 *  - emi_reminder
 *  - payment_received
 *  - loan_sanctioned
 *
 * DND policy: no SMS or WhatsApp between 9 PM and 8 AM IST (per TRAI regulations).
 */
@Module({
  imports: [DatabaseModule],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
