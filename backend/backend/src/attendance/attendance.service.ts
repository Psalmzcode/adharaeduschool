import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // Mark attendance for multiple students at once
  async markBulk(
    records: { studentId: string; status: AttendanceStatus; notes?: string }[],
    date: string,
    markedBy: string,
  ) {
    const dateObj = new Date(date);
    const results = await Promise.all(
      records.map((r) =>
        this.prisma.attendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: dateObj } },
          create: { studentId: r.studentId, date: dateObj, status: r.status, notes: r.notes, markedBy },
          update: { status: r.status, notes: r.notes, markedBy },
        }),
      ),
    );
    return { marked: results.length, date };
  }

  // Get attendance for a class on a date
  async getClassAttendance(schoolId: string, className: string, date: string) {
    const dateObj = new Date(date);
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        attendanceRecords: { where: { date: dateObj } },
      },
    });
    return students.map((s) => ({
      studentId: s.id,
      regNumber: s.regNumber,
      name: `${s.user.firstName} ${s.user.lastName}`,
      avatarUrl: s.user.avatarUrl,
      status: s.attendanceRecords[0]?.status || null,
      notes: s.attendanceRecords[0]?.notes || null,
    }));
  }

  // Get a student's attendance history
  async getStudentAttendance(studentId: string, from?: string, to?: string) {
    const where: any = { studentId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const excused = records.filter((r) => r.status === 'EXCUSED').length;
    const rate = total ? Math.round((present / total) * 100) : 0;
    return { records, summary: { total, present, absent, late, excused, rate } };
  }

  // Weekly breakdown for a student
  async getWeeklyBreakdown(studentId: string, weeks = 5) {
    const result = [];
    const today = new Date();
    for (let w = 0; w < weeks; w++) {
      const ref = new Date(today);
      ref.setDate(today.getDate() - w * 7);
      const dow = ref.getDay(); // 0..6
      const daysFromFriday = (dow + 2) % 7; // Friday => 0
      const weekEnd = new Date(ref);
      weekEnd.setDate(ref.getDate() - daysFromFriday);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 4); // Monday

      const records = await this.prisma.attendance.findMany({
        where: { studentId, date: { gte: weekStart, lte: weekEnd } },
        orderBy: { date: 'asc' },
      });

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const dayMap: Record<string, string> = {};
      records.forEach((r) => {
        const dayName = days[r.date.getDay() - 1];
        if (dayName) dayMap[dayName] = r.status;
      });

      const present = Object.values(dayMap).filter((s) => s === 'PRESENT').length;
      const total = records.length;
      result.push({
        weekLabel: `${weekStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}–${weekEnd.toLocaleDateString('en-NG', { day: 'numeric' })}`,
        days: dayMap,
        rate: total ? Math.round((present / total) * 100) : null,
      });
    }
    return result;
  }

  // School-level attendance stats
  async getSchoolStats(schoolId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { student: { schoolId }, date: { gte: since } },
      _count: true,
    });
    return records;
  }

  async getSchoolWeekly(schoolId: string, weeks = 12, className?: string) {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const safeWeeks = Math.max(1, Math.min(52, weeks || 12));
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - safeWeeks * 7);
    startDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendance.findMany({
      where: {
        date: { gte: startDate },
        student: {
          schoolId,
          ...(className ? { className } : {}),
        },
      },
      select: { date: true, status: true },
      orderBy: { date: 'asc' },
    });

    const weekMap: Record<
      string,
      { weekStart: Date; weekEnd: Date; present: number; absent: number; late: number; excused: number; markedDateSet: Set<string> }
    > = {};

    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); // 0..6 (Sun..Sat)
      const diffToMonday = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diffToMonday);
      return d;
    };

    records.forEach((r) => {
      const weekStart = getWeekStart(r.date);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4);

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekStart,
          weekEnd,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          markedDateSet: new Set<string>(),
        };
      }

      const dayKey = r.date.toISOString().slice(0, 10);
      weekMap[weekKey].markedDateSet.add(dayKey);
      if (r.status === 'PRESENT') weekMap[weekKey].present += 1;
      else if (r.status === 'ABSENT') weekMap[weekKey].absent += 1;
      else if (r.status === 'LATE') weekMap[weekKey].late += 1;
      else if (r.status === 'EXCUSED') weekMap[weekKey].excused += 1;
    });

    const weekly = Object.values(weekMap)
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((w) => {
        const total = w.present + w.absent + w.late + w.excused;
        return {
          weekLabel: `${w.weekStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} - ${w.weekEnd.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`,
          weekStart: w.weekStart,
          weekEnd: w.weekEnd,
          present: w.present,
          absent: w.absent,
          late: w.late,
          excused: w.excused,
          total,
          rate: total ? Math.round((w.present / total) * 100) : null,
          markedDays: w.markedDateSet.size,
        };
      });

    return weekly;
  }
}
