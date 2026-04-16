import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email?: string | null; username?: string | null; role: string }) {
    const user = await this.findUserWithReconnect(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { sub: user.id, email: user.email, username: user.username, role: user.role };
  }

  private async findUserWithReconnect(userId: string) {
    try {
      return await this.prisma.user.findUnique({ where: { id: userId } });
    } catch (error) {
      this.logger.warn('Prisma query failed during JWT validation, attempting reconnect once.');
      try {
        await this.prisma.$connect();
        return await this.prisma.user.findUnique({ where: { id: userId } });
      } catch (retryError) {
        this.logger.error('Prisma reconnect/query failed during JWT validation.', retryError as any);
        throw new ServiceUnavailableException('Authentication service temporarily unavailable');
      }
    }
  }
}
