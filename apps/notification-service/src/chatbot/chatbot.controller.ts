import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ChatbotService,
  WhatsAppWebhookPayload,
} from './chatbot.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/chatbot')
export class ChatbotController {
  private readonly logger = new Logger(ChatbotController.name);

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /api/v1/chatbot/webhook
   * WhatsApp webhook verification challenge (required by Meta).
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
      'bankos_webhook_verify_token',
    );

    const result = this.chatbotService.verifyWebhook(
      mode,
      token,
      challenge,
      verifyToken,
    );

    if (result) {
      return res.status(HttpStatus.OK).send(result);
    }

    this.logger.warn('WhatsApp webhook verification failed');
    return res.status(HttpStatus.FORBIDDEN).json({ error: 'Verification failed' });
  }

  /**
   * POST /api/v1/chatbot/webhook
   * Receives incoming WhatsApp messages from Meta Cloud API.
   * Must return 200 quickly to avoid retry loops.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveMessage(@Body() payload: WhatsAppWebhookPayload) {
    this.logger.log('WhatsApp webhook received');

    try {
      const result = await this.chatbotService.handleWebhook(payload);

      if (result.response) {
        this.logger.log(
          `Chatbot response for ${result.senderPhone}: command=${result.command}`,
        );
        // In production: call WhatsApp Business API to send the response message
        // await this.whatsappApiClient.sendMessage(result.senderPhone, result.response);
      }

      return { status: 'ok' };
    } catch (err) {
      // Never throw from webhook — return 200 to prevent Meta retries
      this.logger.error('Chatbot webhook processing error', err);
      return { status: 'ok' };
    }
  }

  /**
   * POST /api/v1/chatbot/test
   * Test endpoint to simulate chatbot commands without WhatsApp.
   */
  @Post('test')
  async testCommand(
    @Body('phone') phone: string,
    @Body('message') message: string,
  ) {
    const mockPayload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'mock-entry',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '18001234567',
                  phone_number_id: 'mock-phone-id',
                },
                messages: [
                  {
                    id: `mock-msg-${Date.now()}`,
                    from: phone ?? '919876543210',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: message ?? 'help' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    return this.chatbotService.handleWebhook(mockPayload);
  }
}
