import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { AuthModule } from '@bankos/auth';
import { AaController } from './aa.controller';
import { AaService } from './aa.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AaController],
  providers: [AaService],
  exports: [AaService],
})
export class AaModule {}
