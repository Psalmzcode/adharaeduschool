import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { AcademicAuditService, AuditActor } from '../academic-audit/academic-audit.service';
import { AcademicAuditAction } from '@prisma/client';

@Injectable()
export class ClassAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
    private audit: AcademicAuditService,
  ) {}

  async create(tutorUserId: string, data: any) {
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);
    if (!targets.length) throw new BadRequestException('At least one class target is required');

    const assignmentCreateData = (className: string) => ({
      tutorId: tutorUserId,
      schoolId: data.schoolId,
      className,
      moduleId: data.moduleId,
      title: data.title,
      description: data.description,
      dueDate: new Date(data.dueDate),
      maxScore: data.maxScore || 100,
      isPublished: true,
    });

    const notifyStudentsForClass = async (
      assignment: { schoolId: string; className: string },
      className: string,
    ) => {
      const students = await this.prisma.student.findMany({
        where: { schoolId: assignment.schoolId, className },
        include: { user: { select: { firstName: true, email: true } } },
      });

      const loginUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
      for (const s of students) {
        if (!s.user.email) continue;
        await this.emailService.sendAssignmentNotice({
          email: s.user.email,
          firstName: s.user.firstName,
          assignmentTitle: data.title,
          className,
          dueDate: new Date(data.dueDate).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          description: data.description,
          loginUrl,
        }).catch(() => {});
        await this.prisma.notification.create({
          data: {
            userId: s.userId,
            title: `New Assignment: ${data.title}`,
            message: `Your tutor posted a new assignment for ${className}. Due: ${new Date(data.dueDate).toLocaleDateString('en-NG')}`,
            link: '/dashboard/student?section=student-assignments',
          },
        }).catch(() => {});
      }
    };

    if (targets.length <= 1) {
      const className = targets[0] || String(data.className || '').trim();
      const assignment = await this.prisma.classAssignment.create({
        data: assignmentCreateData(className),
        include: { school: { select: { name: true } } },
      });
      await notifyStudentsForClass(assignment, className);
      return assignment;
    }

    const assignments = await this.prisma.$transaction(
      targets.map((className) =>
        this.prisma.classAssignment.create({
          data: assignmentCreateData(className),
          include: { school: { select: { name: true } } },
        }),
      ),
    );

    await Promise.all(assignments.map((a, i) => notifyStudentsForClass(a, targets[i]!)));
    return assignments;
  }

  async findByTutor(tutorUserId: string) {
    return this.prisma.classAssignment.findMany({
      where: { tutorId: tutorUserId },
      include: {
        _count: { select: { submissions: true } },
        school: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByClass(schoolId: string, className: string) {
    return this.prisma.classAssignment.findMany({
      where: { schoolId, className, isPublished: true },
      include: {
        _count: { select: { submissions: true } },
        school: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findByStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, className: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const assignments = await this.prisma.classAssignment.findMany({
      where: { schoolId: student.schoolId, className: student.className, isPublished: true },
      include: {
        submissions: { where: { studentId } },
      },
      orderBy: { dueDate: 'asc' },
    });
    return assignments.map(a => ({
      ...a,
      submission: a.submissions[0] || null,
      status: a.submissions[0]
        ? (a.submissions[0].score != null ? 'GRADED' : 'SUBMITTED')
        : new Date(a.dueDate) < new Date() ? 'OVERDUE' : 'PENDING',
    }));
  }

  async submit(assignmentId: string, studentId: string, data: { textBody?: string; fileUrl?: string }) {
    const assignment = await this.prisma.classAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { termLabel: true } });
    const isLate = new Date() > new Date(assignment.dueDate);
    return this.prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: { assignmentId, studentId, ...data, status: isLate ? 'LATE' : 'SUBMITTED', termLabel: student?.termLabel || null },
      update: { ...data, status: isLate ? 'LATE' : 'SUBMITTED', submittedAt: new Date(), termLabel: student?.termLabel || null },
    });
  }

  async grade(submissionId: string, score: number, feedback: string, actor?: AuditActor) {
    const sub = await this.prisma.classAssignmentSubmission.update({
      where: { id: submissionId },
      data: { score, feedback, status: 'GRADED', gradedAt: new Date() },
      include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, assignment: true },
    });
    // Notify student
    if (sub.student.user.email) {
      await this.prisma.notification.create({
        data: {
          userId: sub.student.userId,
          title: `Assignment Graded: ${sub.assignment.title}`,
          message: `Your assignment has been graded. Score: ${score}/${sub.assignment.maxScore}. ${feedback ? 'Feedback: ' + feedback : ''}`,
          link: '/dashboard/student?section=student-assignments',
        },
      });
    }
    if (actor) {
      const studentName = `${sub.student.user?.firstName || ''} ${sub.student.user?.lastName || ''}`.trim();
      await this.audit.log({
        schoolId: sub.assignment.schoolId,
        actor,
        action: AcademicAuditAction.ASSIGNMENT_GRADE,
        className: sub.assignment.className,
        studentId: sub.studentId,
        moduleId: sub.assignment.moduleId || undefined,
        summary: `Graded "${sub.assignment.title}" for ${studentName}: ${score}/${sub.assignment.maxScore}`,
        metadata: { submissionId, score, maxScore: sub.assignment.maxScore },
      });
    }
    return sub;
  }

  async findSubmissions(assignmentId: string) {
    return this.prisma.classAssignmentSubmission.findMany({
      where: { assignmentId },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async update(assignmentId: string, tutorUserId: string, data: any) {
    const row = await this.prisma.classAssignment.findUnique({ where: { id: assignmentId } });
    if (!row) throw new NotFoundException('Assignment not found');
    if (row.tutorId !== tutorUserId) throw new ForbiddenException('Not your assignment');
    return this.prisma.classAssignment.update({
      where: { id: assignmentId },
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        maxScore: data.maxScore,
        moduleId: data.moduleId,
        isPublished: data.isPublished,
      },
    });
  }

  async delete(assignmentId: string, tutorUserId: string) {
    const row = await this.prisma.classAssignment.findUnique({ where: { id: assignmentId } });
    if (!row) throw new NotFoundException('Assignment not found');
    if (row.tutorId !== tutorUserId) throw new ForbiddenException('Not your assignment');
    await this.prisma.classAssignmentSubmission.deleteMany({ where: { assignmentId } });
    return this.prisma.classAssignment.delete({ where: { id: assignmentId } });
  }
}
