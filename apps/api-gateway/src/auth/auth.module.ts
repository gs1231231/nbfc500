import { Module } from '@nestjs/common';
import { AuthModule as SharedAuthModule } from '@bankos/auth';
import { DatabaseModule } from '@bankos/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SharedAuthModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
