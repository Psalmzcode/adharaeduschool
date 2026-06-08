import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef, toCbtTitle } from '../common/module-content';
import { geminiGenerateJson } from '../common/gemini-json.client';

@Injectable()
export class CbtService {
  constructor(private prisma: PrismaService, private emailService: EmailService, private config: ConfigService) {}

  private shuffle<T>(arr: T[], rand: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private xorshift32(seed: number) {
    let x = seed || 123456789;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 1_000_000) / 1_000_000;
    };
  }

  private buildAttemptVariant(questions: Array<{ number: number; options: string[] }>, seed: number) {
    const rand = this.xorshift32(seed);
    const questionOrder = this.shuffle(questions.map((q) => q.number), rand);
    const optionOrder: Record<string, number[]> = {};
    for (const q of questions) {
      const idxs = q.options.map((_, i) => i);
      optionOrder[String(q.number)] = this.shuffle(idxs, rand);
    }
    return { seed, questionOrder, optionOrder };
  }

  private applyVariantToQuestions(
    questions: Array<{ id: string; number: number; questionText: string; options: string[] }>,
    variant: any,
  ) {
    const byNum = new Map<number, any>(questions.map((q) => [q.number, q]));
    const orderedNums: number[] = Array.isArray(variant?.questionOrder)
      ? variant.questionOrder.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : questions.map((q) => q.number);
    const seen = new Set<number>();
    const safeOrder = orderedNums.filter((n) => (byNum.has(n) && !seen.has(n) ? (seen.add(n), true) : false));
    for (const q of questions) if (!seen.has(q.number)) safeOrder.push(q.number);

    return safeOrder.map((n) => {
      const q = byNum.get(n);
      const ord = variant?.optionOrder?.[String(n)];
      const idxs: number[] =
        Array.isArray(ord) && ord.length === q.options.length ? ord : q.options.map((_: any, i: number) => i);
      const options = idxs.map((i) => q.options[i]);
      return { ...q, options };
    });
  }

  async generateQuestions(data: {
    moduleId: string;
    includeModuleIds?: string[];
    count?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  }) {
    const moduleId = String(data?.moduleId || '').trim();
    if (!moduleId) throw new BadRequestException('moduleId is required');
    const count = Math.min(Math.max(Number(data?.count || 10) || 10, 1), 60);
    const difficulty = (data?.difficulty || 'medium') as any;

    const root = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, title: true, number: true, track: true, description: true, objectives: true, moduleType: true, termOrdinal: true },
    } as any);
    if (!root) throw new BadRequestException('Module not found');

    let moduleIds: string[] = [];
    const requested = Array.isArray(data?.includeModuleIds)
      ? data.includeModuleIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];

    if (requested.length) {
      moduleIds = Array.from(new Set([moduleId, ...requested]));
    } else if (
      (root as any).moduleType === 'TERM_EXAM' ||
      (root as any).moduleType === 'TRACK_COMPLETION_EXAM'
    ) {
      const list = await this.prisma.module.findMany({
        where: {
          track: root.track as any,
          moduleType: 'STANDARD' as any,
        } as any,
        orderBy: [{ number: 'asc' }, { stackVariant: 'asc' }],
        select: { id: true },
      });
      moduleIds = list.map((m) => m.id);
    } else {
      moduleIds = [moduleId];
    }

    const modules = await this.prisma.module.findMany({
      where: { id: { in: moduleIds } } as any,
      orderBy: [{ number: 'asc' }],
      select: { id: true, title: true, number: true, description: true, objectives: true },
    });

    const lessons = await this.prisma.curriculumLesson.findMany({
      where: { moduleId: { in: moduleIds }, isPublished: true } as any,
      orderBy: [{ moduleId: 'asc' }, { position: 'asc' }],
      select: { moduleId: true, position: true, title: true, objective: true, quickCheckQuestions: true, exercises: true, resources: true },
    });

    const prompt = [
      `You are generating multiple-choice CBT questions for Nigerian secondary school students.`,
      `Return ONLY valid JSON (no markdown) with this shape:`,
      `[{\"questionText\":string,\"options\":[string,string,string,string],\"correctIndex\":0|1|2|3,\"explanation\":string}]`,
      ``,
      `Difficulty: ${difficulty}. Count: ${count}.`,
      ``,
      `Context modules (may be 1 module or many):`,
      JSON.stringify(modules),
      ``,
      `Curriculum lesson hints (quick checks/exercises/resources):`,
      JSON.stringify(lessons),
      ``,
      `Rules:`,
      `- 4 options only; exactly one correctIndex.`,
      `- Avoid trick questions; keep language simple.`,
      `- Explanations should be 1–2 sentences.`,
    ].join('\n');

    const { jsonText: rawJson, modelUsed } = await geminiGenerateJson(this.config, prompt, { temperature: 0.4 });
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new BadRequestException('Gemini returned non-JSON output');
    }
    if (!Array.isArray(parsed)) throw new BadRequestException('Gemini returned invalid question list');

    const cleaned = parsed
      .slice(0, count)
      .map((q: any) => ({
        questionText: String(q?.questionText || '').trim(),
        options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o || '').trim()).slice(0, 4) : [],
        correctIndex: Number(q?.correctIndex),
        explanation: String(q?.explanation || '').trim(),
      }))
      .filter((q: any) => q.questionText && q.options.length === 4 && q.options.every(Boolean) && q.correctIndex >= 0 && q.correctIndex <= 3);

    if (!cleaned.length) throw new BadRequestException('No valid questions generated');
    return { moduleId, includedModuleIds: moduleIds, modelUsed, questions: cleaned };
  }

  async createExam(tutorUserId: string, data: any) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) throw new BadRequestException('Tutor profile not found');
    const moduleRef = await resolveModuleRef(this.prisma, data?.moduleId);
    const coveredModuleIds = Array.isArray(data?.coveredModuleIds)
      ? data.coveredModuleIds.map((x: any) => String(x || '').trim()).filter(Boolean)
      : Array.isArray(data?.includeModuleIds)
        ? data.includeModuleIds.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [];
    return this.prisma.cBTExam.create({
      data: {
        tutorId: tutor.id,
        title: toCbtTitle(moduleRef),
        description: data.description,
        track: moduleRef.track as any,
        durationMins: data.durationMins || 30,
        moduleId: moduleRef.moduleId,
        coveredModuleIds,
        scheduledFor: data.scheduledFor,
        totalQuestions: data.questions.length,
        questions: {
          create: data.questions.map((q: any, i: number) => ({
            number: i + 1,
            questionText: q.questionText,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
          })),
        },
      },
      include: { questions: true },
    });
  }

  async findAll(query: { tutorId?: string; tutorUserId?: string; track?: any; isVetted?: boolean }) {
    const where: any = {};
    if (query.tutorId) where.tutorId = query.tutorId;
    if (query.tutorUserId) {
      const tutor = await this.prisma.tutor.findUnique({
        where: { userId: query.tutorUserId },
        select: { id: true },
      });
      if (!tutor?.id) return [];
      where.tutorId = tutor.id;
    }
    if (query.track) where.track = query.track;
    if (query.isVetted !== undefined) where.isVetted = query.isVetted;
    return this.prisma.cBTExam.findMany({
      where,
      include: {
        tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, includeAnswers = false) {
    const exam = await this.prisma.cBTExam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { number: 'asc' },
        },
        tutor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!includeAnswers) {
      exam.questions = exam.questions.map((q: any) => {
        const { correctIndex, explanation, ...safe } = q;
        return safe;
      }) as any;
    }
    return exam;
  }

  async updateExam(id: string, data: any) {
    return this.prisma.cBTExam.update({ where: { id }, data });
  }

  async publishExam(id: string) {
    return this.prisma.cBTExam.update({ where: { id }, data: { isPublished: true } });
  }

  async vetExam(id: string, vetted: boolean) {
    return this.prisma.cBTExam.update({ where: { id }, data: { isVetted: vetted } });
  }

  /** Optional `examScheduleId` links the attempt to a My Exams schedule (result release rules). */
  async startExam(cbtExamId: string, studentId: string, examScheduleId?: string | null) {
    const exam = await this.prisma.cBTExam.findUnique({ where: { id: cbtExamId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!exam.isPublished) throw new BadRequestException('Exam is not yet published');
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { termLabel: true } });
    if (examScheduleId) {
      const schedule = await this.prisma.examSchedule.findUnique({
        where: { id: String(examScheduleId) },
        select: { id: true, maxAttempts: true },
      });
      if (!schedule) throw new BadRequestException('Exam schedule not found');
      const maxAttempts = Math.max(1, Math.min(3, Math.floor(Number(schedule.maxAttempts) || 1)));
      const completedCount = await this.prisma.examAttempt.count({
        where: { cbtExamId, studentId, examScheduleId: schedule.id, status: 'COMPLETED' },
      });
      if (completedCount >= maxAttempts) {
        throw new BadRequestException('Maximum retake attempts reached for this scheduled exam');
      }
    } else {
      const completed = await this.prisma.examAttempt.findFirst({
        where: { cbtExamId, studentId, status: 'COMPLETED' },
      });
      if (completed) {
        throw new BadRequestException('You have already completed this exam. Retakes are not allowed.');
      }
    }

    const existing = await this.prisma.examAttempt.findFirst({
      where: { cbtExamId, studentId, status: 'IN_PROGRESS', ...(examScheduleId ? { examScheduleId } : {}) },
    });
    if (existing) return existing;

    const qs = await this.prisma.cBTQuestion.findMany({
      where: { examId: cbtExamId },
      orderBy: { number: 'asc' },
      select: { number: true, options: true },
    });
    const seed = (Date.now() ^ Math.floor(Math.random() * 1_000_000)) >>> 0;
    const variant = this.buildAttemptVariant(qs as any, seed);
    return this.prisma.examAttempt.create({
      data: {
        cbtExamId,
        studentId,
        examScheduleId: examScheduleId || null,
        answers: {},
        status: 'IN_PROGRESS',
        termLabel: student?.termLabel || null,
        variant,
      },
    });
  }

  private isScheduleResultsPending(schedule: { awaitTutorResultRelease: boolean; resultsReleasedAt: Date | null } | null | undefined) {
    return !!(schedule && schedule.awaitTutorResultRelease && !schedule.resultsReleasedAt);
  }

  async saveAnswer(attemptId: string, questionNumber: number, selectedIndex: number) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Exam already submitted');
    const answers = (attempt.answers as Record<string, number>) || {};
    answers[String(questionNumber)] = selectedIndex;
    return this.prisma.examAttempt.update({ where: { id: attemptId }, data: { answers } });
  }

  private buildCompletedExamResponse(
    attempt: any,
    breakdown: { questionNumber: number; selected: number | null; correct: number; isCorrect: boolean; explanation: string | null }[],
    totalQuestions: number,
  ) {
    if (this.isScheduleResultsPending(attempt.examSchedule)) {
      return {
        resultsPending: true,
        status: 'COMPLETED' as const,
        message:
          'Your answers are submitted. Your tutor will release results when ready — check My Exams or use “Refresh results” below.',
        attemptId: attempt.id,
        totalQuestions,
      };
    }
    return { ...attempt, breakdown, totalQuestions };
  }

  async submitExam(attemptId: string, finalAnswers?: Record<string, number>) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { cbtExam: { include: { questions: true } }, examSchedule: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status === 'COMPLETED') {
      const answers = (attempt.answers as Record<string, number>) || {};
      const questions = attempt.cbtExam.questions;
      const breakdown = questions.map((q: any) => {
      const selectedPresented = answers[String(q.number)];
      const ord: number[] | undefined = (attempt as any)?.variant?.optionOrder?.[String(q.number)];
      const selectedOriginal =
        typeof selectedPresented === 'number' && Array.isArray(ord) && ord.length === q.options.length
          ? ord[selectedPresented]
          : selectedPresented;
      const isCorrect = selectedOriginal === q.correctIndex;
      return { questionNumber: q.number, selected: selectedPresented ?? null, correct: q.correctIndex, isCorrect, explanation: q.explanation };
      });
      return this.buildCompletedExamResponse(attempt, breakdown, questions.length);
    }
    const answers = finalAnswers || (attempt.answers as Record<string, number>) || {};
    const questions = attempt.cbtExam.questions;
    let correct = 0;
    const breakdown = questions.map((q: any) => {
      const selectedPresented = answers[String(q.number)];
      const ord: number[] | undefined = (attempt as any)?.variant?.optionOrder?.[String(q.number)];
      const selectedOriginal =
        typeof selectedPresented === 'number' && Array.isArray(ord) && ord.length === q.options.length
          ? ord[selectedPresented]
          : selectedPresented;
      const isCorrect = selectedOriginal === q.correctIndex;
      if (isCorrect) correct++;
      return { questionNumber: q.number, selected: selectedPresented ?? null, correct: q.correctIndex, isCorrect, explanation: q.explanation };
    });
    const score = Math.round((correct / questions.length) * 100);
    const timeTaken = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { answers, score, totalCorrect: correct, timeTaken, status: 'COMPLETED', submittedAt: new Date() },
    });
    const updated = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { cbtExam: { include: { questions: true } }, examSchedule: true },
    });
    if (!updated) throw new NotFoundException('Attempt not found');
    return this.buildCompletedExamResponse(updated, breakdown, questions.length);
  }

  async cbtLogin(regNumber: string, token: string, examId: string) {
    const student = await this.prisma.student.findUnique({
      where: { regNumber },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) throw new BadRequestException('Student not found');
    const expectedToken = regNumber.split('/').pop();
    if (token !== expectedToken) throw new BadRequestException('Invalid exam token');
    const attempt = await this.startExam(examId, student.id);
    const exam = await this.findOne(examId);
    if ((attempt as any)?.variant) {
      exam.questions = this.applyVariantToQuestions(exam.questions as any, (attempt as any).variant) as any;
    }
    return { student: { name: `${student.user.firstName} ${student.user.lastName}`, regNumber }, exam, attempt };
  }

  /**
   * CBT login tied to a schedule: validates access code AND only opens near scheduled time.
   * Allows entry from scheduledAt until 15 minutes after the exam duration ends.
   */
  async cbtLoginSchedule(regNumber: string, token: string, scheduleId: string) {
    const sid = String(scheduleId || '').trim();
    if (!sid) throw new BadRequestException('scheduleId is required');

    const student = await this.prisma.student.findUnique({
      where: { regNumber },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) throw new BadRequestException('Student not found');

    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id: sid },
      include: { cbtExam: { select: { id: true, title: true, durationMins: true } } },
    });
    if (!schedule || !schedule.isActive || schedule.status !== 'SCHEDULED') {
      throw new BadRequestException('Exam schedule not found or inactive');
    }

    // Student must belong to the scheduled class and school.
    if (student.schoolId !== schedule.schoolId || student.className !== schedule.className) {
      throw new BadRequestException('This exam is not scheduled for your class');
    }

    const expected =
      String(schedule.accessCode || '').trim().length > 0
        ? String(schedule.accessCode || '').trim()
        : (regNumber.split('/').pop() || '').trim();
    if (!expected) {
      throw new BadRequestException(
        'Invalid access code. Use the last segment of your registration number (e.g. 051) or the code your tutor set for this exam.',
      );
    }
    if (String(token || '').trim() !== expected) {
      throw new BadRequestException(
        'Invalid access code. This is not your dashboard password — use the last part of your reg number after the final slash, or the tutor’s exam code.',
      );
    }

    const durationMins = schedule.durationMins || schedule.cbtExam?.durationMins || 30;
    const graceMs = 15 * 60 * 1000;
    const startAt = new Date(schedule.scheduledAt).getTime();
    const openAt = startAt;
    const closeAt = startAt + durationMins * 60 * 1000 + graceMs;
    const now = Date.now();
    if (now < openAt) {
      throw new BadRequestException('Exam is not open yet. Please check the scheduled time.');
    }
    if (now > closeAt) {
      throw new BadRequestException('Exam time window has ended.');
    }

    const examId = schedule.cbtExamId;
    const attempt = await this.startExam(examId, student.id, schedule.id);
    const exam = await this.findOne(examId);
    if ((attempt as any)?.variant) {
      exam.questions = this.applyVariantToQuestions(exam.questions as any, (attempt as any).variant) as any;
    }
    return {
      student: { name: `${student.user.firstName} ${student.user.lastName}`, regNumber },
      exam,
      attempt,
      schedule: {
        id: schedule.id,
        scheduledAt: schedule.scheduledAt,
        venue: schedule.venue,
        durationMins: schedule.durationMins,
        maxAttempts: (schedule as any).maxAttempts,
        awaitTutorResultRelease: schedule.awaitTutorResultRelease,
        resultsReleasedAt: schedule.resultsReleasedAt,
      },
    };
  }

  async getAttemptResult(attemptId: string, user?: { sub: string; role: string }) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        cbtExam: { include: { questions: { orderBy: { number: 'asc' } } } },
        student: { include: { user: { select: { firstName: true, lastName: true, id: true } } } },
        examSchedule: true,
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const privileged = user && ['TUTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user.role);
    if (!privileged) {
      if (!user || attempt.student.user.id !== user.sub) {
        throw new ForbiddenException('Not allowed to view this attempt');
      }
    }

    if (attempt.status !== 'COMPLETED') {
      return attempt;
    }

    const answers = (attempt.answers as Record<string, number>) || {};
    const questions = attempt.cbtExam.questions;
    const breakdown = questions.map((q: any) => {
      const selectedPresented = answers[String(q.number)];
      const ord: number[] | undefined = (attempt as any)?.variant?.optionOrder?.[String(q.number)];
      const selectedOriginal =
        typeof selectedPresented === 'number' && Array.isArray(ord) && ord.length === q.options.length
          ? ord[selectedPresented]
          : selectedPresented;
      const isCorrect = selectedOriginal === q.correctIndex;
      return { questionNumber: q.number, selected: selectedPresented ?? null, correct: q.correctIndex, isCorrect, explanation: q.explanation };
    });

    if (!privileged && this.isScheduleResultsPending(attempt.examSchedule)) {
      return {
        resultsPending: true,
        status: 'COMPLETED' as const,
        attemptId: attempt.id,
        message: 'Your tutor has not released results for this exam yet. Check My Exams later.',
        totalQuestions: questions.length,
      };
    }

    return { ...attempt, breakdown, totalQuestions: questions.length };
  }

  async getExamAttempts(cbtExamId: string, actor: { sub: string; role: string }) {
    const exam = await this.prisma.cBTExam.findUnique({
      where: { id: cbtExamId },
      select: { id: true, tutor: { select: { userId: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (actor.role === 'TUTOR' && exam.tutor.userId !== actor.sub) {
      throw new ForbiddenException('You do not have access to this exam');
    }
    return this.prisma.examAttempt.findMany({
      where: { cbtExamId, status: 'COMPLETED' },
      include: {
        student: {
          select: {
            regNumber: true,
            className: true,
            schoolId: true,
            track: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ score: 'desc' }, { submittedAt: 'desc' }],
    });
  }
}
