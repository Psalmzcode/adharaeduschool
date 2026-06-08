import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, TutorAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function utcDateOnly(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class TutorAttendanceService {
  constructor(private prisma: PrismaService) {}

  private async assertSchoolAdmin(userId: string, schoolId: string) {
    const ok = await this.prisma.school.findFirst({
      where: { id: schoolId, admins: { some: { id: userId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('You do not manage this school');
  }

  async checkIn(tutorUserId: string, schoolId: string, notes?: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) throw new BadRequestException('Tutor profile not found');

    const assignment = await this.prisma.tutorAssignment.findFirst({
      where: { tutorId: tutor.id, schoolId, isActive: true },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException('You have no active assignment at this school');

    const date = utcDateOnly();
    return this.prisma.tutorAttendanceLog.upsert({
      where: { tutorId_schoolId_date: { tutorId: tutor.id, schoolId, date } },
      create: {
        tutorId: tutor.id,
        schoolId,
        date,
        status: TutorAttendanceStatus.PRESENT,
        markedBy: tutorUserId,
        notes: notes?.trim() || null,
      },
      update: {
        status: TutorAttendanceStatus.PRESENT,
        markedBy: tutorUserId,
        notes: notes?.trim() || null,
      },
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        school: { select: { id: true, name: true } },
      },
    });
  }

  async markByAdmin(
    adminUserId: string,
    role: string,
    data: { tutorId: string; schoolId: string; date: string; status: TutorAttendanceStatus; notes?: string },
  ) {
    if (role !== Role.SUPER_ADMIN) {
      await this.assertSchoolAdmin(adminUserId, data.schoolId);
    }

    const tutor = await this.prisma.tutor.findUnique({ where: { id: data.tutorId }, select: { id: true } });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const date = utcDateOnly(new Date(data.date));
    const status = data.status || TutorAttendanceStatus.PRESENT;

    return this.prisma.tutorAttendanceLog.upsert({
      where: { tutorId_schoolId_date: { tutorId: data.tutorId, schoolId: data.schoolId, date } },
      create: {
        tutorId: data.tutorId,
        schoolId: data.schoolId,
        date,
        status,
        markedBy: adminUserId,
        notes: data.notes?.trim() || null,
      },
      update: {
        status,
        markedBy: adminUserId,
        notes: data.notes?.trim() || null,
      },
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
  }

  async listForSchool(schoolId: string, from?: string, to?: string) {
    const where: { schoolId: string; date?: { gte?: Date; lte?: Date } } = { schoolId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = utcDateOnly(new Date(from));
      if (to) where.date.lte = utcDateOnly(new Date(to));
    }

    return this.prisma.tutorAttendanceLog.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
  }

  async myLog(tutorUserId: string, limit = 60) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) return [];

    return this.prisma.tutorAttendanceLog.findMany({
      where: { tutorId: tutor.id },
      orderBy: { date: 'desc' },
      take: Math.min(200, limit),
      include: { school: { select: { id: true, name: true } } },
    });
  }
}
