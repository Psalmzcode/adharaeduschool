import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef, toCbtTitle } from '../common/module-content';

@Injectable()
export class CbtService {
  constructor(private prisma: PrismaService, private emailService: EmailService, private config: ConfigService) {}

  async createExam(tutorId: string, data: any) {
    const moduleRef = await resolveModuleRef(this.prisma, data?.moduleId);
    return this.prisma.cBTExam.create({
      data: {
        tutorId,
        title: toCbtTitle(moduleRef),
        description: data.description,
        track: moduleRef.track as any,
        durationMins: data.durationMins || 30,
        moduleId: moduleRef.moduleId,
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

  async findAll(query: { tutorId?: string; track?: any; isVetted?: boolean }) {
    const where: any = {};
    if (query.tutorId) where.tutorId = query.tutorId;
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

  async startExam(cbtExamId: string, studentId: string) {
    const exam = await this.prisma.cBTExam.findUnique({ where: { id: cbtExamId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!exam.isPublished) throw new BadRequestException('Exam is not yet published');
    const existing = await this.prisma.examAttempt.findFirst({
      where: { cbtExamId, studentId, status: 'IN_PROGRESS' },
    });
    if (existing) return existing;
    return this.prisma.examAttempt.create({
      data: { cbtExamId, studentId, answers: {}, status: 'IN_PROGRESS' },
    });
  }

  async saveAnswer(attemptId: string, questionNumber: number, selectedIndex: number) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Exam already submitted');
    const answers = (attempt.answers as Record<string, number>) || {};
    answers[String(questionNumber)] = selectedIndex;
    return this.prisma.examAttempt.update({ where: { id: attemptId }, data: { answers } });
  }

  async submitExam(attemptId: string, finalAnswers?: Record<string, number>) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { cbtExam: { include: { questions: true } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status === 'COMPLETED') return attempt;
    const answers = finalAnswers || (attempt.answers as Record<string, number>) || {};
    const questions = attempt.cbtExam.questions;
    let correct = 0;
    const breakdown = questions.map((q: any) => {
      const selected = answers[String(q.number)];
      const isCorrect = selected === q.correctIndex;
      if (isCorrect) correct++;
      return { questionNumber: q.number, selected: selected ?? null, correct: q.correctIndex, isCorrect, explanation: q.explanation };
    });
    const score = Math.round((correct / questions.length) * 100);
    const timeTaken = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);
    const updated = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { answers, score, totalCorrect: correct, timeTaken, status: 'COMPLETED', submittedAt: new Date() },
    });
    return { ...updated, breakdown, totalQuestions: questions.length };
  }

  async cbtLogin(regNumber: string, token: string, examId: string) {
    const student = await this.prisma.student.findUnique({
      where: { regNumber },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) throw new BadRequestException('Student not found');
    const exam = await this.findOne(examId);
    const expectedToken = regNumber.split('/').pop();
    if (token !== expectedToken) throw new BadRequestException('Invalid exam token');
    const attempt = await this.startExam(examId, student.id);
    return { student: { name: `${student.user.firstName} ${student.user.lastName}`, regNumber }, exam, attempt };
  }

  async getAttemptResult(attemptId: string) {
    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        cbtExam: { include: { questions: { orderBy: { number: 'asc' } } } },
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async getExamAttempts(cbtExamId: string) {
    return this.prisma.examAttempt.findMany({
      where: { cbtExamId, status: 'COMPLETED' },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { score: 'desc' },
    });
  }
}
