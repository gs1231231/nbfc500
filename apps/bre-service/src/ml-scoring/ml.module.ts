import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MlController],
  providers: [MlService],
  exports: [MlService],
})
export class MlModule {}
