import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { assertPracticalGradingAccess } from './practical-access.util';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef } from '../common/module-content';
import { AcademicAuditService, AuditActor } from '../academic-audit/academic-audit.service';
import { AcademicAuditAction } from '@prisma/client';
import { GradingOrchestratorService } from '../evidence-grading/grading-orchestrator.service';
import { SubmissionEvidenceService } from '../evidence-grading/submission-evidence.service';
import { SubmissionGradingHelperService } from '../evidence-grading/submission-grading-helper.service';
import { UploadValidationService } from '../evidence-grading/validation/upload-validation.service';

@Injectable()
export class PracticalsService {
  private readonly logger = new Logger(PracticalsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AcademicAuditService,
    private orchestrator: GradingOrchestratorService,
    private evidenceService: SubmissionEvidenceService,
    private uploadValidation: UploadValidationService,
    private gradingHelper: SubmissionGradingHelperService,
  ) {}

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
          submissionType: data.submissionType ? String(data.submissionType) : 'mixed',
          allowedExtensions: data.allowedExtensions ?? null,
          maxSizeMB: Number(data.maxSizeMB) > 0 ? Number(data.maxSizeMB) : 10,
          structuredRubric: data.structuredRubric ?? null,
          modelAnswer: data.modelAnswer ? String(data.modelAnswer) : null,
          lessonObjective: data.lessonObjective ? String(data.lessonObjective) : null,
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
        submissions: { where: { studentId: student.id }, orderBy: { submittedAt: 'desc' } },
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

    // Allow multiple submissions (retakes) per task by incrementing attempt count.
    const last = await this.prisma.practicalSubmission.findFirst({
      where: { taskId, studentId: student.id },
      orderBy: [{ attempt: 'desc' }, { submittedAt: 'desc' }],
      select: { attempt: true },
    });
    const attempt = (last?.attempt || 0) + 1;

    const evidenceUrl = data.evidenceUrl?.trim() || undefined;
    if (evidenceUrl) {
      this.uploadValidation.assertValidOrThrow({
        url: evidenceUrl,
        allowedExtensions: Array.isArray(task.allowedExtensions) ? (task.allowedExtensions as string[]) : null,
        submissionType: task.submissionType,
      });
    }
    if (!evidenceUrl && !data.evidenceText?.trim()) {
      throw new BadRequestException('Submit evidence text and/or upload a file');
    }

    const submission = await this.prisma.practicalSubmission.create({
      data: {
        taskId,
        studentId: student.id,
        attempt,
        termLabel: student.termLabel || null,
        evidenceUrl,
        evidenceText: data.evidenceText,
        status: isLate ? 'LATE' : 'SUBMITTED',
        extractionStatus: 'pending',
      },
    });

    void this.runBackgroundExtraction(submission.id).catch((err) => {
      this.logger.warn(
        `Background extraction failed for practical submission ${submission.id}: ${err?.message || err}`,
      );
    });
    return submission;
  }

  private async runBackgroundExtraction(submissionId: string) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: { task: true },
    });
    if (!submission) return;

    const { evidence, status, error } = await this.orchestrator.extractOnly({
      evidenceUrl: submission.evidenceUrl,
      evidenceText: submission.evidenceText,
      submissionType: submission.task.submissionType,
      allowedExtensions: Array.isArray(submission.task.allowedExtensions)
        ? (submission.task.allowedExtensions as string[])
        : null,
      maxSizeMB: submission.task.maxSizeMB,
      lessonObjective: submission.task.lessonObjective,
    });

    await this.prisma.practicalSubmission.update({
      where: { id: submissionId },
      data: this.gradingHelper.extractionPersistData(evidence, status, error),
    });
  }

  async listSubmissions(taskId: string, actorUserId: string, actorRole?: string) {
    const task = await this.prisma.practicalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Practical task not found');
    await assertPracticalGradingAccess(this.prisma, task, actorUserId, actorRole);

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

  async gradeSubmission(
    submissionId: string,
    graderUserId: string,
    data: { totalScore: number; feedback?: string; scoreBreakdown?: any },
    actorRole?: string,
  ) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: { task: true },
    });
    if (!submission) throw new NotFoundException('Practical submission not found');
    await assertPracticalGradingAccess(this.prisma, submission.task, graderUserId, actorRole);

    const totalScore = Number(data.totalScore);
    if (!Number.isFinite(totalScore)) throw new BadRequestException('totalScore must be a number');
    const boundedScore = Math.max(0, Math.min(submission.task.maxScore || 100, totalScore));
    const status = boundedScore >= (submission.task.passScore ?? 50) ? 'PASSED' : 'REWORK_REQUIRED';

    const student = await this.prisma.student.findUnique({
      where: { id: submission.studentId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const studentName = `${student?.user?.firstName || ''} ${student?.user?.lastName || ''}`.trim() || 'Student';

    const scoreBreakdown =
      data.scoreBreakdown ??
      submission.aiScoreBreakdown ??
      submission.scoreBreakdown ??
      null;

    const updated = await this.prisma.practicalSubmission.update({
      where: { id: submissionId },
      data: {
        totalScore: boundedScore,
        feedback: data.feedback ? String(data.feedback) : null,
        scoreBreakdown,
        status,
        gradedAt: new Date(),
        gradedBy: graderUserId,
      },
    });

    await this.audit.log({
      schoolId: submission.task.schoolId,
      actor: { userId: graderUserId, role: actorRole || 'TUTOR' },
      action: AcademicAuditAction.PRACTICAL_GRADE,
      className: submission.task.className,
      studentId: submission.studentId,
      moduleId: submission.task.moduleId,
      summary: `Graded practical "${submission.task.title}" for ${studentName}: ${boundedScore}/${submission.task.maxScore || 100}`,
      metadata: { submissionId, totalScore: boundedScore, status },
    });

    return updated;
  }

  async bulkGrade(taskId: string, graderUserId: string, data: { submissionIds?: string[]; totalScore: number; feedback?: string; scoreBreakdown?: any }, actorRole?: string) {
    const task = await this.prisma.practicalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Practical task not found');
    await assertPracticalGradingAccess(this.prisma, task, graderUserId, actorRole);

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

    await this.audit.log({
      schoolId: task.schoolId,
      actor: { userId: graderUserId, role: actorRole || 'TUTOR' },
      action: AcademicAuditAction.PRACTICAL_GRADE,
      className: task.className,
      moduleId: task.moduleId,
      summary: `Bulk graded practical "${task.title}" for ${targets.length} submission(s) at ${boundedScore}/${task.maxScore || 100}`,
      metadata: { taskId, count: targets.length, totalScore: boundedScore },
    });

    return { updated: targets.length };
  }

  /** Evidence pipeline + AI proposal; tutor must approve before grade is final. */
  async proposeAiGrade(submissionId: string, tutorUserId: string) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: { module: { select: { number: true, title: true } } },
        },
      },
    });
    if (!submission) throw new NotFoundException('Practical submission not found');
    await assertPracticalGradingAccess(this.prisma, submission.task, tutorUserId, 'TUTOR');
    const hasSource =
      Boolean(submission.evidenceText?.trim() || submission.evidenceUrl?.trim()) ||
      this.gradingHelper.submissionHasGradeableSource(submission);
    if (!hasSource) {
      throw new BadRequestException('Submission has no evidence to grade');
    }

    const { evidence, status, error, proposal } = await this.gradingHelper.extractAndPropose(
      submission.task,
      submission,
    );

    return this.prisma.practicalSubmission.update({
      where: { id: submissionId },
      data: this.gradingHelper.proposalPersistData(proposal, evidence, status, error),
    });
  }

  async getGradingPreview(submissionId: string, actorUserId: string, actorRole?: string) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            submissionType: true,
            tutorId: true,
            schoolId: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Practical submission not found');
    await assertPracticalGradingAccess(this.prisma, submission.task, actorUserId, actorRole);
    return this.gradingHelper.gradingPreviewPayload(submission, submission.task);
  }

  /** Apply AI proposal as the official grade (tutor may override score/feedback in body). */
  async approveAiGrade(
    submissionId: string,
    graderUserId: string,
    data?: { totalScore?: number; feedback?: string },
    actorRole?: string,
  ) {
    const submission = await this.prisma.practicalSubmission.findUnique({
      where: { id: submissionId },
      include: { task: { select: { tutorId: true, schoolId: true, submissionType: true } } },
    });
    if (!submission) throw new NotFoundException('Practical submission not found');
    await assertPracticalGradingAccess(this.prisma, submission.task, graderUserId, actorRole);
    if (submission.aiProposedScore == null) {
      throw new BadRequestException('No AI grade proposal on this submission — run AI grade first');
    }

    this.gradingHelper.assertCanApproveAi(submission, submission.task.submissionType);

    return this.gradeSubmission(
      submissionId,
      graderUserId,
      {
        totalScore: data?.totalScore ?? submission.aiProposedScore,
        feedback: data?.feedback ?? submission.aiProposedFeedback ?? undefined,
        scoreBreakdown: submission.aiScoreBreakdown ?? undefined,
      },
      actorRole,
    );
  }

  async listAiReviewQueue(tutorUserId: string) {
    const tasks = await this.prisma.practicalTask.findMany({
      where: { tutorId: tutorUserId },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);
    if (!taskIds.length) return [];

    const submissions = await this.prisma.practicalSubmission.findMany({
      where: {
        taskId: { in: taskIds },
        aiProposedScore: { not: null },
        gradedAt: null,
      },
      orderBy: [{ manualReviewRequired: 'desc' }, { aiConfidence: 'asc' }, { aiGradedAt: 'desc' }],
      include: {
        task: { select: { id: true, title: true, className: true, maxScore: true } },
      },
    });
    const studentIds = Array.from(new Set(submissions.map((s) => s.studentId)));
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));
    return submissions.map((s) => ({
      ...s,
      student: studentMap.get(s.studentId) || null,
      canAutoApprove:
        s.extractionStatus === 'ok' &&
        s.aiProposedScore != null &&
        !s.gradedAt &&
        !s.manualReviewRequired &&
        (s.aiConfidence ?? 0) >= 0.6,
    }));
  }
}
