import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from '@node-rs/argon2';

@Injectable()
export class TutorsService {
  constructor(private prisma: PrismaService) {}

  /** Strip sensitive KYC / payroll fields for school admin API responses */
  sanitizeTutorForSchoolAdmin(tutor: Record<string, any>) {
    const {
      passportPhotoUrl,
      identificationNumber,
      identificationDocumentUrl,
      signatureUrl,
      guarantors,
      bankName,
      bankAccount,
      ...rest
    } = tutor;
    const gCount = Array.isArray(guarantors) ? guarantors.length : 0;
    return {
      ...rest,
      passportPhotoUrl: null,
      identificationDocumentUrl: null,
      signatureUrl: null,
      guarantors: null,
      identificationNumber: null,
      bankName: null,
      bankAccount: null,
      schoolAdminKycSummary: {
        identificationType: tutor.identificationType ?? null,
        idNumberOnFile: !!identificationNumber,
        passportPhotoOnFile: !!passportPhotoUrl,
        idDocumentOnFile: !!identificationDocumentUrl,
        signatureOnFile: !!signatureUrl,
        guarantorsOnFile: gCount,
      },
    };
  }

  /** Tutors with an assignment to the school managed by this admin (sanitized). */
  async findForSchoolAdmin(adminUserId: string) {
    const school = await this.prisma.school.findFirst({
      where: { admins: { some: { id: adminUserId } } },
      select: { id: true },
    });
    if (!school) return [];

    const rows = await this.prisma.tutorAssignment.findMany({
      where: { schoolId: school.id, isActive: true },
      distinct: ['tutorId'],
      include: {
        tutor: {
          include: {
            user: { select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              notifyNewMessage: true,
              notifyReportDeadline: true,
              notifyExamResults: true,
            } },
            assignments: {
              where: { schoolId: school.id },
              include: { school: { select: { id: true, name: true, state: true } } },
              orderBy: { createdAt: 'desc' },
            },
            _count: { select: { reports: true, cbtExams: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const out: any[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const t = row.tutor;
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(this.sanitizeTutorForSchoolAdmin({ ...t }));
    }
    return out;
  }

  async findOneForSchoolAdmin(tutorId: string, adminUserId: string) {
    const school = await this.prisma.school.findFirst({
      where: { admins: { some: { id: adminUserId } } },
      select: { id: true },
    });
    if (!school) throw new ForbiddenException('No school access');

    const link = await this.prisma.tutorAssignment.findFirst({
      where: { tutorId, schoolId: school.id },
    });
    if (!link) throw new NotFoundException('Tutor is not assigned to your school');

    const full = await this.findOne(tutorId);
    const schoolAssignments = (full.assignments || []).filter((a: any) => a.schoolId === school.id);
    return this.sanitizeTutorForSchoolAdmin({ ...full, assignments: schoolAssignments });
  }

  async findAll(query: { isVerified?: boolean; search?: string }) {
    const where: any = {};
    if (query.isVerified !== undefined) where.isVerified = query.isVerified;
    if (query.search) {
      where.user = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    return this.prisma.tutor.findMany({
      where,
      include: {
        user: { select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              notifyNewMessage: true,
              notifyReportDeadline: true,
              notifyExamResults: true,
            } },
        assignments: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, state: true } } },
        },
        _count: { select: { reports: true, cbtExams: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id },
      include: {
        user: { select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              notifyNewMessage: true,
              notifyReportDeadline: true,
              notifyExamResults: true,
            } },
        assignments: {
          include: { school: true },
        },
        reports: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    return tutor;
  }

  async findByUserId(userId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId },
      include: {
        user: { select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              notifyNewMessage: true,
              notifyReportDeadline: true,
              notifyExamResults: true,
            } },
        assignments: {
          include: { school: true },
          orderBy: { createdAt: 'desc' },
        },
        reports: { orderBy: { createdAt: 'desc' }, take: 10 },
        cbtExams: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    return tutor;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    bio?: string;
    specializations?: string[];
    tracks?: any[];
  }) {
    const password = await argon2.hash('Tutor@123');
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'TUTOR',
      },
    });
    return this.prisma.tutor.create({
      data: {
        userId: user.id,
        bio: data.bio,
        specializations: data.specializations || [],
        tracks: data.tracks || [],
        onboardingStatus: 'DRAFT',
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  /** Tutor self-service: save KYC draft (partial allowed). */
  async updateMyProfileByUserId(userId: string, body: Record<string, unknown>) {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
    if (!tutor) throw new NotFoundException('Tutor profile not found');

    const allowedKeys = [
      'bio',
      'specializations',
      'bankName',
      'bankAccount',
      'passportPhotoUrl',
      'identificationType',
      'identificationNumber',
      'identificationDocumentUrl',
      'signatureUrl',
      'guarantors',
    ] as const;
    const data: Record<string, unknown> = {};
    for (const k of allowedKeys) {
      if (k === 'specializations') continue;
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.specializations !== undefined) {
      const sp = body.specializations;
      data.specializations = Array.isArray(sp)
        ? (sp as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
        : String(sp || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
    }
    if (Object.keys(data).length === 0) {
      return this.findByUserId(userId);
    }
    return this.prisma.tutor.update({
      where: { userId },
      data: data as any,
      include: {
        user: { select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              notifyNewMessage: true,
              notifyReportDeadline: true,
              notifyExamResults: true,
            } },
        assignments: { include: { school: true }, orderBy: { createdAt: 'desc' } },
        reports: { orderBy: { createdAt: 'desc' }, take: 10 },
        cbtExams: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  /** Validate KYC in DB and set onboarding COMPLETE (unlocks dashboard). */
  async completeOnboardingByUserId(userId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    if (tutor.onboardingStatus === 'COMPLETE') {
      return this.findByUserId(userId);
    }

    const errs: string[] = [];
    const s = (v: unknown) => String(v ?? '').trim();
    if (!s(tutor.passportPhotoUrl)) errs.push('Passport-style photo is required');
    if (!tutor.identificationType) errs.push('Select a means of identification');
    if (s(tutor.identificationNumber).length < 3) errs.push('ID number is required');
    if (!s(tutor.identificationDocumentUrl)) errs.push('Upload a photo of your ID');
    if (!s(tutor.signatureUrl)) errs.push('Signature image is required');

    const g = tutor.guarantors as unknown;
    const list = Array.isArray(g) ? g : [];
    if (list.length < 2) errs.push('Two guarantors are required');
    const need = ['fullName', 'phone', 'email', 'address'] as const;
    for (let i = 0; i < 2; i++) {
      const row = list[i] as Record<string, unknown> | undefined;
      if (!row || typeof row !== 'object') {
        errs.push(`Guarantor ${i + 1}: all fields required`);
        continue;
      }
      for (const k of need) {
        if (s(row[k]).length < 2) errs.push(`Guarantor ${i + 1}: ${k} is required`);
      }
    }

    if (errs.length) {
      throw new BadRequestException(`Complete all required fields: ${errs.join(' · ')}`);
    }

    await this.prisma.tutor.update({
      where: { userId },
      data: { onboardingStatus: 'COMPLETE' },
    });
    return this.findByUserId(userId);
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.tutor.update({ where: { id }, data });
  }

  async assignToSchool(
    tutorId: string,
    schoolId: string,
    data: {
      track: any;
      className?: string;
      classNames?: string[];
      termLabel: string;
      startDate: Date;
      expectedSessionsPerWeek?: number;
    },
  ) {
    const expectedSessionsPerWeek = Math.min(
      14,
      Math.max(1, Math.floor(Number(data.expectedSessionsPerWeek ?? 3) || 3)),
    );
    const classNames = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((x: any) => String(x || '').trim()).filter(Boolean)))
      : [];
    const targets = classNames.length
      ? classNames
      : [String(data.className || '').trim()].filter(Boolean);
    if (!targets.length) {
      throw new BadRequestException('Select at least one class');
    }

    const include = {
      school: { select: { name: true } },
      tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
    } as const;

    const existing = await this.prisma.tutorAssignment.findMany({
      where: {
        tutorId,
        schoolId,
        track: data.track,
        termLabel: data.termLabel,
        isActive: true,
        className: { in: targets },
      },
      include,
    });
    const existingClassSet = new Set(existing.map((e) => e.className));
    const createTargets = targets.filter((className) => !existingClassSet.has(className));

    const created = createTargets.length
      ? await this.prisma.$transaction(
          createTargets.map((className) =>
            this.prisma.tutorAssignment.create({
              data: {
                tutorId,
                schoolId,
                track: data.track,
                className,
                termLabel: data.termLabel,
                startDate: data.startDate,
                expectedSessionsPerWeek,
              },
              include,
            }),
          ),
        )
      : [];

    const merged = [...existing, ...created];
    if (targets.length === 1) {
      return merged[0];
    }
    return merged;
  }

  async removeFromSchool(assignmentId: string) {
    return this.prisma.tutorAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false, endDate: new Date() },
    });
  }

  /** Super Admin: set weekly session target for payroll / coverage reporting */
  async updateAssignmentExpectation(assignmentId: string, expectedSessionsPerWeek: number) {
    const v = Math.min(14, Math.max(1, Math.floor(Number(expectedSessionsPerWeek) || 3)));
    return this.prisma.tutorAssignment.update({
      where: { id: assignmentId },
      data: { expectedSessionsPerWeek: v },
      include: {
        school: { select: { id: true, name: true } },
        tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  // Tutor dashboard stats
  async getTutorStats(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    const [assignments, reports, pendingReports, cbtExams] = await Promise.all([
      this.prisma.tutorAssignment.count({ where: { tutorId, isActive: true } }),
      this.prisma.weeklyReport.count({ where: { tutorId, status: 'SUBMITTED' } }),
      this.prisma.weeklyReport.count({ where: { tutorId, status: 'DRAFT' } }),
      this.prisma.cBTExam.count({ where: { tutorId } }),
    ]);

    // Total students across assignments
    const activeAssignments = await this.prisma.tutorAssignment.findMany({
      where: { tutorId, isActive: true },
      include: { school: { include: { _count: { select: { students: true } } } } },
    });
    const totalStudents = activeAssignments.reduce(
      (sum, a) => sum + (a.school._count.students || 0),
      0,
    );

    return { activeSchools: assignments, submittedReports: reports, pendingReports, cbtExams, totalStudents, rating: tutor.rating };
  }

  // Classes taught by tutor
  async getTutorClasses(tutorId: string) {
    const { weekStart, weekEnd } = TutorsService.utcWeekBounds();

    const assignments = await this.prisma.tutorAssignment.findMany({
      where: { tutorId, isActive: true },
      include: { school: true },
    });

    return Promise.all(
      assignments.map(async (a) => {
        const students = await this.prisma.student.findMany({
          where: { schoolId: a.schoolId, className: a.className },
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            moduleProgress: { include: { module: true } },
          },
        });
        const deliveredThisWeek = await this.prisma.sessionLog.count({
          where: {
            tutorAssignmentId: a.id,
            startedAt: { gte: weekStart, lte: weekEnd },
          },
        });
        const expected = a.expectedSessionsPerWeek ?? 3;
        return {
          ...a,
          students,
          weeklySessionExpectation: {
            expected,
            deliveredThisWeek,
            shortBy: Math.max(0, expected - deliveredThisWeek),
            metExpectation: deliveredThisWeek >= expected,
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
          },
        };
      }),
    );
  }

  /** Monday 00:00 UTC → Sunday 23:59:59.999 UTC; optional weekStart=YYYY-MM-DD (that Monday) */
  static utcWeekBounds(weekStartParam?: string): { weekStart: Date; weekEnd: Date } {
    if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam.trim())) {
      const monday = new Date(`${weekStartParam.trim()}T00:00:00.000Z`);
      if (!Number.isNaN(monday.getTime())) {
        const sunday = new Date(monday);
        sunday.setUTCDate(sunday.getUTCDate() + 6);
        sunday.setUTCHours(23, 59, 59, 999);
        return { weekStart: monday, weekEnd: sunday };
      }
    }
    const d = new Date();
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff, 0, 0, 0, 0));
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { weekStart: monday, weekEnd: sunday };
  }
}
