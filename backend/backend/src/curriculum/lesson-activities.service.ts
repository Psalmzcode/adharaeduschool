import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MicroQuizQuestion = {
  questionText: string;
  options: string[];
  correctIndex: number;
};

@Injectable()
export class LessonActivitiesService {
  constructor(private prisma: PrismaService) {}

  private normalizeQuestions(raw: unknown): MicroQuizQuestion[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((q: any) => ({
        questionText: String(q?.questionText || '').trim(),
        options: Array.isArray(q?.options)
          ? q.options.map((o: any) => String(o || '').trim()).filter(Boolean)
          : [],
        correctIndex: Number(q?.correctIndex),
      }))
      .filter(
        (q) =>
          q.questionText &&
          q.options.length >= 2 &&
          Number.isInteger(q.correctIndex) &&
          q.correctIndex >= 0 &&
          q.correctIndex < q.options.length,
      );
  }

  private scoreQuiz(questions: MicroQuizQuestion[], answers: number[]): number {
    if (!questions.length) return 0;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct += 1;
    });
    return Math.round((correct / questions.length) * 100);
  }

  async listForModule(
    tutorUserId: string,
    moduleId: string,
    schoolId: string,
    className: string,
  ) {
    const lessons = await this.prisma.curriculumLesson.findMany({
      where: { moduleId, isPublished: true },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, title: true, objective: true, quickCheckQuestions: true },
    });

    const [quizzes, assignments] = await Promise.all([
      this.prisma.lessonMicroQuiz.findMany({
        where: { moduleId, schoolId, className },
      }),
      this.prisma.classAssignment.findMany({
        where: {
          moduleId,
          schoolId,
          className,
          assignmentKind: 'lesson_practice',
          isPublished: true,
          curriculumLessonId: { not: null },
        },
        select: {
          id: true,
          curriculumLessonId: true,
          title: true,
          description: true,
          dueDate: true,
          maxScore: true,
          isOptional: true,
          isPublished: true,
        },
      }),
    ]);

    const quizByLesson = new Map(quizzes.map((q) => [q.curriculumLessonId, q]));
    const asgByLesson = new Map(
      assignments.filter((a) => a.curriculumLessonId).map((a) => [a.curriculumLessonId!, a]),
    );

    return lessons.map((L) => {
      const quiz = quizByLesson.get(L.id);
      const assignment = asgByLesson.get(L.id);
      return {
        lesson: L,
        microQuiz: quiz
          ? {
              id: quiz.id,
              isEnabled: quiz.isEnabled,
              title: quiz.title,
              questionCount: Array.isArray(quiz.questions) ? (quiz.questions as any[]).length : 0,
              questions: quiz.questions,
            }
          : null,
        lessonAssignment: assignment || null,
      };
    });
  }

  async upsertMicroQuiz(
    tutorUserId: string,
    data: {
      curriculumLessonId: string;
      schoolId: string;
      className: string;
      moduleId: string;
      isEnabled?: boolean;
      title?: string;
      questions?: unknown;
    },
  ) {
    const lesson = await this.prisma.curriculumLesson.findUnique({
      where: { id: data.curriculumLessonId },
      select: { id: true, moduleId: true, title: true, quickCheckQuestions: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.moduleId !== data.moduleId) {
      throw new BadRequestException('Lesson does not belong to the selected module');
    }

    let questions = this.normalizeQuestions(data.questions);
    if (!questions.length && data.isEnabled !== false) {
      questions = this.normalizeQuestions(lesson.quickCheckQuestions);
    }
    if (data.isEnabled !== false && !questions.length) {
      throw new BadRequestException(
        'Add at least one multiple-choice question (question text, 2+ options, correct answer selected).',
      );
    }

    const isEnabled = data.isEnabled !== false && questions.length > 0;

    return this.prisma.lessonMicroQuiz.upsert({
      where: {
        schoolId_className_curriculumLessonId: {
          schoolId: data.schoolId,
          className: data.className,
          curriculumLessonId: data.curriculumLessonId,
        },
      },
      create: {
        tutorId: tutorUserId,
        schoolId: data.schoolId,
        className: data.className,
        moduleId: data.moduleId,
        curriculumLessonId: data.curriculumLessonId,
        title: data.title?.trim() || `Quick check — ${lesson.title}`,
        questions: questions as any,
        isEnabled,
      },
      update: {
        title: data.title?.trim() || undefined,
        questions: questions as any,
        isEnabled,
        updatedAt: new Date(),
      },
    });
  }

  async disableMicroQuiz(tutorUserId: string, quizId: string) {
    const quiz = await this.prisma.lessonMicroQuiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.tutorId !== tutorUserId) throw new ForbiddenException('Not your quiz');
    return this.prisma.lessonMicroQuiz.update({
      where: { id: quizId },
      data: { isEnabled: false, updatedAt: new Date() },
    });
  }

  async upsertLessonAssignment(
    tutorUserId: string,
    data: {
      curriculumLessonId: string;
      schoolId: string;
      className: string;
      moduleId: string;
      enabled: boolean;
      title?: string;
      description?: string;
      dueDate?: string;
      maxScore?: number;
      isOptional?: boolean;
      submissionType?: string;
    },
  ) {
    const lesson = await this.prisma.curriculumLesson.findUnique({
      where: { id: data.curriculumLessonId },
      select: { id: true, moduleId: true, title: true, takeHomeTask: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.moduleId !== data.moduleId) {
      throw new BadRequestException('Lesson does not belong to the selected module');
    }

    const existing = await this.prisma.classAssignment.findFirst({
      where: {
        tutorId: tutorUserId,
        schoolId: data.schoolId,
        className: data.className,
        curriculumLessonId: data.curriculumLessonId,
        assignmentKind: 'lesson_practice',
      },
    });

    if (!data.enabled) {
      if (existing) {
        await this.prisma.classAssignment.update({
          where: { id: existing.id },
          data: { isPublished: false },
        });
      }
      return { removed: true, assignment: null };
    }

    const payload = {
      tutorId: tutorUserId,
      schoolId: data.schoolId,
      className: data.className,
      moduleId: data.moduleId,
      curriculumLessonId: data.curriculumLessonId,
      assignmentKind: 'lesson_practice',
      title: data.title?.trim() || `Lesson practice — ${lesson.title}`,
      description:
        data.description?.trim() ||
        lesson.takeHomeTask ||
        'Short reflection or practice for this lesson.',
      dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 3 * 86400000),
      maxScore: Number(data.maxScore) > 0 ? Number(data.maxScore) : 10,
      submissionType: data.submissionType || 'mixed',
      isOptional: data.isOptional !== false,
      isPublished: true,
    };

    if (existing) {
      return this.prisma.classAssignment.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return this.prisma.classAssignment.create({ data: payload });
  }

  async submitMicroQuiz(studentUserId: string, quizId: string, answers: number[]) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      select: { id: true, schoolId: true, className: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const quiz = await this.prisma.lessonMicroQuiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.isEnabled) throw new NotFoundException('Quiz not available');
    if (quiz.schoolId !== student.schoolId || quiz.className !== student.className) {
      throw new ForbiddenException('Quiz is not for your class');
    }

    const questions = this.normalizeQuestions(quiz.questions);
    if (!questions.length) throw new BadRequestException('Quiz has no questions');

    const score = this.scoreQuiz(questions, answers);

    const attempt = await this.prisma.lessonMicroQuizAttempt.upsert({
      where: { quizId_studentId: { quizId, studentId: student.id } },
      create: {
        quizId,
        studentId: student.id,
        score,
        answers: answers as any,
      },
      update: {
        score,
        answers: answers as any,
        submittedAt: new Date(),
      },
    });

    await this.prisma.studentLessonProgress.upsert({
      where: { studentId_lessonId: { studentId: student.id, lessonId: quiz.curriculumLessonId } },
      create: {
        studentId: student.id,
        lessonId: quiz.curriculumLessonId,
        quickCheckScore: score,
      },
      update: { quickCheckScore: score, updatedAt: new Date() },
    });

    return { ...attempt, maxScore: 100, questionCount: questions.length };
  }

  /** Average % across assigned lesson quizzes + graded lesson assignments in a module. */
  async studentFormativeSummary(studentId: string, moduleId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true, className: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const quizzes = await this.prisma.lessonMicroQuiz.findMany({
      where: {
        moduleId,
        schoolId: student.schoolId,
        className: student.className,
        isEnabled: true,
      },
      select: { id: true, curriculumLessonId: true },
    });

    const assignments = await this.prisma.classAssignment.findMany({
      where: {
        moduleId,
        schoolId: student.schoolId,
        className: student.className,
        assignmentKind: 'lesson_practice',
        isPublished: true,
        curriculumLessonId: { not: null },
      },
      select: { id: true, maxScore: true },
    });

    const quizIds = quizzes.map((q) => q.id);
    const assignmentIds = assignments.map((a) => a.id);
    const asgMaxById = new Map(assignments.map((a) => [a.id, a.maxScore || 100]));
    const assignedCount = quizIds.length + assignmentIds.length;

    if (!assignedCount) {
      return {
        assignedCount: 0,
        attemptedCount: 0,
        averageScore: null,
        items: [] as { kind: string; score: number }[],
      };
    }

    const [quizAttempts, asgSubs] = await Promise.all([
      quizIds.length
        ? this.prisma.lessonMicroQuizAttempt.findMany({
            where: { studentId, quizId: { in: quizIds } },
            select: { quizId: true, score: true },
          })
        : [],
      assignmentIds.length
        ? this.prisma.classAssignmentSubmission.findMany({
            where: { studentId, assignmentId: { in: assignmentIds } },
            select: { assignmentId: true, score: true, status: true, fileUrl: true, textBody: true },
          })
        : [],
    ]);

    const items: { kind: string; score: number }[] = [];
    for (const a of quizAttempts) {
      if (a.score != null) items.push({ kind: 'quiz', score: a.score });
    }
    for (const s of asgSubs) {
      if (s.score != null && s.status === 'GRADED') {
        const max = asgMaxById.get(s.assignmentId) || 100;
        items.push({
          kind: 'assignment',
          score: Math.round((Number(s.score) / max) * 100),
        });
      }
    }

    const attemptedCount =
      quizAttempts.length + asgSubs.filter((s) => Boolean(s.fileUrl?.trim() || s.textBody?.trim())).length;
    const averageScore = items.length
      ? Math.round(items.reduce((sum, x) => sum + x.score, 0) / items.length)
      : null;

    return { assignedCount, attemptedCount, averageScore, items };
  }

  async classFormativeSummaries(schoolId: string, className: string, moduleId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true },
    });
    const rows = await Promise.all(
      students.map(async (s) => ({
        studentId: s.id,
        ...(await this.studentFormativeSummary(s.id, moduleId)),
      })),
    );
    return rows;
  }

  async enrichLessonsForStudent(
    studentId: string,
    schoolId: string,
    className: string,
    moduleId: string,
    lessonIds: string[],
  ) {
    if (!lessonIds.length) return new Map<string, any>();

    const [quizzes, assignments, quizAttempts] = await Promise.all([
      this.prisma.lessonMicroQuiz.findMany({
        where: {
          moduleId,
          schoolId,
          className,
          curriculumLessonId: { in: lessonIds },
          isEnabled: true,
        },
      }),
      this.prisma.classAssignment.findMany({
        where: {
          moduleId,
          schoolId,
          className,
          assignmentKind: 'lesson_practice',
          isPublished: true,
          curriculumLessonId: { in: lessonIds },
        },
        include: {
          submissions: { where: { studentId }, take: 1 },
        },
      }),
      this.prisma.lessonMicroQuizAttempt.findMany({
        where: {
          studentId,
          quiz: { curriculumLessonId: { in: lessonIds }, isEnabled: true },
        },
        select: { quizId: true, score: true, submittedAt: true },
      }),
    ]);

    const attemptByQuiz = new Map(quizAttempts.map((a) => [a.quizId, a]));
    const map = new Map<string, any>();

    for (const lessonId of lessonIds) {
      const quiz = quizzes.find((q) => q.curriculumLessonId === lessonId);
      const assignment = assignments.find((a) => a.curriculumLessonId === lessonId);
      const sub = assignment?.submissions?.[0];
      const attempt = quiz ? attemptByQuiz.get(quiz.id) : null;

      const sanitizedQuestions = quiz
        ? this.normalizeQuestions(quiz.questions).map((q) => ({
            questionText: q.questionText,
            options: q.options,
          }))
        : [];

      map.set(lessonId, {
        microQuiz: quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              questionCount: sanitizedQuestions.length,
              questions: attempt ? [] : sanitizedQuestions,
              attempted: Boolean(attempt),
              score: attempt?.score ?? null,
              submittedAt: attempt?.submittedAt ?? null,
            }
          : null,
        lessonAssignment: assignment
          ? {
              id: assignment.id,
              title: assignment.title,
              dueDate: assignment.dueDate,
              maxScore: assignment.maxScore,
              isOptional: assignment.isOptional,
              submitted: Boolean(sub),
              score: sub?.score ?? null,
              status: sub?.status ?? null,
            }
          : null,
      });
    }

    return map;
  }
}
