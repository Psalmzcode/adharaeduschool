import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackLevel } from '@prisma/client';

@Injectable()
export class ClassPerformanceService {
  constructor(private prisma: PrismaService) {}

  private async assertAccess(userId: string, role: string, schoolId: string, className: string) {
    if (role === 'SUPER_ADMIN') return;

    if (role === 'SCHOOL_ADMIN') {
      const ok = await this.prisma.school.findFirst({
        where: { id: schoolId, admins: { some: { id: userId } } },
        select: { id: true },
      });
      if (!ok) throw new ForbiddenException('You do not manage this school');
      return;
    }

    if (role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!tutor) throw new ForbiddenException();
      const link = await this.prisma.tutorAssignment.findFirst({
        where: { tutorId: tutor.id, schoolId, className, isActive: true },
        select: { id: true },
      });
      if (!link) throw new ForbiddenException('You are not assigned to this class');
      return;
    }

    throw new ForbiddenException();
  }

  /**
   * Roll-up: attendance + module progress + graded work (assignments, class assignments, CBT, practicals).
   */
  async getRollup(
    userId: string,
    role: string,
    schoolId: string,
    className: string,
    days = 30,
    trackParam?: string,
  ) {
    const cn = String(className || '').trim();
    if (!schoolId || !cn) throw new BadRequestException('schoolId and className are required');

    await this.assertAccess(userId, role, schoolId, cn);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, code: true },
    });
    if (!school) throw new NotFoundException('School not found');

    const windowDays = Math.min(365, Math.max(7, Math.floor(Number(days) || 30)));
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    since.setHours(0, 0, 0, 0);

    const studentWhere: { schoolId: string; className: string; track?: TrackLevel } = {
      schoolId,
      className: cn,
    };
    const tr = trackParam?.trim().toUpperCase();
    if (tr && Object.values(TrackLevel).includes(tr as TrackLevel)) {
      studentWhere.track = tr as TrackLevel;
    }

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: { id: true, track: true, regNumber: true, user: { select: { firstName: true, lastName: true } } },
    });

    if (!students.length) {
      return {
        school,
        className: cn,
        track: studentWhere.track ?? null,
        studentCount: 0,
        windowDays,
        attendance: null,
        modules: null,
        grades: null,
        message: 'No students in this class (check class name and optional track).',
      };
    }

    const track = students[0].track;
    const studentIds = students.map((s) => s.id);

    // ── Attendance (window) ─────────────────────────────────
    const attRecords = await this.prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: { gte: since } },
      select: { status: true },
    });
    const present = attRecords.filter((r) => r.status === 'PRESENT').length;
    const absent = attRecords.filter((r) => r.status === 'ABSENT').length;
    const late = attRecords.filter((r) => r.status === 'LATE').length;
    const excused = attRecords.filter((r) => r.status === 'EXCUSED').length;
    const totalMarks = attRecords.length;
    const attendanceRatePercent = totalMarks ? Math.round((present / totalMarks) * 100) : null;

    // ── Module progress ───────────────────────────────────────
    const modulesInTrack = await this.prisma.module.findMany({
      where: { track },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, title: true },
    });

    const progressRows = await this.prisma.moduleProgress.findMany({
      where: { studentId: { in: studentIds } },
      select: { moduleId: true, status: true, score: true },
    });

    const byMod = new Map<string, typeof progressRows>();
    for (const p of progressRows) {
      const list = byMod.get(p.moduleId) || [];
      list.push(p);
      byMod.set(p.moduleId, list);
    }

    let currentModule: { id: string; number: number; title: string } | null = null;
    const moduleBreakdown: Array<{
      moduleId: string;
      number: number;
      title: string;
      completed: number;
      inProgress: number;
      failed: number;
      notStarted: number;
      avgScore: number | null;
    }> = [];

    for (const m of modulesInTrack) {
      const rows = byMod.get(m.id) || [];
      const completed = rows.filter((r) => r.status === 'COMPLETED').length;
      const inProgress = rows.filter((r) => r.status === 'IN_PROGRESS').length;
      const failed = rows.filter((r) => r.status === 'FAILED').length;
      const touched = rows.length;
      const notStarted = Math.max(0, students.length - touched);
      const scores = rows.map((r) => r.score).filter((s): s is number => s != null && !Number.isNaN(s));
      const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

      moduleBreakdown.push({
        moduleId: m.id,
        number: m.number,
        title: m.title,
        completed,
        inProgress,
        failed,
        notStarted,
        avgScore,
      });

      if (!currentModule && (inProgress > 0 || completed < students.length)) {
        currentModule = { id: m.id, number: m.number, title: m.title };
      }
    }

    const completedAll = modulesInTrack.length > 0 && moduleBreakdown.every((b) => b.completed >= students.length);

    // ── Grades: module assignments (curriculum) ──────────────
    const modAssignSubs = await this.prisma.assignmentSubmission.findMany({
      where: { studentId: { in: studentIds }, grade: { not: null } },
      select: { grade: true },
    });
    const modAssignGrades = modAssignSubs.map((s) => s.grade!).filter((g) => g != null);
    const moduleAssignmentAvg =
      modAssignGrades.length > 0
        ? Math.round((modAssignGrades.reduce((a, b) => a + b, 0) / modAssignGrades.length) * 10) / 10
        : null;

    // ── Class assignments (tutor homework) ───────────────────
    const classSubs = await this.prisma.classAssignmentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        score: { not: null },
        assignment: { schoolId, className: cn },
      },
      select: { score: true },
    });
    const classAssignScores = classSubs.map((s) => s.score!).filter((g) => g != null);
    const classAssignmentAvg =
      classAssignScores.length > 0
        ? Math.round((classAssignScores.reduce((a, b) => a + b, 0) / classAssignScores.length) * 10) / 10
        : null;

    // ── CBT attempts ──────────────────────────────────────────
    const cbtAttempts = await this.prisma.examAttempt.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'COMPLETED',
        score: { not: null },
      },
      select: { score: true },
    });
    const cbtScores = cbtAttempts.map((a) => a.score!).filter((g) => g != null);
    const cbtAvg = cbtScores.length > 0 ? Math.round((cbtScores.reduce((a, b) => a + b, 0) / cbtScores.length) * 10) / 10 : null;

    // ── Practicals ────────────────────────────────────────────
    const practicalSubs = await this.prisma.practicalSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        totalScore: { not: null },
        task: { schoolId, className: cn },
      },
      select: { totalScore: true },
    });
    const practScores = practicalSubs.map((s) => s.totalScore!).filter((g) => g != null);
    const practicalAvg =
      practScores.length > 0
        ? Math.round((practScores.reduce((a, b) => a + b, 0) / practScores.length) * 10) / 10
        : null;

    return {
      school,
      className: cn,
      track,
      studentCount: students.length,
      windowDays,
      attendance: {
        since: since.toISOString(),
        totalMarks,
        present,
        absent,
        late,
        excused,
        ratePercent: attendanceRatePercent,
      },
      modules: {
        currentModule,
        completedAll,
        modulesInTrack: modulesInTrack.length,
        moduleBreakdown,
      },
      grades: {
        moduleAssignments: {
          gradedCount: modAssignGrades.length,
          avgScore: moduleAssignmentAvg,
        },
        classAssignments: {
          gradedCount: classAssignScores.length,
          avgScore: classAssignmentAvg,
        },
        cbt: {
          completedAttempts: cbtScores.length,
          avgScore: cbtAvg,
        },
        practicals: {
          gradedCount: practScores.length,
          avgScore: practicalAvg,
        },
      },
    };
  }
}
