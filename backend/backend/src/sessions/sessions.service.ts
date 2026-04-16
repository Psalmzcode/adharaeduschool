import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TutorsService } from '../tutors/tutors.service';
import { ClassCurriculumService } from '../curriculum/class-curriculum.service';
import { CurriculumLessonsService } from '../curriculum/curriculum-lessons.service';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private classCurriculum: ClassCurriculumService,
    private curriculumLessons: CurriculumLessonsService,
  ) {}

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
      /** Required when the chosen module has at least one published curriculum lesson. */
      lessonId?: string;
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
    let lessonId: string | null = data.lessonId?.trim() || null;

    if (lessonId) {
      const lesson = await this.prisma.curriculumLesson.findUnique({
        where: { id: lessonId },
        include: { module: true },
      });
      if (!lesson) throw new BadRequestException('Curriculum lesson not found');
      if (!lesson.isPublished) throw new BadRequestException('This curriculum lesson is not published');
      if (String(lesson.module.track) !== String(track)) {
        throw new BadRequestException('Lesson does not match this class track');
      }
      moduleId = lesson.moduleId;
    }

    if (moduleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod) throw new BadRequestException('Module not found');
      if (String(mod.track) !== String(track)) {
        throw new BadRequestException('Selected module does not match this class track');
      }
      const publishedCount = await this.curriculumLessons.countPublishedInModule(moduleId);
      if (publishedCount > 0 && !lessonId) {
        throw new BadRequestException(
          'This module has published curriculum lessons — select which lesson you are delivering.',
        );
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
        termLabel: (tutorAssignmentId
          ? (await this.prisma.tutorAssignment.findUnique({ where: { id: tutorAssignmentId }, select: { termLabel: true } }))?.termLabel
          : null) || null,
        tutorAssignmentId,
        moduleId,
        lessonId,
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
    const updated = await this.prisma.sessionLog.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationMins, studentsPresent: present, notes },
    });

    await this.classCurriculum.recordDeliveryAfterSession({
      id: updated.id,
      schoolId: updated.schoolId,
      className: updated.className,
      lessonId: updated.lessonId,
      track: updated.track,
    });

    return updated;
  }

  async getActiveSession(tutorUserId: string) {
    return this.prisma.sessionLog.findFirst({
      where: { tutorId: tutorUserId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        module: { select: { id: true, title: true, number: true } },
        lesson: { select: { id: true, title: true, position: true } },
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
        lesson: { select: { id: true, title: true, position: true } },
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
  async getSchoolSessions(schoolId: string, limit = 100, from?: string, to?: string, termLabel?: string) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const where: any = { schoolId };
    if (termLabel?.trim()) {
      // Only sessions linked to an assignment can be reliably attributed to a term.
      where.tutorAssignment = { termLabel: termLabel.trim() };
    }

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
        lesson: { select: { id: true, title: true, position: true } },
        tutorAssignment: { select: { id: true, className: true, track: true, termLabel: true } },
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
