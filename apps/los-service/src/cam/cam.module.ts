import { Module } from '@nestjs/common';
import { DatabaseModule } from '@bankos/database';
import { CamController } from './cam.controller';
import { CamService } from './cam.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CamController],
  providers: [CamService],
  exports: [CamService],
})
export class CamModule {}
