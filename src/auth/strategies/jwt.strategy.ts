import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../../common/config/cookie.config';

export interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Custom extractor: tries HTTP-only cookie first, then Authorization header.
 * This provides backwards compatibility during the migration period.
 */
function cookieOrHeaderExtractor(req: Request): string | null {
  // 1. Try cookie first
  const cookies = req?.cookies as Record<string, string> | undefined;
  const cookieToken = cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }
  // 2. Fall back to Authorization: Bearer <token>
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieOrHeaderExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<{ userId: string; email: string; role: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      role: (user as any).role || 'USER',
    };
  }
}
