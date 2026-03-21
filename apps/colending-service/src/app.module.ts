import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@bankos/database';
import { CoLendingModule } from './colending/colending.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    CoLendingModule,
  ],
})
export class AppModule {}
