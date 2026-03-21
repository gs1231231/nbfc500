import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@bankos/database';
import { BureauModule } from './bureau.module';
import { CicModule } from './cic/cic.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    BureauModule,
    CicModule,
  ],
})
export class AppModule {}
