import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@bankos/database';

export interface JwtPayload {
  sub: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  orgId: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'bankos-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.orgId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);

    return {
      userId: user.id,
      orgId: user.organizationId,
      roles,
    };
  }
}
