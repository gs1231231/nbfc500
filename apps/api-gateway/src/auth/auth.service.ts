import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@bankos/database';
import * as bcryptjs from 'bcryptjs';
import { randomBytes } from 'crypto';
import { JwtPayload } from '@bankos/auth';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
}

interface ValidatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * In-memory refresh token store. Key: refresh token, Value: userId.
   * In production, replace with Redis using ioredis.
   */
  private readonly refreshTokenStore = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcryptjs.compare(password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp (fire-and-forget)
    this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch((err) => this.logger.warn('Failed to update lastLoginAt', err));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      roles: user.userRoles.map((ur) => ur.role.code),
    };
  }

  async login(user: ValidatedUser): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserProfile;
  }> {
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.organizationId,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles: user.roles,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const userId = this.refreshTokenStore.get(refreshToken);

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
    });

    if (!user) {
      this.refreshTokenStore.delete(refreshToken);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: revoke old token and issue new pair
    this.refreshTokenStore.delete(refreshToken);

    return this.generateTokens(user.id, user.organizationId);
  }

  async logout(refreshToken: string): Promise<void> {
    this.refreshTokenStore.delete(refreshToken);
  }

  private async generateTokens(
    userId: string,
    orgId: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, orgId };

    const accessToken = await this.jwtService.signAsync(payload);

    // Refresh token is a random opaque token (256-bit hex)
    const refreshToken = randomBytes(32).toString('hex');

    // Store with 7-day TTL simulation (just store for now; eviction handled on use)
    this.refreshTokenStore.set(refreshToken, userId);

    return { accessToken, refreshToken };
  }
}
