import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bankos/database';
import { NotificationChannel } from './dto/notification.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Template registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hardcoded notification templates.
 * Variables are delimited as {{variableName}}.
 */
const TEMPLATES: Record<string, string> = {
  emi_reminder:
    'Dear {{customerName}}, your EMI of Rs {{emiAmount}} is due on {{dueDate}}. Please pay to avoid late charges.',
  payment_received:
    'Dear {{customerName}}, we have received your payment of Rs {{amount}}. Thank you.',
  loan_sanctioned:
    'Congratulations {{customerName}}! Your loan of Rs {{sanctionedAmount}} has been sanctioned.',
};

// ─────────────────────────────────────────────────────────────────────────────
// DND window constants
// ─────────────────────────────────────────────────────────────────────────────

/** DND start hour in IST (21:00 = 9 PM) */
const DND_START_HOUR_IST = 21;

/** DND end hour in IST (08:00 = 8 AM) */
const DND_END_HOUR_IST = 8;

/** IST offset from UTC in minutes (UTC+5:30) */
const IST_OFFSET_MINUTES = 330;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  templateCode: string;
  message: string;
  customerId: string;
  orgId: string;
  sentAt: string;
  blockedByDnd?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock channel adapters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock SMS adapter — logs to console.
 * In production, replace with Kaleyra / ValueFirst / AWS SNS integration.
 */
function sendSms(to: string, message: string, logger: Logger): void {
  logger.log(`[SMS ADAPTER] To: ${to} | Message: ${message}`);
}

/**
 * Mock Email adapter — logs to console.
 * In production, replace with SendGrid / AWS SES integration.
 */
function sendEmail(
  to: string,
  subject: string,
  body: string,
  logger: Logger,
): void {
  logger.log(
    `[EMAIL ADAPTER] To: ${to} | Subject: ${subject} | Body: ${body}`,
  );
}

/**
 * Mock WhatsApp adapter — logs to console.
 * In production, replace with Gupshup / Meta Cloud API integration.
 */
function sendWhatsApp(to: string, message: string, logger: Logger): void {
  logger.log(`[WHATSAPP ADAPTER] To: ${to} | Message: ${message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NotificationService — manages customer notification delivery via SMS, Email,
 * and WhatsApp channels with DND compliance and template rendering.
 *
 * DND Policy (per TRAI regulations):
 *   - No SMS or WhatsApp between 9 PM and 8 AM IST
 *   - Email is not subject to DND restrictions
 *
 * Template engine:
 *   - Simple string interpolation: {{variableName}} → value
 *   - Template codes are resolved against a hardcoded registry
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // DND check
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check whether the current IST time falls within the DND window.
   *
   * DND window: 9 PM (21:00 IST) to 8 AM (08:00 IST) the next day.
   * Channels subject to DND: SMS, WHATSAPP.
   *
   * @returns true if sending is blocked by DND, false otherwise
   */
  private isDndActive(): boolean {
    const nowUtc = new Date();
    const nowIst = new Date(nowUtc.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
    const hourIst = nowIst.getUTCHours();

    // DND is active if hour >= 21 OR hour < 8
    return hourIst >= DND_START_HOUR_IST || hourIst < DND_END_HOUR_IST;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Template rendering
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render a notification template by interpolating variables.
   *
   * Replaces all occurrences of {{variableName}} with the corresponding
   * value from the variables map. Unknown placeholders are left as-is.
   *
   * @param templateCode Template identifier key in TEMPLATES registry
   * @param variables    Key-value map of variable substitutions
   * @returns            Rendered message string
   * @throws BadRequestException if the template code is not found
   */
  private renderTemplate(
    templateCode: string,
    variables: Record<string, string>,
  ): string {
    const template = TEMPLATES[templateCode];

    if (!template) {
      throw new BadRequestException(
        `Template '${templateCode}' not found. ` +
          `Available templates: ${Object.keys(TEMPLATES).join(', ')}`,
      );
    }

    return template.replace(
      /\{\{(\w+)\}\}/g,
      (match, key: string) => variables[key] ?? match,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Send notification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a notification to a customer via the specified channel.
   *
   * Flow:
   *  1. Resolve customer from DB to get phone/email
   *  2. Check DND for SMS/WhatsApp channels
   *  3. Render the template with provided variables
   *  4. Dispatch to the mock channel adapter (logs to console)
   *  5. Return result object
   *
   * @param orgId        Organization (tenant) UUID
   * @param customerId   Customer UUID
   * @param channel      Delivery channel (SMS | EMAIL | WHATSAPP)
   * @param templateCode Template code from TEMPLATES registry
   * @param variables    Variables to interpolate into the template
   */
  async sendNotification(
    orgId: string,
    customerId: string,
    channel: NotificationChannel,
    templateCode: string,
    variables: Record<string, string> = {},
  ): Promise<NotificationResult> {
    // 1. Resolve customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer ${customerId} not found for organization ${orgId}`,
      );
    }

    // 2. DND check for SMS and WhatsApp
    const isDndChannel =
      channel === NotificationChannel.SMS ||
      channel === NotificationChannel.WHATSAPP;

    if (isDndChannel && this.isDndActive()) {
      const nowUtc = new Date();
      this.logger.warn(
        `[DND BLOCKED] Channel: ${channel} | Customer: ${customerId} | ` +
          `Time (UTC): ${nowUtc.toISOString()} | Reason: DND window 9 PM–8 AM IST`,
      );

      return {
        success: false,
        channel,
        templateCode,
        message: '',
        customerId,
        orgId,
        sentAt: nowUtc.toISOString(),
        blockedByDnd: true,
      };
    }

    // 3. Render template
    const message = this.renderTemplate(templateCode, variables);

    // 4. Dispatch to mock adapter
    const sentAt = new Date();

    switch (channel) {
      case NotificationChannel.SMS:
        sendSms(customer.phone, message, this.logger);
        break;

      case NotificationChannel.EMAIL:
        if (!customer.email) {
          this.logger.warn(
            `Customer ${customerId} has no email address. Skipping EMAIL notification.`,
          );
          return {
            success: false,
            channel,
            templateCode,
            message,
            customerId,
            orgId,
            sentAt: sentAt.toISOString(),
          };
        }
        sendEmail(
          customer.email,
          this.getEmailSubject(templateCode),
          message,
          this.logger,
        );
        break;

      case NotificationChannel.WHATSAPP:
        sendWhatsApp(customer.phone, message, this.logger);
        break;

      default:
        throw new BadRequestException(
          `Unsupported notification channel: ${channel as string}`,
        );
    }

    this.logger.log(
      `[NOTIFICATION SENT] Channel: ${channel} | Template: ${templateCode} | ` +
        `Customer: ${customerId} | Org: ${orgId}`,
    );

    return {
      success: true,
      channel,
      templateCode,
      message,
      customerId,
      orgId,
      sentAt: sentAt.toISOString(),
      blockedByDnd: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // History (placeholder)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get notification history for a customer.
   *
   * Returns an empty array for MVP — no notification log table exists yet.
   * Future: persist each notification to a notifications table and query here.
   *
   * @param orgId      Organization (tenant) UUID
   * @param customerId Customer UUID
   */
  async getHistory(
    orgId: string,
    customerId: string,
  ): Promise<NotificationResult[]> {
    this.logger.log(
      `getHistory called for customer ${customerId} org ${orgId} — returning empty array (MVP placeholder)`,
    );
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Map template codes to human-readable email subject lines.
   */
  private getEmailSubject(templateCode: string): string {
    const subjects: Record<string, string> = {
      emi_reminder: 'EMI Payment Reminder',
      payment_received: 'Payment Received Confirmation',
      loan_sanctioned: 'Loan Sanctioned — Congratulations!',
    };
    return subjects[templateCode] ?? 'Notification from BankOS';
  }
}
