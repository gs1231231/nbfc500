import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '@bankos/database';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { OrgGuard } from './org.guard';
import { AuditInterceptor } from './audit.interceptor';

// expiresIn must satisfy the ms StringValue type — default '1h' is a valid literal
const jwtExpiry = (process.env['JWT_EXPIRY'] ?? '1h') as '1h';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'bankos-secret',
      signOptions: {
        expiresIn: jwtExpiry,
      },
    }),
    DatabaseModule,
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    OrgGuard,
    AuditInterceptor,
  ],
  exports: [
    JwtModule,
    PassportModule,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    OrgGuard,
    AuditInterceptor,
  ],
})
export class AuthModule {}
