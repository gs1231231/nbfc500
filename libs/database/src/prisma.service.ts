import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'info' },
              { emit: 'event', level: 'warn' },
              { emit: 'event', level: 'error' },
            ]
          : [
              { emit: 'event', level: 'warn' },
              { emit: 'event', level: 'error' },
            ],
      errorFormat: 'colorless',
    });

    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (event: QueryEvent) => {
        this.logger.debug(
          `Query: ${event.query} | Params: ${event.params} | Duration: ${event.duration}ms`,
        );
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('warn', (event: LogEvent) => {
      this.logger.warn(event.message);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('error', (event: LogEvent) => {
      this.logger.error(event.message);
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    try {
      await this.$connect();
      this.logger.log('Database connection established.');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed.');
  }

  /**
   * Utility for integration tests — truncates all tables in the correct order
   * to avoid FK constraint violations.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('cleanDatabase() must not be called in production.');
    }

    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ');

    if (tables.length > 0) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  }
}

// ---------------------------------------------------------------------------
// Prisma log event types (not exported from @prisma/client by default)
// ---------------------------------------------------------------------------

interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface LogEvent {
  timestamp: Date;
  message: string;
  target: string;
}
