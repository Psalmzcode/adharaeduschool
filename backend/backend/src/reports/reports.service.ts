import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private emailService: EmailService, private config: ConfigService) {}

  async create(tutorId: string, data: any) {
    return this.prisma.weeklyReport.create({
      data: { tutorId, schoolId: data.schoolId, weekStart: new Date(data.weekStart), weekEnd: new Date(data.weekEnd),
        track: data.track, className: data.className, topicsCoins: data.topics || [],
        attendanceRate: data.attendanceRate || 0, highlights: data.highlights, challenges: data.challenges,
        nextWeekPlan: data.nextWeekPlan, attachmentUrl: data.attachmentUrl },
      include: { tutor: { include: { user: { select: { firstName: true, lastName: true } } } }, school: { select: { name: true } } },
    });
  }

  async submit(id: string) {
    const report = await this.prisma.weeklyReport.update({
      where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: { tutor: { include: { user: true } }, school: true },
    });
    // Notify super admins
    const superAdmins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true } });
    const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    for (const admin of superAdmins) {
      if (admin.email) {
        await this.emailService.sendReportSubmitted({
          email: admin.email,
          tutorName: `${report.tutor?.user?.firstName} ${report.tutor?.user?.lastName}`,
          schoolName: report.school?.name || '',
          weekStart: new Date(report.weekStart).toLocaleDateString('en-NG'),
          weekEnd: new Date(report.weekEnd).toLocaleDateString('en-NG'),
          loginUrl,
        }).catch(() => {});
      }
    }
    return report;
  }

  async findAll(query: { tutorId?: string; schoolId?: string; status?: any }) {
    const where: any = {};
    if (query.tutorId) where.tutorId = query.tutorId;
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.status) where.status = query.status;
    return this.prisma.weeklyReport.findMany({
      where,
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
        school: { select: { name: true, state: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.weeklyReport.findUnique({
      where: { id },
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
        school: true,
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async review(id: string, reviewedBy: string, notes: string) {
    return this.prisma.weeklyReport.update({
      where: { id }, data: { status: 'REVIEWED', reviewedBy, reviewNotes: notes } });
  }

  async update(id: string, data: any) {
    return this.prisma.weeklyReport.update({ where: { id }, data });
  }
}
