import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@bankos/database';
import { CollectionModule } from './collection/collection.module';
import { RepossessionModule } from './repossession/repossession.module';
import { LegalModule } from './legal/legal.module';
import { LogsModule } from './logs/logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CollectionModule,
    RepossessionModule,
    LegalModule,
    LogsModule,
  ],
})
export class AppModule {}
