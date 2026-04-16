import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleStackVariant, Track3Stack, TrackLevel, Role } from '@prisma/client';
import { modulesWhereForTrack } from '../common/module-curriculum';
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

  async findAll(
    schoolId: string,
    query: { className?: string; track?: TrackLevel; search?: string; termLabel?: string },
  ) {
    const where: any = { schoolId };
    if (query.className) where.className = query.className;
    if (query.track) where.track = query.track;
    if (query.termLabel) where.termLabel = query.termLabel;
    if (query.search) {
      where.OR = [
        { regNumber: { contains: query.search, mode: 'insensitive' } },
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { username: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.student.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, username: true, avatarUrl: true, isActive: true } },
        moduleProgress: {
          where: query.termLabel ? { termLabel: query.termLabel } : undefined,
          include: { module: true },
        },
        examAttempts: {
          where: {
            status: 'COMPLETED',
            score: { not: null },
            ...(query.termLabel ? { termLabel: query.termLabel } : {}),
          },
          select: { score: true, startedAt: true, cbtExam: { select: { title: true } } },
          orderBy: { startedAt: 'desc' },
        },
        assignmentSubs: {
          where: { score: { not: null }, ...(query.termLabel ? { termLabel: query.termLabel } : {}) },
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, username: true, mustChangePassword: true, phone: true, avatarUrl: true } },
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, username: true, mustChangePassword: true, avatarUrl: true } },
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
    email?: string | null;
    username?: string | null;
    phone?: string;
    parentId?: string;
  }) {
    const school = await this.prisma.school.findUnique({ where: { id: data.schoolId } });
    const count = await this.prisma.student.count({ where: { schoolId: data.schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const regNumber = `${school.code}/${new Date().getFullYear()}/${data.className}/${String(count + 1).padStart(3, '0')}`;
    const regSuffix = regNumber.split('/').pop()?.trim() || String(count + 1).padStart(3, '0');
    const initialPasswordPlain = `student@${regSuffix}`;
    const password = await argon2.hash(initialPasswordPlain);

    const emailTrim = data.email?.trim() || null;
    if (emailTrim) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: { equals: emailTrim, mode: 'insensitive' } },
      });
      if (emailTaken) throw new ConflictException('Email already registered');
    }

    const username = await this.allocateStudentUsername(
      data.schoolId,
      data.firstName,
      data.lastName,
      data.username?.trim() || null,
    );

    const user = await this.prisma.user.create({
      data: {
        email: emailTrim,
        username,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'STUDENT',
        schoolId: data.schoolId,
        mustChangePassword: true,
      },
    });

    let track3Stack: Track3Stack | undefined;
    if (data.track === TrackLevel.TRACK_3) {
      const assignment = await this.prisma.tutorAssignment.findFirst({
        where: {
          schoolId: data.schoolId,
          className: data.className,
          track: TrackLevel.TRACK_3,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      track3Stack = assignment?.track3Stack ?? Track3Stack.PYTHON_FLASK;
    }

    const student = await this.prisma.student.create({
      data: {
        userId: user.id,
        schoolId: data.schoolId,
        regNumber,
        className: data.className,
        track: data.track,
        termLabel: data.termLabel,
        parentId: data.parentId,
        track3Stack,
      },
    });

    const allowedModules = await this.prisma.module.findMany({
      where: modulesWhereForTrack(data.track, track3Stack),
      select: { id: true },
    });
    const allowedModuleIds = new Set(allowedModules.map((m) => m.id));

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
    const filteredProgress = inProgressRows.filter((r) => allowedModuleIds.has(r.moduleId));
    const moduleFrequency = filteredProgress.reduce((acc: Record<string, { count: number; number: number }>, row) => {
      if (!acc[row.moduleId]) acc[row.moduleId] = { count: 0, number: row.module.number };
      acc[row.moduleId].count += 1;
      return acc;
    }, {});
    const preferredModuleId = Object.entries(moduleFrequency)
      .sort((a, b) => b[1].count - a[1].count || a[1].number - b[1].number)[0]?.[0];

    let firstModule =
      preferredModuleId && allowedModuleIds.has(preferredModuleId)
        ? await this.prisma.module.findUnique({ where: { id: preferredModuleId } })
        : null;
    if (!firstModule) {
      firstModule = await this.prisma.module.findFirst({
        where: {
          track: data.track,
          number: 1,
          stackVariant: ModuleStackVariant.COMMON,
        },
      });
    }

    if (firstModule) {
      await this.prisma.moduleProgress.create({
        data: {
          studentId: student.id,
          moduleId: firstModule.id,
          status: 'IN_PROGRESS',
          termLabel: data.termLabel,
        },
      });
    }

    const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (emailTrim) {
      await this.emailService
        .sendStudentWelcome({
          email: emailTrim,
          username,
          firstName: data.firstName,
          lastName: data.lastName,
          regNumber,
          schoolName: school.name,
          track: data.track,
          className: data.className,
          password: initialPasswordPlain,
          loginUrl,
        })
        .catch(() => {});
    }

    return { ...student, user: { ...user, password: undefined } };
  }

  /**
   * Reset student password and return a one-time temporary password.
   * Passwords are stored hashed; this is the only safe way to "show" a password to staff.
   */
  async resetStudentPassword(studentId: string, performedByUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true, regNumber: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const regSuffix = String(student.regNumber || '').split('/').pop()?.trim();
    if (!regSuffix) throw new BadRequestException('Student reg number is missing');

    // Keep the same convention used at initial student creation:
    // e.g. CHR/2026/SS3A/021 -> student@021
    const tempPassword = `student@${regSuffix}`;
    const hashed = await argon2.hash(tempPassword);

    await this.prisma.user.update({
      where: { id: student.userId },
      data: {
        password: hashed,
        mustChangePassword: true,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'Password reset',
      tempPassword,
      mustChangePassword: true,
      performedBy: performedByUserId,
    };
  }

  private slugifyPart(s: string): string {
    return s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase()
      .slice(0, 28) || 'x';
  }

  /** Globally unique username: `{schoolCode}.{first}.{last}` with numeric suffix if needed. */
  private async allocateStudentUsername(
    schoolId: string,
    firstName: string,
    lastName: string,
    explicit: string | null,
  ): Promise<string> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { code: true } });
    const code = this.slugifyPart(school?.code || 'SCH');

    if (explicit) {
      const normalized = explicit.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 48);
      if (normalized.length < 2) throw new BadRequestException('Username must be at least 2 characters');
      const taken = await this.prisma.user.findUnique({ where: { username: normalized } });
      if (taken) throw new ConflictException(`Username "${normalized}" is already taken`);
      return normalized;
    }

    const fn = this.slugifyPart(firstName);
    const ln = this.slugifyPart(lastName);
    let base = ln ? `${code}.${fn}.${ln}` : `${code}.${fn}`;
    if (base.length < 4) base = `${code}.student`;
    let candidate = base.slice(0, 48);
    let n = 0;
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      n++;
      candidate = `${base}-${n}`.slice(0, 48);
    }
    return candidate;
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

  /** Tutor-safe edit: update student user name fields only. */
  async updateStudentName(studentId: string, firstName: string, lastName: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const fn = String(firstName || '').trim();
    const ln = String(lastName || '').trim();
    if (!fn) throw new BadRequestException('First name is required');
    if (!ln) throw new BadRequestException('Last name is required');

    await this.prisma.user.update({
      where: { id: student.userId },
      data: { firstName: fn, lastName: ln, updatedAt: new Date() },
    });

    return { message: 'Student updated', studentId };
  }

  /**
   * Bulk/Single "delete" should be a deactivation (soft delete).
   * Hard delete is risky because students are referenced by submissions, attempts, messages, etc.
   */
  async deactivate(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false, updatedAt: new Date() },
    });

    return { message: 'Student deactivated', studentId };
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
