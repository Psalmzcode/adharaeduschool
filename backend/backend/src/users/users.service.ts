import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string;
      notifyNewMessage?: boolean;
      notifyReportDeadline?: boolean;
      notifyExamResults?: boolean;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl;
    if (typeof data.notifyNewMessage === 'boolean') patch.notifyNewMessage = data.notifyNewMessage;
    if (typeof data.notifyReportDeadline === 'boolean') patch.notifyReportDeadline = data.notifyReportDeadline;
    if (typeof data.notifyExamResults === 'boolean') patch.notifyExamResults = data.notifyExamResults;

    const select = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      notifyNewMessage: true,
      notifyReportDeadline: true,
      notifyExamResults: true,
    } as const;

    if (Object.keys(patch).length === 0) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select });
      if (!u) throw new NotFoundException('User not found');
      return u;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: patch as any,
      select,
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        notifyNewMessage: true,
        notifyReportDeadline: true,
        notifyExamResults: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  // Super admin: list all users
  /** Super admin — fix typos / wrong inbox on registration (email is login + notification target). */
  async adminPatchUser(
    userId: string,
    data: {
      email?: string;
    },
  ) {
    const email = data.email?.trim();
    if (!email) throw new BadRequestException('email is required');

    const existing = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        NOT: { id: userId },
      },
    });
    if (existing) throw new ConflictException('Email already registered');

    return this.prisma.user.update({
      where: { id: userId },
      data: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async findAll(query: { role?: string; search?: string }) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
