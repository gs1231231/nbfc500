import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { RestructureController } from './restructure.controller';
import { RestructureService } from './restructure.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RestructureController],
  providers: [RestructureService],
  exports: [RestructureService],
})
export class RestructureModule {}
