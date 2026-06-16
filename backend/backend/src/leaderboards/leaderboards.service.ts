import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleStatus, ModuleType, Prisma, TrackLevel } from '@prisma/client';
import { modulesWhereForTrack } from '../common/module-curriculum';
import { PrismaService } from '../prisma/prisma.service';

export type LeaderboardScope = 'class' | 'track';

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  initials: string;
  regNumber: string;
  className: string;
  schoolId: string;
  schoolName: string;
  averageScore: number;
  modulesCompleted: number;
  isYou: boolean;
};

type AuthUser = { sub: string; role: string };

@Injectable()
export class LeaderboardsService {
  constructor(private prisma: PrismaService) {}

  private initials(first?: string | null, last?: string | null) {
    const a = String(first || '').trim()[0] || '';
    const b = String(last || '').trim()[0] || '';
    return (a + b).toUpperCase() || '?';
  }

  private ordinal(n: number) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /** Only finalized modules (class advanced) count toward track average. */
  private async trackModuleIds(track: TrackLevel, track3Stack?: string | null) {
    const rows = await this.prisma.module.findMany({
      where: {
        ...modulesWhereForTrack(track, track3Stack as any),
        moduleType: ModuleType.STANDARD,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Module counts only after tutor advances the whole class (every student COMPLETED or FAILED). */
  private studentClassKey(s: {
    schoolId: string;
    className: string;
    track: TrackLevel;
    track3Stack: string | null;
  }) {
    return `${s.schoolId}::${s.className}::${s.track}::${s.track3Stack ?? ''}`;
  }

  private async resolveClassFinalizedModuleIds(
    track: TrackLevel,
    track3Stack: string | null,
    studentIdsInClass: string[],
  ): Promise<string[]> {
    if (!studentIdsInClass.length) return [];

    const modules = await this.prisma.module.findMany({
      where: {
        ...modulesWhereForTrack(track, track3Stack as any),
        moduleType: ModuleType.STANDARD,
      },
      select: { id: true },
      orderBy: { number: 'asc' },
    });
    const moduleIds = modules.map((m) => m.id);
    if (!moduleIds.length) return [];

    const progress = await this.prisma.moduleProgress.findMany({
      where: {
        studentId: { in: studentIdsInClass },
        moduleId: { in: moduleIds },
        status: { in: [ModuleStatus.COMPLETED, ModuleStatus.FAILED] },
      },
      select: { studentId: true, moduleId: true },
    });

    const byModule = new Map<string, Set<string>>();
    for (const p of progress) {
      if (!byModule.has(p.moduleId)) byModule.set(p.moduleId, new Set());
      byModule.get(p.moduleId)!.add(p.studentId);
    }

    const need = studentIdsInClass.length;
    return moduleIds.filter((id) => (byModule.get(id)?.size ?? 0) === need);
  }

  private async computeEntries(
    students: Array<{
      id: string;
      regNumber: string;
      className: string;
      schoolId: string;
      user: { firstName: string | null; lastName: string | null };
      school: { name: string };
      track: TrackLevel;
      track3Stack: string | null;
    }>,
    viewerStudentId: string | null,
  ): Promise<LeaderboardEntry[]> {
    if (!students.length) return [];

    const groups = new Map<string, typeof students>();
    for (const s of students) {
      const key = this.studentClassKey(s);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const finalizedByClass = new Map<string, string[]>();
    for (const [key, group] of groups) {
      finalizedByClass.set(
        key,
        await this.resolveClassFinalizedModuleIds(
          group[0].track,
          group[0].track3Stack,
          group.map((g) => g.id),
        ),
      );
    }

    const allFinalizedIds = [...new Set([...finalizedByClass.values()].flat())];
    const studentIds = students.map((s) => s.id);

    const progress = allFinalizedIds.length
      ? await this.prisma.moduleProgress.findMany({
          where: {
            studentId: { in: studentIds },
            moduleId: { in: allFinalizedIds },
            status: ModuleStatus.COMPLETED,
            score: { not: null },
          },
          select: { studentId: true, moduleId: true, score: true },
        })
      : [];

    const byStudent = new Map<string, number[]>();
    for (const p of progress) {
      const student = students.find((s) => s.id === p.studentId);
      if (!student) continue;
      const finalized = new Set(finalizedByClass.get(this.studentClassKey(student)) || []);
      if (!finalized.has(p.moduleId)) continue;
      if (!byStudent.has(p.studentId)) byStudent.set(p.studentId, []);
      byStudent.get(p.studentId)!.push(Number(p.score));
    }

    const ranked = students
      .map((s) => {
        const finalized = finalizedByClass.get(this.studentClassKey(s)) || [];
        const scores = byStudent.get(s.id) || [];
        const averageScore = scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        return {
          studentId: s.id,
          name: `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || s.regNumber,
          initials: this.initials(s.user.firstName, s.user.lastName),
          regNumber: s.regNumber,
          className: s.className,
          schoolId: s.schoolId,
          schoolName: s.school.name,
          averageScore,
          modulesCompleted: finalized.length,
          isYou: viewerStudentId === s.id,
        };
      })
      .sort((a, b) => {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        if (b.modulesCompleted !== a.modulesCompleted) return b.modulesCompleted - a.modulesCompleted;
        return a.name.localeCompare(b.name);
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return ranked;
  }

  private buildStats(entries: LeaderboardEntry[], schoolCount: number, classCount: number) {
    const scores = entries.map((e) => e.averageScore).filter((s) => s > 0);
    const trackAverage = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const modulesActive = entries.reduce((m, e) => Math.max(m, e.modulesCompleted), 0);
    return {
      studentCount: entries.length,
      schoolCount,
      classCount,
      trackAverage,
      modulesActive,
      classAverage: trackAverage,
    };
  }

  private meBlock(entries: LeaderboardEntry[]) {
    const me = entries.find((e) => e.isYou);
    if (!me) return null;
    const above = entries.find((e) => e.rank === me.rank - 1);
    const gap = above ? Math.max(0, above.averageScore - me.averageScore) : 0;
    let gapLabel = '';
    if (gap > 0 && above) {
      gapLabel = `Need +${gap}% to reach ${this.ordinal(me.rank - 1)}`;
    } else if (me.rank > 20) {
      const top20 = entries.find((e) => e.rank === 20);
      if (top20) {
        const g = Math.max(0, top20.averageScore - me.averageScore);
        if (g > 0) gapLabel = `Need +${g}% for top 20`;
      }
    }
    return {
      rank: me.rank,
      rankLabel: this.ordinal(me.rank),
      name: me.name,
      className: me.className,
      schoolName: me.schoolName,
      averageScore: me.averageScore,
      modulesCompleted: me.modulesCompleted,
      gapToNext: gap,
      gapLabel,
    };
  }

  async getFilters(user: AuthUser) {
    const role = user.role;
    if (role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId: user.sub },
        select: { track: true, schoolId: true, className: true, school: { select: { name: true } } },
      });
      if (!student) throw new NotFoundException('Student not found');
      return {
        tracks: [student.track],
        schools: [{ id: student.schoolId, name: student.school.name }],
        classes: [{ className: student.className, track: student.track, schoolId: student.schoolId }],
        defaults: {
          track: student.track,
          schoolId: student.schoolId,
          className: student.className,
        },
      };
    }

    if (role === 'TUTOR') {
      const tutor = await this.prisma.tutor.findUnique({
        where: { userId: user.sub },
        select: { id: true },
      });
      if (!tutor) throw new NotFoundException('Tutor not found');
      const assignments = await this.prisma.tutorAssignment.findMany({
        where: { tutorId: tutor.id, isActive: true },
        select: { schoolId: true, className: true, track: true, school: { select: { name: true } } },
      });
      const schoolMap = new Map<string, string>();
      assignments.forEach((a) => schoolMap.set(a.schoolId, a.school.name));
      const tracks = [...new Set(assignments.map((a) => a.track))];
      return {
        tracks,
        schools: [...schoolMap.entries()].map(([id, name]) => ({ id, name })),
        classes: assignments.map((a) => ({
          className: a.className,
          track: a.track,
          schoolId: a.schoolId,
        })),
        defaults: {
          track: tracks[0] || TrackLevel.TRACK_1,
          schoolId: assignments[0]?.schoolId,
          className: assignments[0]?.className,
        },
      };
    }

    if (role === 'SCHOOL_ADMIN') {
      const admin = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { schoolId: true, school: { select: { id: true, name: true } } },
      });
      if (!admin?.schoolId) throw new ForbiddenException('No school linked');
      const notes = admin.school?.name;
      const students = await this.prisma.student.findMany({
        where: { schoolId: admin.schoolId },
        select: { className: true, track: true },
        distinct: ['className', 'track'],
      });
      const tracks = [...new Set(students.map((s) => s.track))];
      const classes = students.map((s) => ({
        className: s.className,
        track: s.track,
        schoolId: admin.schoolId!,
      }));
      return {
        tracks,
        schools: [{ id: admin.schoolId, name: notes || 'My school' }],
        classes,
        defaults: {
          track: tracks[0] || TrackLevel.TRACK_1,
          schoolId: admin.schoolId,
          className: classes[0]?.className,
        },
      };
    }

    // SUPER_ADMIN
    const schools = await this.prisma.school.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const students = await this.prisma.student.findMany({
      select: { className: true, track: true, schoolId: true },
      distinct: ['schoolId', 'className', 'track'],
    });
    const tracks = [...new Set(students.map((s) => s.track))];
    return {
      tracks,
      schools,
      classes: students.map((s) => ({
        className: s.className,
        track: s.track,
        schoolId: s.schoolId,
      })),
      defaults: {
        track: TrackLevel.TRACK_1,
        schoolId: schools[0]?.id,
        className: students.find((s) => s.track === TrackLevel.TRACK_1)?.className,
      },
    };
  }

  async getLeaderboard(
    user: AuthUser,
    query: {
      track?: TrackLevel;
      scope?: LeaderboardScope;
      schoolId?: string;
      className?: string;
      crossSchool?: boolean;
    },
  ) {
    const filters = await this.getFilters(user);
    const track = query.track || filters.defaults.track;
    const scope: LeaderboardScope = query.scope || 'class';

    let viewerStudentId: string | null = null;
    let schoolId = query.schoolId || filters.defaults.schoolId;
    let className = query.className || filters.defaults.className;

    if (user.role === 'STUDENT') {
      const me = await this.prisma.student.findUnique({
        where: { userId: user.sub },
        select: { id: true, track: true, schoolId: true, className: true },
      });
      if (!me) throw new NotFoundException('Student not found');
      viewerStudentId = me.id;
      if (me.track !== track) {
        throw new ForbiddenException('Leaderboard track must match your enrollment');
      }
      // My class = this class only; All classes = every class on this track at my school (not cross-school yet).
      schoolId = me.schoolId;
      className = scope === 'class' ? me.className : className;
    }

    if (user.role === 'SCHOOL_ADMIN') {
      const admin = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { schoolId: true },
      });
      schoolId = admin!.schoolId!;
    }

    const crossSchoolTrack =
      scope === 'track' &&
      user.role === 'SUPER_ADMIN' &&
      query.crossSchool === true;

    const where: Prisma.StudentWhereInput = { track };
    if (scope === 'class') {
      if (!schoolId || !className) {
        throw new ForbiddenException('schoolId and className required for class scope');
      }
      where.schoolId = schoolId;
      where.className = className;
    } else if (!crossSchoolTrack && schoolId) {
      where.schoolId = schoolId;
    }

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        regNumber: true,
        className: true,
        schoolId: true,
        track: true,
        track3Stack: true,
        user: { select: { firstName: true, lastName: true } },
        school: { select: { name: true } },
      },
    });

    const schoolIds = new Set(students.map((s) => s.schoolId));
    const classCount = new Set(students.map((s) => `${s.schoolId}::${s.className}`)).size;
    const entries = await this.computeEntries(students, viewerStudentId);
    const stats = this.buildStats(entries, schoolIds.size, classCount);
    const top3 = entries.slice(0, 3);
    const me = this.meBlock(entries);

    const school = schoolId
      ? await this.prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, currentTermLabel: true, academicYearLabel: true },
        })
      : null;

    const termLabel = [school?.academicYearLabel, school?.currentTermLabel].filter(Boolean).join(' · ') || 'Current term';

    return {
      track,
      scope,
      termLabel,
      crossSchoolTrack,
      schoolId: scope === 'class' ? schoolId : crossSchoolTrack ? null : schoolId,
      className: scope === 'class' ? className : null,
      meta: {
        ...stats,
        inYourClass: scope === 'class' ? stats.studentCount : undefined,
      },
      top3,
      me,
      rankings: entries,
      filters,
    };
  }
}
