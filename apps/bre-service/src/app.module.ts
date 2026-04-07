import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@bankos/database';
import { BreModule } from './bre.module';
import { MlModule } from './ml-scoring/ml.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    BreModule,
    MlModule,
  ],
})
export class AppModule {}
