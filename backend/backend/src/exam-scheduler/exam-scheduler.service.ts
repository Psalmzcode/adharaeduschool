import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExamSchedulerService {
  constructor(private prisma: PrismaService, private emailService: EmailService, private config: ConfigService) {}

  async schedule(data: {
    cbtExamId: string; schoolId: string; className: string;
    scheduledAt: string; venue?: string; durationMins?: number;
  }) {
    const exam = await this.prisma.cBTExam.findUnique({ where: { id: data.cbtExamId } });
    if (!exam) throw new NotFoundException('CBT Exam not found');
    if (!exam.isVetted) throw new Error('Exam must be vetted by super admin before scheduling');

    const accessCode = uuidv4().split('-')[0].toUpperCase();

    const schedule = await this.prisma.examSchedule.create({
      data: {
        cbtExamId: data.cbtExamId,
        schoolId: data.schoolId,
        className: data.className,
        scheduledAt: new Date(data.scheduledAt),
        venue: data.venue || 'Computer Lab',
        durationMins: data.durationMins || exam.durationMins,
        createdBy: 'SYSTEM',
        accessCode,
      },
      include: {
        cbtExam: { select: { title: true, durationMins: true } },
        school: { select: { name: true } },
      },
    });

    // Notify all students in the class
    const students = await this.prisma.student.findMany({
      where: { schoolId: data.schoolId, className: data.className },
      include: { user: { select: { firstName: true, email: true } } },
    });

    const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const examDate = new Date(data.scheduledAt);
    const dateStr = examDate.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = examDate.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

    for (const s of students) {
      if (s.user.email) {
        await this.emailService.sendExamReminder({
          email: s.user.email,
          firstName: s.user.firstName,
          examTitle: exam.title,
          date: dateStr,
          time: timeStr,
          venue: data.venue || 'Computer Lab',
          durationMins: data.durationMins || exam.durationMins,
          accessCode,
          loginUrl,
        });
        await this.prisma.notification.create({
          data: {
            userId: s.userId,
            title: `Exam Scheduled: ${exam.title}`,
            message: `${exam.title} is scheduled for ${dateStr} at ${timeStr} in ${data.venue || 'Computer Lab'}. Access code: ${accessCode}`,
            link: '/dashboard/student?section=student-exams',
          },
        });
      }
    }

    return schedule;
  }

  async getSchedules(schoolId?: string, className?: string) {
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (className) where.className = className;
    return this.prisma.examSchedule.findMany({
      where,
      include: { cbtExam: { select: { title: true, durationMins: true, track: true } }, school: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getUpcoming(schoolId: string, className?: string) {
    const where: any = { schoolId, scheduledAt: { gte: new Date() }, isActive: true };
    if (className) where.className = className;
    return this.prisma.examSchedule.findMany({
      where,
      include: { cbtExam: { select: { title: true, durationMins: true, track: true } } },
      orderBy: { scheduledAt: 'asc' }, take: 5,
    });
  }

  async cancel(id: string) {
    return this.prisma.examSchedule.update({ where: { id }, data: { isActive: false } });
  }
}
