/**
 * Prompt 38 - WhatsApp Business API Adapter
 * Meta WhatsApp Business API for loan notifications and collections.
 * Mock logs to console; real adapter uses Meta Graph API.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video' | 'currency' | 'date_time';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename?: string };
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
  }>;
}

export interface SendTemplateRequest {
  /** Phone with country code, e.g. 919876543210 (no +) */
  phone: string;
  /** Approved WhatsApp template name */
  templateName: string;
  /** Template language code */
  languageCode?: string; // e.g. 'en_IN', 'hi', 'te'
  /** Template variable substitutions */
  params: string[];
  /** Optional media for header component */
  headerMedia?: {
    type: 'image' | 'document' | 'video';
    url: string;
    filename?: string;
  };
}

export interface SendTextRequest {
  phone: string;
  message: string;
  /** Preview URL in messages */
  previewUrl?: boolean;
}

export interface WhatsAppMessageResponse {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  message: string;
  sentAt: string;
}

export interface WhatsAppDeliveryStatus {
  messageId: string;
  phone: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface IWhatsAppAdapter {
  /**
   * Send an approved WhatsApp template message.
   * Templates must be pre-approved by Meta.
   */
  sendTemplate(phone: string, templateName: string, params: string[]): Promise<WhatsAppMessageResponse>;

  /**
   * Send a free-form text message (only within 24hr conversation window).
   */
  sendText(request: SendTextRequest): Promise<WhatsAppMessageResponse>;

  /**
   * Get delivery/read status of a sent message.
   */
  getMessageStatus(messageId: string): Promise<WhatsAppDeliveryStatus>;
}

// ─── Mock Adapter ──────────────────────────────────────────────────────────────

export class MockWhatsAppAdapter implements IWhatsAppAdapter {
  async sendTemplate(phone: string, templateName: string, params: string[]): Promise<WhatsAppMessageResponse> {
    const messageId = `WA${Date.now()}`;
    console.log(
      `[MockWhatsApp] Template: ${templateName} | ` +
        `To: ${phone} | ` +
        `Params: [${params.join(', ')}]`,
    );
    return {
      success: true,
      messageId,
      status: 'SENT',
      message: 'WhatsApp template message sent (mock)',
      sentAt: new Date().toISOString(),
    };
  }

  async sendText(request: SendTextRequest): Promise<WhatsAppMessageResponse> {
    const messageId = `WA${Date.now()}`;
    console.log(`[MockWhatsApp] Text message to ${request.phone}: ${request.message}`);
    return {
      success: true,
      messageId,
      status: 'SENT',
      message: 'WhatsApp text message sent (mock)',
      sentAt: new Date().toISOString(),
    };
  }

  async getMessageStatus(messageId: string): Promise<WhatsAppDeliveryStatus> {
    return {
      messageId,
      phone: 'UNKNOWN',
      status: 'DELIVERED',
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Real Adapter Stub ─────────────────────────────────────────────────────────

export class RealWhatsAppAdapter implements IWhatsAppAdapter {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    this.phoneNumberId = process.env.WA_PHONE_NUMBER_ID ?? '';
    this.accessToken = process.env.WA_ACCESS_TOKEN ?? '';
  }

  async sendTemplate(_phone: string, _templateName: string, _params: string[]): Promise<WhatsAppMessageResponse> {
    throw new Error(
      'NOT_IMPLEMENTED: RealWhatsAppAdapter requires Meta Business API credentials. ' +
        'Set WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_BUSINESS_ACCOUNT_ID, and WHATSAPP_ADAPTER=real.',
    );
  }
  async sendText(_request: SendTextRequest): Promise<WhatsAppMessageResponse> {
    throw new Error('NOT_IMPLEMENTED: RealWhatsAppAdapter.sendText()');
  }
  async getMessageStatus(_messageId: string): Promise<WhatsAppDeliveryStatus> {
    throw new Error('NOT_IMPLEMENTED: RealWhatsAppAdapter.getMessageStatus()');
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createWhatsAppAdapter(): IWhatsAppAdapter {
  if (process.env.WHATSAPP_ADAPTER === 'real') {
    return new RealWhatsAppAdapter();
  }
  return new MockWhatsAppAdapter();
}
