import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService, private emailService: EmailService, private config: ConfigService) {}

  async calculate(tutorId: string, schoolId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const sessions = await this.prisma.sessionLog.findMany({
      where: { tutorId, schoolId, startedAt: { gte: start, lte: end }, endedAt: { not: null } },
    });
    const reports = await this.prisma.weeklyReport.findMany({
      where: { tutorId, schoolId, weekStart: { gte: start, lte: end }, status: { in: ['SUBMITTED', 'REVIEWED'] } },
    });
    const ratePerSession = 2500; // ₦2,500 per session — configurable
    const totalSessions = sessions.length;
    const grossAmount = totalSessions * ratePerSession;
    const deductions = 0;
    const netAmount = grossAmount - deductions;

    return this.prisma.tutorPayroll.upsert({
      where: { tutorId_schoolId_month_year: { tutorId, schoolId, month, year } },
      create: { tutorId, schoolId, month, year, totalSessions, ratePerSession, grossAmount, deductions, netAmount, reportIds: reports.map(r => r.id) },
      update: { totalSessions, ratePerSession, grossAmount, deductions, netAmount, reportIds: reports.map(r => r.id) },
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        school: { select: { name: true } },
      },
    });
  }

  async markPaid(payrollId: string) {
    const payroll = await this.prisma.tutorPayroll.update({
      where: { id: payrollId },
      data: { isPaid: true, paidAt: new Date() },
      include: {
        tutor: { include: { user: { select: { firstName: true, email: true } } } },
        school: { select: { name: true } },
      },
    });
    // Notify tutor by email
    if (payroll.tutor.user.email) {
      const month = new Date(payroll.year, payroll.month - 1).toLocaleString('en-NG', { month: 'long', year: 'numeric' });
      await this.emailService.send?.(payroll.tutor.user.email, `Payroll Processed — ${month}`,
        `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <h2 style="color:#14532d">Payroll Processed ✅</h2>
          <p>Hello ${payroll.tutor.user.firstName}, your payroll for <strong>${month}</strong> at <strong>${payroll.school.name}</strong> has been processed.</p>
          <p><strong>Net Amount:</strong> ₦${payroll.netAmount.toLocaleString()}</p>
          <p><strong>Sessions Taught:</strong> ${payroll.totalSessions}</p>
          <p style="color:#888;font-size:12px">AdharaEdu Payroll System</p>
        </div>`
      );
    }
    return payroll;
  }

  async findAll(query: { tutorId?: string; schoolId?: string; month?: number; year?: number; isPaid?: boolean }) {
    const where: any = {};
    if (query.tutorId) where.tutorId = query.tutorId;
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.isPaid !== undefined) where.isPaid = query.isPaid;
    return this.prisma.tutorPayroll.findMany({
      where,
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        school: { select: { name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getSummary(year: number) {
    const records = await this.prisma.tutorPayroll.findMany({ where: { year } });
    return {
      totalPayroll: records.reduce((s, r) => s + r.netAmount, 0),
      paid: records.filter(r => r.isPaid).reduce((s, r) => s + r.netAmount, 0),
      unpaid: records.filter(r => !r.isPaid).reduce((s, r) => s + r.netAmount, 0),
      tutorCount: new Set(records.map(r => r.tutorId)).size,
    };
  }
}
