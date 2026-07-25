import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthTokens, LoginDto, RegisterDto, UserProfile } from '@video-remix/shared-types';
import { UsersService } from '../users/users.service';
import type { User } from '../../../generated/prisma/client';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const SALT_ROUNDS = 10;

// Refresh tokens are long, high-entropy JWTs (not user-chosen secrets), so a
// fast SHA-256 digest + constant-time compare is used instead of bcrypt.
// bcrypt truncates input at 72 bytes, and JWTs for the same user share an
// identical header + `sub` prefix that alone can exceed that limit, which
// would make bcrypt.compare falsely match distinct rotated tokens.
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshTokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRefreshToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create(dto.email, passwordHash);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Invalid refresh token');

    if (!refreshTokenMatches(refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async me(userId: string): Promise<UserProfile> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TOKEN_TTL },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: REFRESH_TOKEN_TTL },
    );

    await this.usersService.setRefreshTokenHash(user.id, hashRefreshToken(refreshToken));

    return { accessToken, refreshToken, user: this.toProfile(user) };
  }

  private toProfile(user: User): UserProfile {
    return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
  }
}
