import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvidenceGradingAdminService {
  constructor(private prisma: PrismaService) {}

  async getOversight(limit = 60) {
    const pendingBefore = new Date(Date.now() - 30 * 60 * 1000);

    const [
      practicalIssues,
      assignmentIssues,
      aiPracticalCount,
      aiAssignmentCount,
      manualPracticalCount,
      manualAssignmentCount,
    ] = await Promise.all([
      this.prisma.practicalSubmission.findMany({
        where: {
          OR: [
            { extractionStatus: 'failed' },
            { extractionStatus: 'pending', submittedAt: { lt: pendingBefore } },
          ],
        },
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          task: { select: { id: true, title: true, className: true, schoolId: true } },
        },
      }),
      this.prisma.classAssignmentSubmission.findMany({
        where: {
          OR: [
            { extractionStatus: 'failed' },
            { extractionStatus: 'pending', submittedAt: { lt: pendingBefore } },
          ],
        },
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          assignment: { select: { id: true, title: true, className: true, schoolId: true } },
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.practicalSubmission.count({
        where: { aiProposedScore: { not: null }, gradedAt: null },
      }),
      this.prisma.classAssignmentSubmission.count({
        where: { aiProposedScore: { not: null }, gradedAt: null },
      }),
      this.prisma.practicalSubmission.count({
        where: { aiProposedScore: { not: null }, gradedAt: null, manualReviewRequired: true },
      }),
      this.prisma.classAssignmentSubmission.count({
        where: { aiProposedScore: { not: null }, gradedAt: null, manualReviewRequired: true },
      }),
    ]);

    const practicalStudentIds = Array.from(
      new Set(practicalIssues.map((s) => s.studentId).filter(Boolean)),
    );
    const practicalStudents =
      practicalStudentIds.length > 0
        ? await this.prisma.student.findMany({
            where: { id: { in: practicalStudentIds } },
            include: { user: { select: { firstName: true, lastName: true } } },
          })
        : [];
    const practicalStudentMap = new Map(practicalStudents.map((s) => [s.id, s]));

    const mapStudent = (student?: { user?: { firstName?: string; lastName?: string } }) =>
      `${student?.user?.firstName || ''} ${student?.user?.lastName || ''}`.trim() || 'Student';

    const extractionIssues = [
      ...practicalIssues.map((s) => ({
        kind: 'practical' as const,
        submissionId: s.id,
        parentId: s.taskId,
        parentTitle: s.task.title,
        className: s.task.className,
        schoolId: s.task.schoolId,
        studentLabel: mapStudent(practicalStudentMap.get(s.studentId)),
        extractionStatus: s.extractionStatus,
        extractionError: s.extractionError,
        submittedAt: s.submittedAt,
      })),
      ...assignmentIssues.map((s) => ({
        kind: 'assignment' as const,
        submissionId: s.id,
        parentId: s.assignmentId,
        parentTitle: s.assignment.title,
        className: s.assignment.className,
        schoolId: s.assignment.schoolId,
        studentLabel: mapStudent(s.student),
        extractionStatus: s.extractionStatus,
        extractionError: s.extractionError,
        submittedAt: s.submittedAt,
      })),
    ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return {
      summary: {
        extractionIssues: extractionIssues.length,
        failed: extractionIssues.filter((x) => x.extractionStatus === 'failed').length,
        stalePending: extractionIssues.filter((x) => x.extractionStatus === 'pending').length,
        aiReviewPending: aiPracticalCount + aiAssignmentCount,
        manualReviewRequired: manualPracticalCount + manualAssignmentCount,
      },
      extractionIssues: extractionIssues.slice(0, limit),
      aiReview: {
        practicalPending: aiPracticalCount,
        assignmentPending: aiAssignmentCount,
        manualReviewRequired: manualPracticalCount + manualAssignmentCount,
      },
    };
  }
}
