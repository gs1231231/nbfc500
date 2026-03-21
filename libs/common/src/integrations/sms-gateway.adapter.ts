/**
 * Prompt 37 - SMS Gateway Adapter
 * MSG91 SMS API integration for OTP and transactional SMS.
 * Mock logs to console; real adapter uses MSG91 REST API.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SmsType = 'OTP' | 'TRANSACTIONAL' | 'PROMOTIONAL';

export interface SendSmsRequest {
  /** Phone number with country code, e.g. +919876543210 */
  phone: string;
  /** SMS message body (used if no templateId) */
  message: string;
  /** MSG91 DLT-registered template ID */
  templateId?: string;
  /** Variable substitutions for template */
  variables?: Record<string, string>;
  /** Default: TRANSACTIONAL */
  smsType?: SmsType;
  /** Sender ID (6-char DLT registered) */
  senderId?: string;
}

export interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'QUEUED' | 'FAILED' | 'INVALID_NUMBER';
  message: string;
  /** Provider-assigned request ID for delivery tracking */
  requestId?: string;
  sentAt: string;
}

export interface SmsDeliveryStatus {
  messageId: string;
  phone: string;
  status: 'DELIVERED' | 'SENT' | 'FAILED' | 'PENDING';
  deliveredAt?: string;
  failureReason?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface ISmsGatewayAdapter {
  /**
   * Send an SMS to a phone number.
   * Use templateId for DLT-compliant transactional SMS.
   */
  send(phone: string, message: string, templateId?: string): Promise<SendSmsResponse>;

  /**
   * Send using full request object for more control.
   */
  sendWithOptions(request: SendSmsRequest): Promise<SendSmsResponse>;

  /**
   * Check delivery status of a sent message.
   */
  getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockSmsGatewayAdapter implements ISmsGatewayAdapter {
  async send(phone: string, message: string, templateId?: string): Promise<SendSmsResponse> {
    return this.sendWithOptions({ phone, message, templateId });
  }

  async sendWithOptions(request: SendSmsRequest): Promise<SendSmsResponse> {
    const messageId = `MSG${Date.now()}`;
    console.log(
      `[MockSMS] ` +
        `To: ${request.phone} | ` +
        `TemplateId: ${request.templateId ?? 'none'} | ` +
        `Type: ${request.smsType ?? 'TRANSACTIONAL'} | ` +
        `Message: ${request.message}`,
    );
    return {
      success: true,
      messageId,
      status: 'SENT',
      message: 'SMS sent successfully (mock)',
      requestId: `REQ${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }

  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus> {
    return {
      messageId,
      phone: 'UNKNOWN',
      status: 'DELIVERED',
      deliveredAt: new Date().toISOString(),
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealSmsGatewayAdapter implements ISmsGatewayAdapter {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl = 'https://api.msg91.com/api/v5';

  constructor() {
    this.apiKey = process.env.MSG91_API_KEY ?? '';
    this.senderId = process.env.MSG91_SENDER_ID ?? 'BANKOS';
  }

  async send(_phone: string, _message: string, _templateId?: string): Promise<SendSmsResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealSmsGatewayAdapter requires MSG91 credentials. ' +
        'Set MSG91_API_KEY, MSG91_SENDER_ID, and SMS_ADAPTER=real.',
    );
  }
  async sendWithOptions(_request: SendSmsRequest): Promise<SendSmsResponse> {
    throw new Error('NOT_IMPLEMENTED: RealSmsGatewayAdapter.sendWithOptions()');
  }
  async getDeliveryStatus(_messageId: string): Promise<SmsDeliveryStatus> {
    throw new Error('NOT_IMPLEMENTED: RealSmsGatewayAdapter.getDeliveryStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createSmsGatewayAdapter(): ISmsGatewayAdapter {
  if (process.env.SMS_ADAPTER === 'real') {
    return new RealSmsGatewayAdapter();
  }
  return new MockSmsGatewayAdapter();
}
