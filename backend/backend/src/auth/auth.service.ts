import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check email not taken
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role || Role.SCHOOL_ADMIN,
      },
    });

    // If school admin, create school record
    if (dto.role === Role.SCHOOL_ADMIN && dto.schoolName) {
      await this.prisma.school.create({
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
    }

    const token = this.generateToken(user);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        school: true,
        tutorProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is suspended');

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.generateToken(user);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
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
      data: { password: hashed },
    });
    return { message: 'Password changed successfully' };
  }

  private generateToken(user: any) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
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
