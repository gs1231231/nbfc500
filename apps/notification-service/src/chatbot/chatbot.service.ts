import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

/**
 * WhatsApp Chatbot Service
 *
 * Handles incoming WhatsApp messages via webhook and dispatches command responses.
 *
 * Supported commands:
 *   "balance"   — Return outstanding amount across active loans
 *   "statement" — Return last 5 transactions
 *   "pay"       — Return UPI payment link for next EMI
 *   "help"      — List available commands
 *
 * In production this integrates with WhatsApp Business API (Meta Cloud API).
 * For MVP the webhook payload parsing follows the standard WhatsApp webhook schema.
 */

const UPI_VPA = 'bankos@hdfc'; // Mock VPA for UPI payment links

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process incoming webhook from WhatsApp Business API.
   * Returns a response message for the sender.
   */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<WebhookResponse> {
    // Extract message details from WhatsApp webhook schema
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) {
      this.logger.debug('Webhook received with no message — skipping');
      return { status: 'no_message' };
    }

    const senderPhone = message.from; // E.164 format, e.g., "919876543210"
    const messageText = (message.text?.body ?? '').trim().toLowerCase();
    const messageId = message.id;

    this.logger.log(`Chatbot message from ${senderPhone}: "${messageText}"`);

    // Parse and dispatch command
    const responseText = await this.dispatchCommand(senderPhone, messageText);

    return {
      status: 'processed',
      messageId,
      senderPhone,
      command: this.extractCommand(messageText),
      response: responseText,
    };
  }

  /**
   * Handle simple text verification challenge (WhatsApp webhook setup).
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string,
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return challenge;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Command Dispatcher
  // -------------------------------------------------------------------------

  private async dispatchCommand(
    senderPhone: string,
    messageText: string,
  ): Promise<string> {
    const command = this.extractCommand(messageText);

    switch (command) {
      case 'balance':
        return this.handleBalance(senderPhone);
      case 'statement':
        return this.handleStatement(senderPhone);
      case 'pay':
        return this.handlePay(senderPhone);
      case 'help':
        return this.handleHelp();
      default:
        return this.handleUnknown(messageText);
    }
  }

  private extractCommand(text: string): string {
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('balance') || lower === 'bal') return 'balance';
    if (lower.startsWith('statement') || lower === 'stmt') return 'statement';
    if (lower.startsWith('pay') || lower === 'payment') return 'pay';
    if (lower === 'help' || lower === 'hi' || lower === 'hello') return 'help';
    return 'unknown';
  }

  // -------------------------------------------------------------------------
  // Command Handlers
  // -------------------------------------------------------------------------

  /**
   * "balance" — Return outstanding amount across all active loans for the customer.
   */
  private async handleBalance(senderPhone: string): Promise<string> {
    const customer = await this.findCustomerByPhone(senderPhone);

    if (!customer) {
      return this.formatMessage(
        'Account Not Found',
        'We could not find an account linked to this mobile number.\n\n' +
          'Please contact our support team:\n📞 1800-123-4567',
      );
    }

    const loans = await this.prisma.loan.findMany({
      where: {
        customerId: customer.id,
        loanStatus: 'ACTIVE',
      },
      select: {
        loanNumber: true,
        outstandingPrincipalPaisa: true,
        outstandingInterestPaisa: true,
        totalOverduePaisa: true,
        dpd: true,
        emiAmountPaisa: true,
      },
    });

    if (loans.length === 0) {
      return this.formatMessage(
        'Balance',
        `Hi ${customer.firstName}! 👋\n\nYou have no active loans at this time.`,
      );
    }

    const totalOutstanding = loans.reduce(
      (s, l) => s + l.outstandingPrincipalPaisa + l.outstandingInterestPaisa,
      0,
    );
    const totalOverdue = loans.reduce((s, l) => s + l.totalOverduePaisa, 0);

    let response = `Hi ${customer.firstName}! 👋\n\n*📊 Loan Balance Summary*\n\n`;

    for (const loan of loans) {
      const outstanding =
        (loan.outstandingPrincipalPaisa + loan.outstandingInterestPaisa) / 100;
      response += `🏦 *${loan.loanNumber}*\n`;
      response += `   Outstanding: ₹${outstanding.toLocaleString('en-IN')}\n`;
      if (loan.dpd > 0) {
        response += `   ⚠️ Overdue by ${loan.dpd} days\n`;
      }
      response += '\n';
    }

    response += `*Total Outstanding: ₹${(totalOutstanding / 100).toLocaleString('en-IN')}*`;

    if (totalOverdue > 0) {
      response += `\n⚠️ Total Overdue: ₹${(totalOverdue / 100).toLocaleString('en-IN')}`;
    }

    response += '\n\nType *pay* to make a payment or *help* for more options.';

    return response;
  }

  /**
   * "statement" — Return last 5 transactions.
   */
  private async handleStatement(senderPhone: string): Promise<string> {
    const customer = await this.findCustomerByPhone(senderPhone);

    if (!customer) {
      return this.formatMessage(
        'Account Not Found',
        'We could not find an account linked to this mobile number.\n' +
          'Please call 1800-123-4567 for assistance.',
      );
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        loan: { customerId: customer.id },
        status: 'SUCCESS',
      },
      orderBy: { paymentDate: 'desc' },
      take: 5,
      select: {
        paymentNumber: true,
        amountPaisa: true,
        paymentDate: true,
        paymentMode: true,
        loan: { select: { loanNumber: true } },
      },
    });

    if (payments.length === 0) {
      return this.formatMessage(
        'Statement',
        `Hi ${customer.firstName}! 👋\n\nNo payment transactions found.`,
      );
    }

    let response = `Hi ${customer.firstName}! 👋\n\n*📜 Last ${payments.length} Transactions*\n\n`;

    for (const p of payments) {
      const date = new Date(p.paymentDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const amount = (p.amountPaisa / 100).toLocaleString('en-IN');
      response += `✅ ₹${amount} — ${date}\n`;
      response += `   ${p.loan.loanNumber} · ${p.paymentMode}\n\n`;
    }

    response += 'Type *balance* to check outstanding or *pay* to make a payment.';

    return response;
  }

  /**
   * "pay" — Return UPI payment link for the next EMI due.
   */
  private async handlePay(senderPhone: string): Promise<string> {
    const customer = await this.findCustomerByPhone(senderPhone);

    if (!customer) {
      return this.formatMessage(
        'Account Not Found',
        'We could not find an account linked to this mobile number.\n' +
          'Please call 1800-123-4567 for assistance.',
      );
    }

    const loans = await this.prisma.loan.findMany({
      where: {
        customerId: customer.id,
        loanStatus: 'ACTIVE',
      },
      include: {
        schedules: {
          where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { installmentNumber: 'asc' },
          take: 1,
        },
      },
    });

    if (loans.length === 0) {
      return this.formatMessage(
        'Payment',
        `Hi ${customer.firstName}! 👋\n\nYou have no active loans requiring payment.`,
      );
    }

    let response = `Hi ${customer.firstName}! 👋\n\n*💳 Payment Links*\n\n`;

    for (const loan of loans) {
      const nextInstallment = loan.schedules[0];
      if (!nextInstallment) continue;

      const emiAmount = loan.emiAmountPaisa / 100;
      const upiLink = `upi://pay?pa=${UPI_VPA}&am=${emiAmount}&tn=EMI+${loan.loanNumber}&cu=INR`;
      const dueDate = new Date(nextInstallment.dueDate).toLocaleDateString(
        'en-IN',
        { day: 'numeric', month: 'short', year: 'numeric' },
      );

      response += `🏦 *${loan.loanNumber}*\n`;
      response += `   EMI: ₹${emiAmount.toLocaleString('en-IN')}\n`;
      response += `   Due: ${dueDate}\n`;
      response += `   Pay via UPI:\n`;
      response += `   ${upiLink}\n\n`;
    }

    response +=
      '*How to pay:*\n' +
      '1. Click the UPI link above\n' +
      '2. Opens in any UPI app (GPay, PhonePe, BHIM)\n' +
      '3. Confirm payment\n\n' +
      'Or visit bankos.in/portal for online payment.\n\n' +
      'Type *balance* to check your outstanding amount.';

    return response;
  }

  /**
   * "help" — List all available commands.
   */
  private handleHelp(): string {
    return (
      '*🤖 BankOS WhatsApp Bot*\n\n' +
      'Here\'s how I can help you:\n\n' +
      '📊 *balance* — Check outstanding loan balance\n' +
      '📜 *statement* — View last 5 transactions\n' +
      '💳 *pay* — Get UPI payment link for EMI\n' +
      '❓ *help* — Show this menu\n\n' +
      '─────────────────\n' +
      '📞 *Support:* 1800-123-4567 (Toll Free)\n' +
      '🌐 *Portal:* bankos.in/portal\n' +
      '⏰ *Hours:* Mon–Sat, 9 AM – 6 PM\n\n' +
      '_Powered by BankOS NBFC Platform_'
    );
  }

  /**
   * Unknown command handler.
   */
  private handleUnknown(text: string): string {
    const truncated = text.slice(0, 30);
    return (
      `I didn't understand "${truncated}". 🤔\n\n` +
      'Type *help* to see all available commands.\n\n' +
      'Quick commands:\n' +
      '• *balance* — Check balance\n' +
      '• *pay* — Make a payment\n' +
      '• *statement* — View transactions'
    );
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async findCustomerByPhone(whatsappPhone: string) {
    // WhatsApp sends phone in E.164 without '+': e.g. "919876543210"
    // Our DB stores as "9876543210" (10 digits) or "+919876543210"
    const normalizedPhone = whatsappPhone.replace(/^91/, ''); // strip country code

    return this.prisma.customer.findFirst({
      where: {
        phone: { contains: normalizedPhone },
      },
      select: {
        id: true,
        firstName: true,
        fullName: true,
        customerNumber: true,
        organizationId: true,
      },
    });
  }

  private formatMessage(title: string, body: string): string {
    return `*${title}*\n\n${body}`;
  }
}

// -------------------------------------------------------------------------
// WhatsApp Webhook Types (Meta Cloud API schema)
// -------------------------------------------------------------------------

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WebhookResponse {
  status: string;
  messageId?: string;
  senderPhone?: string;
  command?: string;
  response?: string;
}
