import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TutorsService } from '../tutors/tutors.service';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async startSession(
    tutorUserId: string,
    data: {
      schoolId: string;
      className: string;
      track: string;
      moduleTitle?: string;
      notes?: string;
      tutorAssignmentId?: string;
      moduleId?: string;
    },
  ) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) throw new BadRequestException('Tutor profile not found');

    let schoolId = data.schoolId;
    let className = data.className;
    let track = data.track;
    let tutorAssignmentId: string | null = data.tutorAssignmentId?.trim() || null;

    if (tutorAssignmentId) {
      const a = await this.prisma.tutorAssignment.findUnique({
        where: { id: tutorAssignmentId },
      });
      if (!a || a.tutorId !== tutor.id) {
        throw new ForbiddenException('This class assignment does not belong to you');
      }
      if (!a.isActive) {
        throw new BadRequestException('This assignment is not active');
      }
      schoolId = a.schoolId;
      className = a.className;
      track = a.track;
    } else {
      // Link session to the tutor's active assignment when the client omitted ID (legacy / merged class rows).
      // Weekly coverage & payroll only count rows with tutorAssignmentId set.
      const sid = String(schoolId || '').trim();
      const cn = String(className || '').trim();
      const trRaw = String(track || '').trim().toUpperCase();
      if (sid && cn && Object.values(TrackLevel).includes(trRaw as TrackLevel)) {
        const resolved = await this.prisma.tutorAssignment.findFirst({
          where: {
            tutorId: tutor.id,
            schoolId: sid,
            className: cn,
            track: trRaw as TrackLevel,
            isActive: true,
          },
          select: { id: true },
        });
        if (resolved) tutorAssignmentId = resolved.id;
      }
    }

    let moduleId: string | null = data.moduleId?.trim() || null;
    if (moduleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod) throw new BadRequestException('Module not found');
      if (String(mod.track) !== String(track)) {
        throw new BadRequestException('Selected module does not match this class track');
      }
    }

    // Close any open sessions for this tutor first
    await this.prisma.sessionLog.updateMany({
      where: { tutorId: tutorUserId, endedAt: null },
      data: { endedAt: new Date(), durationMins: 0 },
    });

    return this.prisma.sessionLog.create({
      data: {
        tutorId: tutorUserId,
        schoolId,
        className,
        track,
        moduleTitle: data.moduleTitle,
        notes: data.notes,
        tutorAssignmentId,
        moduleId,
        startedAt: new Date(),
      },
    });
  }

  async endSession(sessionId: string, studentsPresent?: number, notes?: string) {
    const session = await this.prisma.sessionLog.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const durationMins = Math.round((Date.now() - session.startedAt.getTime()) / 60000);
    const present =
      studentsPresent !== undefined && studentsPresent !== null && !Number.isNaN(Number(studentsPresent))
        ? Math.max(0, Math.floor(Number(studentsPresent)))
        : session.studentsPresent ?? 0;
    return this.prisma.sessionLog.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationMins, studentsPresent: present, notes },
    });
  }

  async getActiveSession(tutorUserId: string) {
    return this.prisma.sessionLog.findFirst({
      where: { tutorId: tutorUserId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        module: { select: { id: true, title: true, number: true } },
        tutorAssignment: { select: { id: true, className: true, track: true } },
      },
    });
  }

  async getTutorSessions(tutorUserId: string, from?: Date, to?: Date) {
    const where: any = { tutorId: tutorUserId };
    if (from || to) {
      where.startedAt = {};
      if (from) where.startedAt.gte = from;
      if (to) where.startedAt.lte = to;
    }
    return this.prisma.sessionLog.findMany({
      where,
      include: {
        school: { select: { name: true } },
        module: { select: { id: true, title: true, number: true } },
        tutorAssignment: { select: { id: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * @param from - ISO date or YYYY-MM-DD (start of day UTC)
   * @param to - ISO date or YYYY-MM-DD (end of day UTC)
   */
  async getSchoolSessions(schoolId: string, limit = 100, from?: string, to?: string) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const where: { schoolId: string; startedAt?: { gte?: Date; lte?: Date } } = { schoolId };

    const parseFrom = (s?: string): Date | undefined => {
      if (!s?.trim()) return undefined;
      const t = s.trim();
      const d = t.length === 10 ? new Date(`${t}T00:00:00.000Z`) : new Date(t);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const parseTo = (s?: string): Date | undefined => {
      if (!s?.trim()) return undefined;
      const t = s.trim();
      const d = t.length === 10 ? new Date(`${t}T23:59:59.999Z`) : new Date(t);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    const gte = parseFrom(from);
    const lte = parseTo(to);
    if (gte || lte) {
      where.startedAt = {};
      if (gte) where.startedAt.gte = gte;
      if (lte) where.startedAt.lte = lte;
    }

    return this.prisma.sessionLog.findMany({
      where,
      include: {
        tutor: { select: { firstName: true, lastName: true } },
        module: { select: { id: true, title: true, number: true, track: true } },
        tutorAssignment: { select: { id: true, className: true, track: true } },
      },
      orderBy: { startedAt: 'desc' },
      take,
    });
  }

  /** Delivered session count vs weekly expectation per active assignment (UTC week) */
  async getSchoolSessionCoverage(
    schoolId: string,
    weekStartParam: string | undefined,
    viewerRole: string | undefined,
    viewerUserId: string | undefined,
  ) {
    if (viewerRole === 'SCHOOL_ADMIN' && viewerUserId) {
      const ok = await this.prisma.school.findFirst({
        where: { id: schoolId, admins: { some: { id: viewerUserId } } },
        select: { id: true },
      });
      if (!ok) throw new ForbiddenException('You do not have access to this school');
    }

    const { weekStart, weekEnd } = TutorsService.utcWeekBounds(weekStartParam);

    const assignments = await this.prisma.tutorAssignment.findMany({
      where: { schoolId, isActive: true },
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    const rows = await Promise.all(
      assignments.map(async (a) => {
        const deliveredThisWeek = await this.prisma.sessionLog.count({
          where: {
            tutorAssignmentId: a.id,
            startedAt: { gte: weekStart, lte: weekEnd },
          },
        });
        const expected = a.expectedSessionsPerWeek ?? 3;
        return {
          assignmentId: a.id,
          tutorId: a.tutorId,
          tutorName:
            `${a.tutor.user.firstName || ''} ${a.tutor.user.lastName || ''}`.trim() || 'Tutor',
          className: a.className,
          track: a.track,
          termLabel: a.termLabel,
          expectedSessionsPerWeek: expected,
          deliveredThisWeek,
          shortBy: Math.max(0, expected - deliveredThisWeek),
          metExpectation: deliveredThisWeek >= expected,
        };
      }),
    );

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      schoolId,
      rows,
    };
  }
}
