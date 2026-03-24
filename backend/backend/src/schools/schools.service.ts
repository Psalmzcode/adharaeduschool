import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolStatus, Role } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { CompleteSchoolProfileDto } from './dto/complete-school-profile.dto';

/** Fields school admins may PATCH (after approval). Excludes privilege / billing fields. */
const SCHOOL_ADMIN_PATCH_KEYS = new Set([
  'name',
  'officialName',
  'schoolType',
  'address',
  'state',
  'lga',
  'website',
  'officialEmail',
  'officialPhone',
  'principalName',
  'principalPhone',
  'ictContactName',
  'ictContactPhone',
  'ictContactEmail',
  'billingContactName',
  'billingContactEmail',
  'billingContactPhone',
  'platformLevels',
  'enrolledTracks',
  'currentTermLabel',
  'academicYearLabel',
  'studentCountBand',
  'streamsCount',
  'visitDeploymentNotes',
  'logoUrl',
  'timezone',
  'locale',
]);

function pickSchoolAdminPatch(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (SCHOOL_ADMIN_PATCH_KEYS.has(key)) out[key] = data[key];
  }
  return out;
}

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  // Super admin — list all schools
  async findAll(query: { status?: SchoolStatus; state?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.state) where.state = query.state;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const schools = await this.prisma.school.findMany({
      where,
      include: {
        admins: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { students: true, tutorAssignments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return schools;
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        admins: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        tutorAssignments: {
          where: { isActive: true },
          include: { tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
        },
        _count: { select: { students: true } },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  // School admin — get their own school
  async findByAdmin(adminId: string) {
    const school = await this.prisma.school.findFirst({
      where: { admins: { some: { id: adminId } } },
      include: {
        admins: { select: { id: true, firstName: true, lastName: true, email: true } },
        tutorAssignments: {
          where: { isActive: true },
          include: {
            tutor: {
              include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } },
            },
          },
        },
        _count: { select: { students: true } },
        notices: { orderBy: { publishedAt: 'desc' }, take: 10 },
        payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!school) throw new NotFoundException('No school found for this admin');
    return school;
  }

  async update(id: string, data: any, requesterId: string, requesterRole: string) {
    const school = await this.findOne(id);
    if (requesterRole === Role.SCHOOL_ADMIN) {
      const isAdmin = school.admins.some((a) => a.id === requesterId);
      if (!isAdmin) throw new ForbiddenException();
      if (school.status !== SchoolStatus.APPROVED) {
        throw new ForbiddenException('You can only edit your school profile after it has been approved.');
      }
      const safe = pickSchoolAdminPatch(data as Record<string, unknown>);
      return this.prisma.school.update({ where: { id }, data: safe });
    }
    if (requesterRole === Role.SUPER_ADMIN) {
      return this.prisma.school.update({ where: { id }, data });
    }
    throw new ForbiddenException();
  }

  /** Post-approval onboarding: validates payload and sets profileCompletedAt. */
  async completeProfile(adminId: string, dto: CompleteSchoolProfileDto) {
    const school = await this.findByAdmin(adminId);
    if (school.status !== SchoolStatus.APPROVED) {
      throw new ForbiddenException('Your school must be approved before you can complete the profile.');
    }
    const display = dto.displayName?.trim() || dto.officialName.trim();
    return this.prisma.school.update({
      where: { id: school.id },
      data: {
        name: display,
        officialName: dto.officialName.trim(),
        schoolType: dto.schoolType,
        website: dto.website?.trim() || null,
        officialEmail: dto.officialEmail.trim(),
        officialPhone: dto.officialPhone.trim(),
        principalName: dto.principalName.trim(),
        principalPhone: dto.principalPhone.trim(),
        ictContactName: dto.ictContactName?.trim() || null,
        ictContactPhone: dto.ictContactPhone?.trim() || null,
        ictContactEmail: dto.ictContactEmail?.trim() || null,
        billingContactName: dto.billingContactName?.trim() || null,
        billingContactEmail: dto.billingContactEmail?.trim() || null,
        billingContactPhone: dto.billingContactPhone?.trim() || null,
        platformLevels: dto.platformLevels.map((s) => s.trim()).filter(Boolean),
        enrolledTracks: dto.enrolledTracks,
        currentTermLabel: dto.currentTermLabel.trim(),
        academicYearLabel: dto.academicYearLabel.trim(),
        studentCountBand: dto.studentCountBand.trim(),
        streamsCount: dto.streamsCount ?? null,
        visitDeploymentNotes: dto.visitDeploymentNotes?.trim() || null,
        logoUrl: dto.logoUrl?.trim() || null,
        timezone: dto.timezone?.trim() || 'Africa/Lagos',
        locale: dto.locale?.trim() || 'en-NG',
        profileCompletedAt: new Date(),
      },
    });
  }

  // Super admin — approve / reject / suspend
  async updateStatus(id: string, status: SchoolStatus, notes?: string) {
    const school = await this.findOne(id);
    const updated = await this.prisma.school.update({ where: { id }, data: { status, notes } });
    if (status === 'APPROVED') {
      const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
      for (const admin of school.admins) {
        await this.emailService.sendSchoolApproved({
          email: admin.email,
          schoolName: school.name,
          adminName: `${admin.firstName} ${admin.lastName}`,
          loginUrl,
        }).catch(() => {});
      }
    }
    return updated;
  }

  // Dashboard stats for school admin
  async getAdminStats(schoolId: string) {
    const [totalStudents, activeAssignments, upcomingExams, unreadNotices, recentAttendance] =
      await Promise.all([
        this.prisma.student.count({ where: { schoolId } }),
        this.prisma.tutorAssignment.count({ where: { schoolId, isActive: true } }),
        this.prisma.exam.count({
          where: { schoolId, scheduledAt: { gte: new Date() }, status: 'SCHEDULED' },
        }),
        this.prisma.notice.count({
          where: { schoolId, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
        }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: {
            student: { schoolId },
            date: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          _count: true,
        }),
      ]);

    return {
      totalStudents,
      activeAssignments,
      upcomingExams,
      unreadNotices,
      weeklyAttendance: recentAttendance,
    };
  }

  // Top performing students for school dashboard
  async getTopStudents(schoolId: string, limit = 10) {
    const students = await this.prisma.student.findMany({
      where: { schoolId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        moduleProgress: { where: { score: { not: null } } },
      },
    });

    return students
      .map((s) => {
        const scores = s.moduleProgress.map((p) => p.score || 0);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { ...s, averageScore: Math.round(avg) };
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);
  }

  // Attendance overview per class
  async getAttendanceOverview(schoolId: string) {
    const assignments = await this.prisma.tutorAssignment.findMany({
      where: { schoolId, isActive: true },
      select: { className: true, track: true },
    });

    const classes = [...new Set(assignments.map((a) => a.className))];
    const result = await Promise.all(
      classes.map(async (className) => {
        const students = await this.prisma.student.findMany({
          where: { schoolId, className },
          select: { id: true },
        });
        const ids = students.map((s) => s.id);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [present, absent] = await Promise.all([
          this.prisma.attendance.count({
            where: { studentId: { in: ids }, status: 'PRESENT', date: { gte: weekAgo } },
          }),
          this.prisma.attendance.count({
            where: { studentId: { in: ids }, status: { in: ['ABSENT', 'LATE'] }, date: { gte: weekAgo } },
          }),
        ]);
        const total = present + absent;
        return { className, present, absent, rate: total ? Math.round((present / total) * 100) : 0 };
      }),
    );
    return result;
  }
}
