import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

type IdNameRow = { id: string; userId: string };

function startOfDayInLagos(d = new Date()) {
  // Good enough for Lagos (no DST). Use local time (server should be configured).
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(private prisma: PrismaService) {}

  // Twice daily: morning + evening, Africa/Lagos time.
  @Cron('0 7 * * *', { timeZone: 'Africa/Lagos' })
  async morningRun() {
    await this.runDueSoonReminders('morning');
  }

  @Cron('0 18 * * *', { timeZone: 'Africa/Lagos' })
  async eveningRun() {
    await this.runDueSoonReminders('evening');
  }

  private async runDueSoonReminders(tag: 'morning' | 'evening') {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStart = startOfDayInLagos(now);

    try {
      await Promise.all([
        this.assignmentsDueSoon(now, soon, todayStart, tag),
        this.practicalsDueSoon(now, soon, todayStart, tag),
        this.examsDueSoon(now, soon, todayStart, tag),
      ]);
      this.logger.log(`Reminders OK (${tag})`);
    } catch (e: any) {
      this.logger.error(`Reminders failed (${tag}): ${e?.message || e}`);
    }
  }

  private async assignmentsDueSoon(now: Date, soon: Date, todayStart: Date, tag: string) {
    const assignments = await this.prisma.classAssignment.findMany({
      where: { isPublished: true, dueDate: { gt: now, lte: soon } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        schoolId: true,
        className: true,
        submissions: { select: { studentId: true } },
      },
    });
    if (!assignments.length) return;

    for (const a of assignments) {
      const students = await this.prisma.student.findMany({
        where: { schoolId: a.schoolId, className: a.className },
        select: { id: true, userId: true },
      });
      if (!students.length) continue;

      const submitted = new Set<string>((a.submissions || []).map((s) => s.studentId));
      const pendingUsers: IdNameRow[] = students
        .filter((s) => !submitted.has(s.id))
        .map((s) => ({ id: s.id, userId: s.userId }));
      if (!pendingUsers.length) continue;

      const link = `/dashboard/student?section=student-assignments&assignmentId=${encodeURIComponent(a.id)}`;
      const already = await this.prisma.notification.findMany({
        where: {
          createdAt: { gte: todayStart },
          link,
          userId: { in: pendingUsers.map((p) => p.userId) },
        },
        select: { userId: true },
      });
      const alreadySet = new Set(already.map((r) => r.userId));
      const targets = pendingUsers.filter((p) => !alreadySet.has(p.userId));
      if (!targets.length) continue;

      const dueStr = new Date(a.dueDate).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const title = `Reminder: Assignment due soon`;
      const message = `“${a.title}” is due by ${dueStr}. Please submit before the deadline.`;

      await this.prisma.notification.createMany({
        data: targets.map((t) => ({ userId: t.userId, title, message, link })),
      });
      this.logger.log(`Assignment reminders: ${a.className} ${a.id} targets=${targets.length} (${tag})`);
    }
  }

  private async practicalsDueSoon(now: Date, soon: Date, todayStart: Date, tag: string) {
    const tasks = await this.prisma.practicalTask.findMany({
      where: { isPublished: true, dueDate: { not: null, gt: now, lte: soon } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        schoolId: true,
        className: true,
        submissions: { select: { studentId: true } },
      },
    });
    if (!tasks.length) return;

    for (const t of tasks) {
      const students = await this.prisma.student.findMany({
        where: { schoolId: t.schoolId, className: t.className },
        select: { id: true, userId: true },
      });
      if (!students.length) continue;

      const submitted = new Set<string>((t.submissions || []).map((s) => s.studentId));
      const pendingUsers: IdNameRow[] = students
        .filter((s) => !submitted.has(s.id))
        .map((s) => ({ id: s.id, userId: s.userId }));
      if (!pendingUsers.length) continue;

      const link = `/dashboard/student?section=student-practicals&taskId=${encodeURIComponent(t.id)}`;
      const already = await this.prisma.notification.findMany({
        where: {
          createdAt: { gte: todayStart },
          link,
          userId: { in: pendingUsers.map((p) => p.userId) },
        },
        select: { userId: true },
      });
      const alreadySet = new Set(already.map((r) => r.userId));
      const targets = pendingUsers.filter((p) => !alreadySet.has(p.userId));
      if (!targets.length) continue;

      const dueStr = t.dueDate
        ? new Date(t.dueDate).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      const title = `Reminder: Practical due soon`;
      const message = t.dueDate
        ? `“${t.title}” is due by ${dueStr}. Submit your work before the deadline.`
        : `“${t.title}” is due soon. Submit your work.`;

      await this.prisma.notification.createMany({
        data: targets.map((x) => ({ userId: x.userId, title, message, link })),
      });
      this.logger.log(`Practical reminders: ${t.className} ${t.id} targets=${targets.length} (${tag})`);
    }
  }

  private async examsDueSoon(now: Date, soon: Date, todayStart: Date, tag: string) {
    const schedules = await this.prisma.examSchedule.findMany({
      where: {
        isActive: true,
        status: 'SCHEDULED',
        scheduledAt: { gt: now, lte: soon },
      },
      select: {
        id: true,
        schoolId: true,
        className: true,
        scheduledAt: true,
        venue: true,
        cbtExam: { select: { title: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!schedules.length) return;

    for (const s of schedules) {
      const students = await this.prisma.student.findMany({
        where: { schoolId: s.schoolId, className: s.className },
        select: { userId: true },
      });
      if (!students.length) continue;

      const link = `/dashboard/student?section=student-exams&scheduleId=${encodeURIComponent(s.id)}`;
      const already = await this.prisma.notification.findMany({
        where: {
          createdAt: { gte: todayStart },
          link,
          userId: { in: students.map((x) => x.userId) },
        },
        select: { userId: true },
      });
      const alreadySet = new Set(already.map((r) => r.userId));
      const targets = students.filter((x) => !alreadySet.has(x.userId));
      if (!targets.length) continue;

      const when = new Date(s.scheduledAt).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const title = `Reminder: Exam coming up`;
      const message = `“${s.cbtExam?.title || 'CBT Exam'}” is scheduled for ${when} at ${s.venue || 'Computer Lab'}.`;

      await this.prisma.notification.createMany({
        data: targets.map((x) => ({ userId: x.userId, title, message, link })),
      });
      this.logger.log(`Exam reminders: ${s.className} ${s.id} targets=${targets.length} (${tag})`);
    }
  }
}

