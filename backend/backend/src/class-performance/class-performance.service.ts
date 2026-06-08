import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackLevel } from '@prisma/client';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;

export type RollupResult = Awaited<ReturnType<ClassPerformanceService['getRollup']>>;

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
    termLabel?: string,
  ) {
    const cn = String(className || '').trim();
    if (!schoolId || !cn) throw new BadRequestException('schoolId and className are required');

    await this.assertAccess(userId, role, schoolId, cn);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, code: true },
    });
    if (!school) throw new NotFoundException('School not found');

    const termTrim = String(termLabel || '').trim();
    const termRow = termTrim
      ? await this.prisma.schoolTerm.findFirst({
          where: { schoolId, label: termTrim },
        })
      : null;

    let since: Date;
    let until: Date | null = null;
    if (termRow) {
      since = new Date(termRow.startedAt);
      until = termRow.endedAt ? new Date(termRow.endedAt) : new Date();
      since.setHours(0, 0, 0, 0);
      until.setHours(23, 59, 59, 999);
    } else {
      const windowDays = Math.min(365, Math.max(7, Math.floor(Number(days) || 30)));
      since = new Date();
      since.setDate(since.getDate() - windowDays);
      since.setHours(0, 0, 0, 0);
    }

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

    const windowDays = termRow
      ? Math.max(1, Math.ceil((until!.getTime() - since.getTime()) / (86400000)))
      : Math.min(365, Math.max(7, Math.floor(Number(days) || 30)));

    if (!students.length) {
      return {
        school,
        className: cn,
        track: studentWhere.track ?? null,
        studentCount: 0,
        windowDays,
        term: termRow
          ? {
              id: termRow.id,
              label: termRow.label,
              status: termRow.status,
              startedAt: termRow.startedAt.toISOString(),
              endedAt: termRow.endedAt?.toISOString() ?? null,
            }
          : termTrim
            ? { label: termTrim, status: 'UNKNOWN' as const }
            : null,
        attendance: null,
        modules: null,
        grades: null,
        message: 'No students in this class (check class name and optional track).',
      };
    }

    const track = students[0].track;
    const studentIds = students.map((s) => s.id);

    const attDateFilter = until ? { gte: since, lte: until } : { gte: since };
    const attRecords = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: attDateFilter,
        ...(termTrim ? { OR: [{ termLabel: termTrim }, { termLabel: null }] } : {}),
      },
      select: { status: true },
    });
    const present = attRecords.filter((r) => r.status === 'PRESENT').length;
    const absent = attRecords.filter((r) => r.status === 'ABSENT').length;
    const late = attRecords.filter((r) => r.status === 'LATE').length;
    const excused = attRecords.filter((r) => r.status === 'EXCUSED').length;
    const totalMarks = attRecords.length;
    const attendanceRatePercent = totalMarks ? Math.round((present / totalMarks) * 100) : null;

    const modulesInTrack = await this.prisma.module.findMany({
      where: { track },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, title: true },
    });

    const progressRows = await this.prisma.moduleProgress.findMany({
      where: {
        studentId: { in: studentIds },
        ...(termTrim ? { OR: [{ termLabel: termTrim }, { termLabel: null }] } : {}),
      },
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

    const modAssignSubs = await this.prisma.assignmentSubmission.findMany({
      where: { studentId: { in: studentIds }, grade: { not: null } },
      select: { grade: true },
    });
    const modAssignGrades = modAssignSubs.map((s) => s.grade!).filter((g) => g != null);
    const moduleAssignmentAvg =
      modAssignGrades.length > 0
        ? Math.round((modAssignGrades.reduce((a, b) => a + b, 0) / modAssignGrades.length) * 10) / 10
        : null;

    const classSubs = await this.prisma.classAssignmentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        score: { not: null },
        assignment: { schoolId, className: cn },
        ...(termTrim ? { OR: [{ termLabel: termTrim }, { termLabel: null }] } : {}),
      },
      select: { score: true },
    });
    const classAssignScores = classSubs.map((s) => s.score!).filter((g) => g != null);
    const classAssignmentAvg =
      classAssignScores.length > 0
        ? Math.round((classAssignScores.reduce((a, b) => a + b, 0) / classAssignScores.length) * 10) / 10
        : null;

    const cbtAttempts = await this.prisma.examAttempt.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'COMPLETED',
        score: { not: null },
        ...(termTrim ? { OR: [{ termLabel: termTrim }, { termLabel: null }] } : {}),
      },
      select: { score: true },
    });
    const cbtScores = cbtAttempts.map((a) => a.score!).filter((g) => g != null);
    const cbtAvg = cbtScores.length > 0 ? Math.round((cbtScores.reduce((a, b) => a + b, 0) / cbtScores.length) * 10) / 10 : null;

    const practicalSubs = await this.prisma.practicalSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        totalScore: { not: null },
        task: { schoolId, className: cn },
        ...(termTrim ? { OR: [{ termLabel: termTrim }, { termLabel: null }] } : {}),
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
      term: termRow
        ? {
            id: termRow.id,
            label: termRow.label,
            status: termRow.status,
            startedAt: termRow.startedAt.toISOString(),
            endedAt: termRow.endedAt?.toISOString() ?? null,
          }
        : termTrim
          ? { label: termTrim, status: 'UNKNOWN' as const }
          : null,
      attendance: {
        since: since.toISOString(),
        until: until?.toISOString() ?? null,
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

  async exportCsv(
    userId: string,
    role: string,
    schoolId: string,
    className: string,
    days?: number,
    track?: string,
    termLabel?: string,
  ): Promise<string> {
    const data = await this.getRollup(userId, role, schoolId, className, days, track, termLabel);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push('section,metric,value');
    lines.push(`meta,school,${esc(data.school.name)}`);
    lines.push(`meta,class,${esc(data.className)}`);
    lines.push(`meta,track,${esc(data.track)}`);
    lines.push(`meta,students,${data.studentCount}`);
    if (data.term) lines.push(`meta,term,${esc((data.term as any).label)}`);
    if (data.attendance) {
      lines.push(`attendance,rate_percent,${data.attendance.ratePercent ?? ''}`);
      lines.push(`attendance,present,${data.attendance.present}`);
      lines.push(`attendance,absent,${data.attendance.absent}`);
      lines.push(`attendance,late,${data.attendance.late}`);
      lines.push(`attendance,total_marks,${data.attendance.totalMarks}`);
    }
    if (data.grades) {
      lines.push(`grades,class_assignment_avg,${data.grades.classAssignments.avgScore ?? ''}`);
      lines.push(`grades,cbt_avg,${data.grades.cbt.avgScore ?? ''}`);
      lines.push(`grades,practical_avg,${data.grades.practicals.avgScore ?? ''}`);
    }
    lines.push('');
    lines.push('module_number,module_title,completed,in_progress,failed,not_started,avg_score');
    for (const m of data.modules?.moduleBreakdown ?? []) {
      lines.push(
        [m.number, esc(m.title), m.completed, m.inProgress, m.failed, m.notStarted, m.avgScore ?? ''].join(','),
      );
    }
    return lines.join('\n');
  }

  async exportTermReportPdf(
    userId: string,
    role: string,
    schoolId: string,
    className: string,
    days?: number,
    track?: string,
    termLabel?: string,
  ): Promise<Buffer> {
    const data = await this.getRollup(userId, role, schoolId, className, days, track, termLabel);
    const termName = (data.term as any)?.label || 'All terms';
    const trackName = String(data.track || '').replace('TRACK_', 'Track ');

    const moduleRows = (data.modules?.moduleBreakdown ?? []).map((m) => [
      String(m.number),
      m.title,
      String(m.completed),
      String(m.inProgress),
      String(m.failed),
      m.avgScore != null ? `${m.avgScore}%` : '—',
    ]);

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 48],
      content: [
        { text: 'AdharaEdu · Term class report', style: 'subheader', margin: [0, 0, 0, 4] },
        { text: data.school.name, style: 'header', margin: [0, 0, 0, 16] },
        {
          columns: [
            { width: '*', stack: [{ text: 'Class', style: 'label' }, { text: data.className, style: 'value' }] },
            { width: '*', stack: [{ text: 'Track', style: 'label' }, { text: trackName, style: 'value' }] },
            { width: '*', stack: [{ text: 'Term', style: 'label' }, { text: termName, style: 'value' }] },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          text: `Students: ${data.studentCount} · Generated ${new Date().toLocaleDateString('en-NG')}`,
          style: 'muted',
          margin: [0, 0, 0, 16],
        },
        { text: 'Summary', style: 'section' },
        {
          ul: [
            `Attendance rate: ${data.attendance?.ratePercent ?? '—'}% (${data.attendance?.present ?? 0} present of ${data.attendance?.totalMarks ?? 0} marks)`,
            `Class homework avg: ${data.grades?.classAssignments.avgScore ?? '—'}%`,
            `CBT avg: ${data.grades?.cbt.avgScore ?? '—'}%`,
            `Practical avg: ${data.grades?.practicals.avgScore ?? '—'}%`,
            `Current module: ${data.modules?.currentModule ? `Mod ${data.modules.currentModule.number} — ${data.modules.currentModule.title}` : '—'}`,
          ],
          margin: [0, 0, 0, 20],
        },
        { text: 'Module breakdown', style: 'section' },
        {
          table: {
            headerRows: 1,
            widths: [32, '*', 52, 52, 44, 44],
            body: [
              ['#', 'Module', 'Done', 'Active', 'Fail', 'Avg'],
              ...moduleRows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 10, color: '#666666' },
        section: { fontSize: 13, bold: true, margin: [0, 8, 0, 6] },
        label: { fontSize: 9, color: '#666666' },
        value: { fontSize: 11, bold: true },
        muted: { fontSize: 9, color: '#666666' },
      },
      defaultStyle: { fontSize: 10 },
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    return new Promise((resolve, reject) => {
      pdfDoc.getBuffer((buf: Buffer) => {
        if (buf) resolve(buf);
        else reject(new Error('PDF generation failed'));
      });
    });
  }
}
