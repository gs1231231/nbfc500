/**
 * main.prod.ts — Production entry point for the consolidated BankOS backend.
 *
 * Boots the AppModuleProd which aggregates all service modules into a single
 * NestJS process optimised for a t3.small (2 GB RAM) EC2 instance.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModuleProd } from './app.module.prod';

async function bootstrap() {
  const logger = new Logger('BankOS');

  const app = await NestFactory.create(AppModuleProd, {
    // Reduce noise; set LOG_LEVEL=debug in .env.prod to get verbose output
    logger:
      process.env.LOG_LEVEL === 'debug'
        ? ['log', 'debug', 'error', 'warn', 'verbose']
        : ['log', 'error', 'warn'],
  });

  // ── Global prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation pipe ────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────
  // In production nginx handles CORS headers; enabling here as a fallback
  // for direct API access during debugging.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────
  // Available at /api/docs — useful for internal team even in production.
  // Protect with nginx basic-auth or VPN if needed.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BankOS API')
    .setDescription(
      'Consolidated NBFC lending platform API — LOS, LMS, BRE, Collection, Bureau, Notification, Co-Lending',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('auth', 'Authentication & authorisation')
    .addTag('applications', 'Loan origination')
    .addTag('customers', 'Customer management')
    .addTag('documents', 'Document vault')
    .addTag('sanctions', 'Loan sanction')
    .addTag('disbursements', 'Disbursement management')
    .addTag('loans', 'Loan management (LMS)')
    .addTag('payments', 'Payment processing')
    .addTag('bre', 'Business rule evaluation')
    .addTag('collection', 'Collections & recovery')
    .addTag('bureau', 'Credit bureau integration')
    .addTag('notifications', 'Alerts & messaging')
    .addTag('colending', 'Co-lending partner management')
    .addTag('health', 'Service health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Start ──────────────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`BankOS API (consolidated) listening on port ${port}`);
  logger.log(`Swagger docs → http://localhost:${port}/api/docs`);
  logger.log(`Environment  → ${process.env.NODE_ENV ?? 'production'}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
