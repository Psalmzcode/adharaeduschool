import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackLevel, Role } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async findAll(schoolId: string, query: { className?: string; track?: TrackLevel; search?: string }) {
    const where: any = { schoolId };
    if (query.className) where.className = query.className;
    if (query.track) where.track = query.track;
    if (query.search) {
      where.OR = [
        { regNumber: { contains: query.search, mode: 'insensitive' } },
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.student.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true, isActive: true } },
        moduleProgress: { include: { module: true } },
        examAttempts: {
          where: { status: 'COMPLETED', score: { not: null } },
          select: { score: true, startedAt: true, cbtExam: { select: { title: true } } },
          orderBy: { startedAt: 'desc' },
        },
        assignmentSubs: {
          where: { score: { not: null } },
          select: { score: true, gradedAt: true, assignment: { select: { title: true } } },
          orderBy: { gradedAt: 'desc' },
        },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
        school: true,
        moduleProgress: { include: { module: true }, orderBy: { module: { number: 'asc' } } },
        attendanceRecords: { orderBy: { date: 'desc' }, take: 30 },
        examAttempts: {
          include: { cbtExam: { select: { title: true, track: true } } },
          orderBy: { startedAt: 'desc' },
        },
        parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async findByUserId(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        school: true,
        moduleProgress: { include: { module: true }, orderBy: { module: { number: 'asc' } } },
        attendanceRecords: { orderBy: { date: 'desc' }, take: 50 },
        examAttempts: { include: { cbtExam: true }, orderBy: { startedAt: 'desc' } },
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  /** Same school + class as the current student — for peer messaging search. */
  async findClassmates(userId: string, q?: string) {
    const me = await this.prisma.student.findUnique({
      where: { userId },
      select: { schoolId: true, className: true },
    });
    if (!me) throw new NotFoundException('Student profile not found');

    const trimmed = q?.trim();
    const userWhere: any = { role: Role.STUDENT };
    if (trimmed) {
      userWhere.OR = [
        { firstName: { contains: trimmed, mode: 'insensitive' } },
        { lastName: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    return this.prisma.student.findMany({
      where: {
        schoolId: me.schoolId,
        className: me.className,
        userId: { not: userId },
        user: userWhere,
      },
      take: 50,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      select: {
        id: true,
        userId: true,
        regNumber: true,
        className: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async create(data: {
    schoolId: string;
    className: string;
    track: TrackLevel;
    termLabel: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    parentId?: string;
  }) {
    const password = await argon2.hash('Student@123');
    const school = await this.prisma.school.findUnique({ where: { id: data.schoolId } });
    const count = await this.prisma.student.count({ where: { schoolId: data.schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const regNumber = `${school.code}/${new Date().getFullYear()}/${data.className}/${String(count + 1).padStart(3, '0')}`;

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'STUDENT',
        schoolId: data.schoolId,
      },
    });

    const student = await this.prisma.student.create({
      data: {
        userId: user.id,
        schoolId: data.schoolId,
        regNumber,
        className: data.className,
        track: data.track,
        termLabel: data.termLabel,
        parentId: data.parentId,
      },
    });

    // Class-based pacing: align new student to the class's current module if available
    const classmates = await this.prisma.student.findMany({
      where: {
        schoolId: data.schoolId,
        className: data.className,
        id: { not: student.id },
      },
      select: { id: true },
      take: 50,
    });
    const classmateIds = classmates.map((c) => c.id);
    const inProgressRows = classmateIds.length
      ? await this.prisma.moduleProgress.findMany({
          where: {
            studentId: { in: classmateIds },
            status: 'IN_PROGRESS',
            module: { track: data.track },
          },
          include: { module: { select: { id: true, number: true } } },
        })
      : [];
    const moduleFrequency = inProgressRows.reduce((acc: Record<string, { count: number; number: number }>, row) => {
      if (!acc[row.moduleId]) acc[row.moduleId] = { count: 0, number: row.module.number };
      acc[row.moduleId].count += 1;
      return acc;
    }, {});
    const preferredModuleId = Object.entries(moduleFrequency)
      .sort((a, b) => b[1].count - a[1].count || a[1].number - b[1].number)[0]?.[0];

    const firstModule = preferredModuleId
      ? await this.prisma.module.findUnique({ where: { id: preferredModuleId } })
      : await this.prisma.module.findFirst({ where: { track: data.track, number: 1 } });

    if (firstModule) {
      await this.prisma.moduleProgress.create({
        data: { studentId: student.id, moduleId: firstModule.id, status: 'IN_PROGRESS' },
      });
    }

    // Send welcome email with credentials
    const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    await this.emailService.sendStudentWelcome({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      regNumber,
      schoolName: school.name,
      track: data.track,
      className: data.className,
      password: 'Student@123',
      loginUrl,
    }).catch(() => {}); // Never let email block registration

    return { ...student, user: { ...user, password: undefined } };
  }

  async bulkCreate(schoolId: string, students: any[]) {
    const results = await Promise.all(
      students.map((s) => this.create({ ...s, schoolId }).catch((e) => ({ error: e.message, email: s.email }))),
    );
    return results;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.student.update({ where: { id }, data });
  }

  // Student dashboard stats
  async getStudentStats(studentId: string) {
    const [progress, attendance, attempts] = await Promise.all([
      this.prisma.moduleProgress.findMany({ where: { studentId }, include: { module: true } }),
      this.prisma.attendance.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
      this.prisma.examAttempt.findMany({
        where: { studentId, status: 'COMPLETED' },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const completed = progress.filter((p) => p.status === 'COMPLETED');
    const scores = completed.map((p) => p.score || 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
    const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
    const attendanceRate = attendance.length ? Math.round((presentDays / attendance.length) * 100) : 0;

    return {
      modulesCompleted: completed.length,
      totalModules: progress.length,
      averageScore: avgScore,
      attendanceRate,
      examsTaken: attempts.length,
      lastScore: attempts[0]?.score || null,
    };
  }

  // Leaderboard for a class
  async getLeaderboard(schoolId: string, className: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        moduleProgress: { where: { score: { not: null } } },
      },
    });

    return students
      .map((s) => {
        const scores = s.moduleProgress.map((p) => p.score || 0);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
        return {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          avatarUrl: s.user.avatarUrl,
          regNumber: s.regNumber,
          averageScore: avg,
          modulesCompleted: scores.length,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }
}
