import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  findAll(track?: string) {
    return this.prisma.module.findMany({
      where: track ? { track: track as any } : undefined,
      orderBy: [{ track: 'asc' }, { number: 'asc' }],
    });
  }

  async findOne(id: string) {
    const m = await this.prisma.module.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Module not found');
    return m;
  }

  create(data: any) {
    return this.prisma.module.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.module.update({ where: { id }, data });
  }

  // Update a student's module progress
  async updateProgress(studentId: string, moduleId: string, data: { status?: any; score?: number }) {
    const existing = await this.prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId, moduleId } },
    });
    if (!existing) throw new NotFoundException('Module progress record not found');
    const updated = await this.prisma.moduleProgress.update({
      where: { studentId_moduleId: { studentId, moduleId } },
      data: { ...data, completedAt: data.status === 'COMPLETED' ? new Date() : undefined },
    });
    // No auto-unlock here: module advancement is class-paced via advanceClassModule().
    return updated;
  }

  async getClassProgress(schoolId: string, className: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true, track: true },
    });
    if (!students.length) {
      return {
        schoolId,
        className,
        track: null,
        currentModule: null,
        completedAll: false,
        studentCount: 0,
      };
    }

    const track = students[0].track;
    const modules = await this.prisma.module.findMany({
      where: { track },
      orderBy: { number: 'asc' },
    });
    const studentIds = students.map((s) => s.id);
    const progress = await this.prisma.moduleProgress.findMany({
      where: { studentId: { in: studentIds } },
      include: { module: { select: { id: true, number: true, title: true } } },
    });

    const byModuleId = progress.reduce((acc: Record<string, any[]>, p) => {
      if (!acc[p.moduleId]) acc[p.moduleId] = [];
      acc[p.moduleId].push(p);
      return acc;
    }, {});

    let currentModule: any = null;
    for (const m of modules) {
      const rows = byModuleId[m.id] || [];
      const inProgressCount = rows.filter((r) => r.status === 'IN_PROGRESS').length;
      const doneCount = rows.filter((r) => r.status === 'COMPLETED' || r.status === 'FAILED').length;
      if (inProgressCount > 0 || doneCount < students.length) {
        currentModule = m;
        break;
      }
    }

    return {
      schoolId,
      className,
      track,
      currentModule,
      completedAll: !currentModule,
      studentCount: students.length,
    };
  }

  async updateClassScores(
    schoolId: string,
    className: string,
    moduleId: string,
    scores: Array<{ studentId: string; score: number }>,
  ) {
    const classStudents = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true },
    });
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    const sanitized = (scores || []).filter(
      (s) =>
        classStudentIds.has(s.studentId) &&
        typeof s.score === 'number' &&
        !Number.isNaN(s.score) &&
        s.score >= 0 &&
        s.score <= 100,
    );

    await Promise.all(
      sanitized.map((s) =>
        this.prisma.moduleProgress.upsert({
          where: { studentId_moduleId: { studentId: s.studentId, moduleId } },
          create: {
            studentId: s.studentId,
            moduleId,
            score: s.score,
            status: 'IN_PROGRESS',
          },
          update: { score: s.score },
        }),
      ),
    );

    return { updated: sanitized.length };
  }

  async advanceClassModule(
    schoolId: string,
    className: string,
    moduleId: string,
    passMark = 50,
  ) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true, track: true },
    });
    if (!students.length) {
      return { advanced: false, reason: 'No students in class' };
    }

    const module = await this.findOne(moduleId);
    const studentIds = students.map((s) => s.id);

    await Promise.all(
      studentIds.map(async (studentId) => {
        const row = await this.prisma.moduleProgress.findUnique({
          where: { studentId_moduleId: { studentId, moduleId } },
        });
        const score = row?.score ?? null;
        const finalStatus =
          score != null && score >= passMark ? 'COMPLETED' : 'FAILED';
        await this.prisma.moduleProgress.upsert({
          where: { studentId_moduleId: { studentId, moduleId } },
          create: {
            studentId,
            moduleId,
            score: score ?? undefined,
            status: finalStatus,
            completedAt: new Date(),
          },
          update: {
            status: finalStatus,
            completedAt: new Date(),
          },
        });
      }),
    );

    const nextModule = await this.prisma.module.findFirst({
      where: { track: module.track, number: module.number + 1 },
    });

    if (!nextModule) {
      return { advanced: true, nextModule: null, message: 'Class completed final module' };
    }

    await Promise.all(
      studentIds.map((studentId) =>
        this.prisma.moduleProgress.upsert({
          where: { studentId_moduleId: { studentId, moduleId: nextModule.id } },
          create: { studentId, moduleId: nextModule.id, status: 'IN_PROGRESS' },
          update: { status: 'IN_PROGRESS' },
        }),
      ),
    );

    return { advanced: true, nextModule };
  }

  async getStudentProgress(studentId: string) {
    return this.prisma.moduleProgress.findMany({
      where: { studentId },
      include: { module: true },
      orderBy: { module: { number: 'asc' } },
    });
  }
}
