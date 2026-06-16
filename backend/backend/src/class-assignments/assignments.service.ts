import { BadRequestException, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { AcademicAuditService, AuditActor } from '../academic-audit/academic-audit.service';
import { AcademicAuditAction } from '@prisma/client';
import { GradingOrchestratorService } from '../evidence-grading/grading-orchestrator.service';
import { SubmissionGradingHelperService } from '../evidence-grading/submission-grading-helper.service';
import { UploadValidationService } from '../evidence-grading/validation/upload-validation.service';

@Injectable()
export class ClassAssignmentsService {
  private readonly logger = new Logger(ClassAssignmentsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
    private audit: AcademicAuditService,
    private orchestrator: GradingOrchestratorService,
    private gradingHelper: SubmissionGradingHelperService,
    private uploadValidation: UploadValidationService,
  ) {}

  private assignmentCreateFields(data: any, className: string, tutorUserId: string) {
    return {
      tutorId: tutorUserId,
      schoolId: data.schoolId,
      className,
      moduleId: data.moduleId,
      title: data.title,
      description: data.description,
      dueDate: new Date(data.dueDate),
      maxScore: data.maxScore || 100,
      submissionType: data.submissionType ? String(data.submissionType) : 'mixed',
      allowedExtensions: data.allowedExtensions ?? null,
      maxSizeMB: Number(data.maxSizeMB) > 0 ? Number(data.maxSizeMB) : 10,
      structuredRubric: data.structuredRubric ?? null,
      modelAnswer: data.modelAnswer ? String(data.modelAnswer) : null,
      lessonObjective: data.lessonObjective ? String(data.lessonObjective) : null,
      assignmentKind: data.assignmentKind ? String(data.assignmentKind) : 'general',
      curriculumLessonId: data.curriculumLessonId ? String(data.curriculumLessonId) : null,
      isOptional: Boolean(data.isOptional),
      isPublished: true,
    };
  }

  async create(tutorUserId: string, data: any) {
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);
    if (!targets.length) throw new BadRequestException('At least one class target is required');

    const assignmentCreateData = (className: string) => this.assignmentCreateFields(data, className, tutorUserId);

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

    const fileUrl = data.fileUrl?.trim() || undefined;
    if (fileUrl) {
      this.uploadValidation.assertValidOrThrow({
        url: fileUrl,
        allowedExtensions: Array.isArray(assignment.allowedExtensions)
          ? (assignment.allowedExtensions as string[])
          : null,
        submissionType: assignment.submissionType,
      });
    }
    if (!fileUrl && !data.textBody?.trim()) {
      throw new BadRequestException('Submit text and/or upload a file');
    }

    const submission = await this.prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        textBody: data.textBody,
        fileUrl,
        status: isLate ? 'LATE' : 'SUBMITTED',
        termLabel: student?.termLabel || null,
        extractionStatus: 'pending',
      },
      update: {
        textBody: data.textBody,
        fileUrl,
        status: isLate ? 'LATE' : 'SUBMITTED',
        submittedAt: new Date(),
        termLabel: student?.termLabel || null,
        extractionStatus: 'pending',
        ...this.gradingHelper.clearEvidenceOnResubmit(),
      },
    });

    void this.runBackgroundExtraction(submission.id).catch((err) => {
      this.logger.warn(
        `Background extraction failed for assignment submission ${submission.id}: ${err?.message || err}`,
      );
    });
    return submission;
  }

  private async runBackgroundExtraction(submissionId: string) {
    const submission = await this.prisma.classAssignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!submission) return;

    const { evidence, status, error } = await this.orchestrator.extractOnly({
      fileUrl: submission.fileUrl,
      textBody: submission.textBody,
      submissionType: submission.assignment.submissionType,
      allowedExtensions: Array.isArray(submission.assignment.allowedExtensions)
        ? (submission.assignment.allowedExtensions as string[])
        : null,
      maxSizeMB: submission.assignment.maxSizeMB,
      lessonObjective: submission.assignment.lessonObjective,
    });

    await this.prisma.classAssignmentSubmission.update({
      where: { id: submissionId },
      data: this.gradingHelper.extractionPersistData(evidence, status, error),
    });
  }

  async grade(submissionId: string, score: number, feedback: string, actor?: AuditActor) {
    const sub = await this.prisma.classAssignmentSubmission.update({
      where: { id: submissionId },
      data: { score, feedback, status: 'GRADED', gradedAt: new Date() },
      include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, assignment: true },
    });
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

  async proposeAiGrade(submissionId: string, tutorUserId: string) {
    const submission = await this.prisma.classAssignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!submission) throw new NotFoundException('Assignment submission not found');
    if (submission.assignment.tutorId !== tutorUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    if (!this.gradingHelper.submissionHasGradeableSource(submission)) {
      throw new BadRequestException('Submission has no content to grade');
    }

    const { evidence, status, error, proposal } = await this.gradingHelper.extractAndPropose(
      submission.assignment,
      submission,
    );

    return this.prisma.classAssignmentSubmission.update({
      where: { id: submissionId },
      data: this.gradingHelper.proposalPersistData(proposal, evidence, status, error),
    });
  }

  async approveAiGrade(
    submissionId: string,
    tutorUserId: string,
    data?: { score?: number; feedback?: string },
    actor?: AuditActor,
  ) {
    const submission = await this.prisma.classAssignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!submission) throw new NotFoundException('Assignment submission not found');
    if (submission.assignment.tutorId !== tutorUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    this.gradingHelper.assertCanApproveAi(submission, submission.assignment.submissionType);

    return this.grade(
      submissionId,
      data?.score ?? submission.aiProposedScore!,
      data?.feedback ?? submission.aiProposedFeedback ?? '',
      actor,
    );
  }

  async getGradingPreview(submissionId: string, tutorUserId: string) {
    const submission = await this.prisma.classAssignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            submissionType: true,
            tutorId: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Assignment submission not found');
    if (submission.assignment.tutorId !== tutorUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    return this.gradingHelper.gradingPreviewPayload(submission, submission.assignment);
  }

  async listAiReviewQueue(tutorUserId: string) {
    const submissions = await this.prisma.classAssignmentSubmission.findMany({
      where: {
        aiProposedScore: { not: null },
        gradedAt: null,
        assignment: { tutorId: tutorUserId },
      },
      orderBy: [{ manualReviewRequired: 'desc' }, { aiConfidence: 'asc' }, { aiGradedAt: 'desc' }],
      include: {
        assignment: { select: { id: true, title: true, className: true, maxScore: true } },
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return submissions.map((s) => ({
      ...s,
      canAutoApprove:
        s.extractionStatus === 'ok' &&
        s.aiProposedScore != null &&
        !s.gradedAt &&
        !s.manualReviewRequired &&
        (s.aiConfidence ?? 0) >= 0.6,
    }));
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
        submissionType: data.submissionType,
        allowedExtensions: data.allowedExtensions,
        maxSizeMB: data.maxSizeMB != null ? Number(data.maxSizeMB) : undefined,
        structuredRubric: data.structuredRubric,
        modelAnswer: data.modelAnswer,
        lessonObjective: data.lessonObjective,
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
