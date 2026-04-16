import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from '@node-rs/argon2';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpPurpose, Role } from '@prisma/client';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 8;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email?.trim();
    if (!email) throw new BadRequestException('Email is required');
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await argon2.hash(dto.password);
    const effectiveRole = (dto.role || Role.SCHOOL_ADMIN) as Role;

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: effectiveRole,
        mustChangePassword: false,
      },
    });

    // If school admin, create school record
    if (effectiveRole === Role.SCHOOL_ADMIN && dto.schoolName) {
      const school = await this.prisma.school.create({
        data: {
          name: dto.schoolName,
          code: dto.schoolCode || this.generateCode(dto.schoolName),
          address: dto.address || '',
          state: dto.state || '',
          lga: dto.lga || '',
          principalName: `${dto.firstName} ${dto.lastName}`,
          principalPhone: dto.phone || '',
          admins: { connect: { id: user.id } },
        },
      });

      // Notify school admin: account created, pending approval (non-blocking)
      const supportEmail =
        this.config.get<string>('SUPPORT_EMAIL') ||
        this.config.get<string>('EMAIL_FROM') ||
        undefined;
      await this.emailService
        .sendSchoolPendingApproval({
          email: user.email,
          schoolName: school.name,
          adminName: `${user.firstName} ${user.lastName}`,
          supportEmail,
        })
        .catch(() => {});
    }

    const token = this.generateToken(user);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async login(dto: LoginDto) {
    const identifier = (dto.login ?? dto.email ?? '').trim();
    if (!identifier) throw new UnauthorizedException('Invalid credentials');

    const user = await this.findUserByLoginIdentifier(identifier);

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is suspended');

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Block school admins until their school is approved (server-side enforcement).
    if (user.role === Role.SCHOOL_ADMIN) {
      const status = user.school?.status;
      if (!status || status === 'PENDING') {
        throw new UnauthorizedException('Your school account is pending approval.');
      }
      if (status === 'REJECTED') {
        throw new UnauthorizedException('Your school account was rejected. Contact support.');
      }
      if (status === 'SUSPENDED') {
        throw new UnauthorizedException('Your school account is suspended. Contact support.');
      }
    }

    const token = this.generateToken(user);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.findUserByLoginIdentifier(identifier);
    if (!user) return null;
    const valid = await argon2.verify(user.password, password);
    if (!valid) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        school: true,
        tutorProfile: true,
        studentProfile: { include: { school: true, parent: true } },
        parentProfile: { include: { children: { include: { school: true } } } },
      },
    });
    if (!user) throw new UnauthorizedException();
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.password, oldPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const hashed = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false },
    });
    return { message: 'Password changed successfully' };
  }

  /**
   * Send a 6-digit code to the user’s email (passwordless sign-in).
   * Does not reveal whether the email is registered (same response either way).
   */
  async requestOtp(dto: RequestOtpDto) {
    const purpose = dto.purpose ?? OtpPurpose.SIGN_IN;
    const emailNorm = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
    });

    const generic = {
      message: 'If an account exists for this address, a verification code was sent.',
    };

    if (!user?.email || !user.isActive) {
      return generic;
    }

    const since = new Date(Date.now() - OTP_SEND_WINDOW_MS);
    const recentSends = await this.prisma.otpCode.count({
      where: { email: emailNorm, purpose, createdAt: { gte: since } },
    });
    if (recentSends >= OTP_MAX_SENDS_PER_WINDOW) {
      throw new HttpException(
        'Too many code requests. Please try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hashOtp(emailNorm, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.otpCode.deleteMany({
        where: { email: emailNorm, purpose, consumedAt: null },
      }),
      this.prisma.otpCode.create({
        data: {
          email: emailNorm,
          codeHash,
          purpose,
          expiresAt,
        },
      }),
    ]);

    await this.emailService.sendOtp({
      email: user.email,
      code,
      firstName: user.firstName,
      expiresMinutes: Math.floor(OTP_TTL_MS / 60000),
      purpose: 'sign in to your account',
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`[dev] OTP for ${emailNorm}: ${code}`);
    }

    return generic;
  }

  /** Exchange email + 6-digit code for JWT (same payload as POST /auth/login). */
  async verifyOtp(dto: VerifyOtpDto) {
    const purpose = dto.purpose ?? OtpPurpose.SIGN_IN;
    const emailNorm = dto.email.trim().toLowerCase();
    const code = dto.code.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) throw new UnauthorizedException('Invalid or expired code');

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
      include: {
        school: true,
        tutorProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid or expired code');

    const record = await this.prisma.otpCode.findFirst({
      where: {
        email: emailNorm,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedException('Invalid or expired code');

    if (record.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (!this.compareOtpHash(record.codeHash, emailNorm, code)) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const token = this.generateToken(user);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  private hashOtp(email: string, code: string): string {
    const pepper = this.config.get<string>('JWT_SECRET') || 'development-otp-pepper';
    return createHmac('sha256', pepper)
      .update(`${email.toLowerCase()}:${code}`)
      .digest('hex');
  }

  private compareOtpHash(stored: string, email: string, code: string): boolean {
    let a: Buffer;
    let b: Buffer;
    try {
      a = Buffer.from(stored, 'hex');
      b = Buffer.from(this.hashOtp(email, code), 'hex');
    } catch {
      return false;
    }
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private generateToken(user: any) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email ?? null,
      username: user.username ?? null,
      role: user.role,
    });
  }

  /** Resolve by email (if contains @) or exact username (case-insensitive). */
  private async findUserByLoginIdentifier(identifier: string) {
    const raw = identifier.trim();
    if (!raw) return null;
    const include = {
      school: true,
      tutorProfile: true,
      studentProfile: true,
      parentProfile: true,
    } as const;
    if (raw.includes('@')) {
      return this.prisma.user.findFirst({
        where: { email: { equals: raw, mode: 'insensitive' } },
        include,
      });
    }
    // Student regNumber login support: e.g. CHR/2026/JSS1A/051
    if (raw.includes('/')) {
      const student = await this.prisma.student.findFirst({
        where: { regNumber: { equals: raw, mode: 'insensitive' } },
        select: { userId: true },
      });
      if (!student?.userId) return null;
      return this.prisma.user.findUnique({
        where: { id: student.userId },
        include,
      });
    }
    const lower = raw.toLowerCase();
    return this.prisma.user.findUnique({
      where: { username: lower },
      include,
    });
  }

  private generateCode(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }
}
