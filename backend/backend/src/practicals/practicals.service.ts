import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef } from '../common/module-content';

@Injectable()
export class PracticalsService {
  constructor(private prisma: PrismaService) {}

  async createTask(tutorUserId: string, data: any) {
    const moduleRef = await resolveModuleRef(this.prisma, data?.moduleId);
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);
    if (!targets.length) throw new BadRequestException('At least one class target is required');
    if (!String(data.schoolId || '').trim()) throw new BadRequestException('schoolId is required');

    const title = String(data.title || '').trim() || `Practical: Module ${moduleRef.moduleNumber}`;
    const createOne = (className: string) =>
      this.prisma.practicalTask.create({
        data: {
          tutorId: tutorUserId,
          schoolId: String(data.schoolId),
          className,
          moduleId: moduleRef.moduleId,
          title,
          description: data.description ? String(data.description) : undefined,
          instructions: data.instructions ? String(data.instructions) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          maxScore: Number(data.maxScore) > 0 ? Number(data.maxScore) : 100,
          passScore: Number.isFinite(Number(data.passScore)) ? Number(data.passScore) : 50,
          rubric: data.rubric ?? null,
          isPublished: data.isPublished !== false,
        },
      });

    const notifyForClass = async (className: string, task: { id: string; title: string; dueDate: Date | null }) => {
      const students = await this.prisma.student.findMany({
        where: { schoolId: String(data.schoolId), className },
        select: { userId: true },
      });
      const due =
        task.dueDate != null
          ? ` Due: ${new Date(task.dueDate).toLocaleDateString('en-NG')}`
          : '';
      const rows = students.map((s) => ({
        userId: s.userId,
        title: `New Practical: ${task.title}`,
        message: `A new practical has been posted for ${className}.${due}`,
        link: '/dashboard/student?section=student-practicals',
      }));
      if (rows.length) {
        await this.prisma.notification.createMany({ data: rows }).catch(() => {});
      }
    };

    if (targets.length <= 1) {
      const t = await createOne(targets[0]);
      if (t?.isPublished) await notifyForClass(t.className, t).catch(() => {});
      return t;
    }

    const tasks = await this.prisma.$transaction(targets.map((className) => createOne(className)));
    await Promise.all(
      tasks.map((t: any) => (t?.isPublished ? notifyForClass(t.className, t) : Promise.resolve())),
    ).catch(() => {});
    return tasks;
  }

  async listTasks(query: { tutorId?: string; schoolId?: string; className?: string; moduleId?: string }) {
    const where: any = {};
    if (query.tutorId) where.tutorId = query.tutorId;
    if (query.schoolId) where.schoolId = query.schoolId;
    if (query.className) where.className = query.className;
    if (query.moduleId) where.moduleId = query.moduleId;
    return this.prisma.practicalTask.findMany({
      where,
      include: {
        module: { select: { id: true, number: true, title: true, track: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStudentTasks(studentUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      select: { id: true, schoolId: true, className: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    const tasks = await this.prisma.practicalTask.findMany({
      where: { schoolId: student.schoolId, className: student.className, isPublished: true },
      include: {
        module: { select: { id: true, number: true, title: true, track: true } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return tasks.map((t) => ({
      ...t,
      submission: t.submissions[0] || null,
      status: t.submissions[0]?.status || (t.dueDate && new Date(t.dueDate) < new Date() ? 'OVERDUE' : 'PENDING'),
    }));
  }

  async submit(taskId: string, studentUserId: string, data: { evidenceUrl?: string; evidenceText?: string }) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      select: { id: true, schoolId: true, className: true, termLabel: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const task = await this.prisma.practicalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Practical task not found');
    if (task.schoolId !== student.schoolId || task.className !== student.className) {
      throw new BadRequestException('Task is not assigned to this student class');
    }

    const isLate = !!task.dueDate && new Date() > new Date(task.dueDate);
    return this.prisma.practicalSubmission.upsert({
      where: { taskId_studentId: { taskId, studentId: student.id } },
      create: {
        taskId,
        studentId: student.id,
        termLabel: student.termLabel || null,
        evidenceUrl: data.evidenceUrl,
        evidenceText: data.evidenceText,
        status: isLate ? 'LATE' : 'SUBMITTED',
      },
      update: {
        termLabel: student.termLabel || null,
        evidenceUrl: data.evidenceUrl,
        evidenceText: data.evidenceText,
        status: isLate ? 'LATE' : 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  async listSubmissions(taskId: string) {
    const task = await this.prisma.practicalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Practical task not found');

    const submissions = await this.prisma.practicalSubmission.findMany({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
    });
    const studentIds: string[] = Array.from(
      new Set(submissions.map((s) => String(s.studentId || '')).filter((id) => id.length > 0)),
    );
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const studentMap = new Map(students.map((s: any) => [s.id, s]));
    return submissions.map((s: any) => ({
      ...s,
      student: studentMap.get(s.studentId) || null,
    }));
  }

  async gradeSubmission(submissionId: string, graderUserId: string, data: { totalScore: number; feedback?: string; scoreBreakdown?: any }) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: { task: true },
    });
    if (!submission) throw new NotFoundException('Practical submission not found');

    const totalScore = Number(data.totalScore);
    if (!Number.isFinite(totalScore)) throw new BadRequestException('totalScore must be a number');
    const boundedScore = Math.max(0, Math.min(submission.task.maxScore || 100, totalScore));
    const status = boundedScore >= (submission.task.passScore ?? 50) ? 'PASSED' : 'REWORK_REQUIRED';

    return this.prisma.practicalSubmission.update({
      where: { id: submissionId },
      data: {
        totalScore: boundedScore,
        feedback: data.feedback ? String(data.feedback) : null,
        scoreBreakdown: data.scoreBreakdown ?? null,
        status,
        gradedAt: new Date(),
        gradedBy: graderUserId,
      },
    });
  }

  async bulkGrade(taskId: string, graderUserId: string, data: { submissionIds?: string[]; totalScore: number; feedback?: string; scoreBreakdown?: any }) {
    const task = await this.prisma.practicalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Practical task not found');

    const totalScore = Number(data.totalScore);
    if (!Number.isFinite(totalScore)) throw new BadRequestException('totalScore must be a number');
    const boundedScore = Math.max(0, Math.min(task.maxScore || 100, totalScore));
    const status = boundedScore >= (task.passScore ?? 50) ? 'PASSED' : 'REWORK_REQUIRED';
    const targetIds: string[] = Array.isArray(data.submissionIds)
      ? Array.from(new Set(data.submissionIds.map((id) => String(id)).filter(Boolean)))
      : [];

    const targets = await this.prisma.practicalSubmission.findMany({
      where: {
        taskId,
        ...(targetIds.length ? { id: { in: targetIds } } : {}),
      },
      select: { id: true },
    });
    if (!targets.length) return { updated: 0 };

    await this.prisma.$transaction(
      targets.map((s) =>
        this.prisma.practicalSubmission.update({
          where: { id: s.id },
          data: {
            totalScore: boundedScore,
            feedback: data.feedback ? String(data.feedback) : null,
            scoreBreakdown: data.scoreBreakdown ?? null,
            status,
            gradedAt: new Date(),
            gradedBy: graderUserId,
          },
        }),
      ),
    );
    return { updated: targets.length };
  }
}
