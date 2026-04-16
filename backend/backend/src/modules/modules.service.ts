import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleStackVariant, Track3Stack, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { moduleCurriculumOrderBy, modulesWhereForTrack } from '../common/module-curriculum';
import { ClassCurriculumService } from '../curriculum/class-curriculum.service';

@Injectable()
export class ModulesService {
  constructor(
    private prisma: PrismaService,
    private classCurriculum: ClassCurriculumService,
  ) {}

  findAll(track?: string, track3Stack?: string) {
    if (!track) {
      return this.prisma.module.findMany({
        orderBy: [{ track: 'asc' }, ...moduleCurriculumOrderBy],
      });
    }
    const t = track as TrackLevel;
    const stack =
      t === TrackLevel.TRACK_3
        ? ((track3Stack as Track3Stack) || Track3Stack.PYTHON_FLASK)
        : null;
    return this.prisma.module.findMany({
      where: modulesWhereForTrack(t, stack),
      orderBy: moduleCurriculumOrderBy,
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
    return updated;
  }

  async getClassProgress(schoolId: string, className: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true, track: true, track3Stack: true },
    });
    if (!students.length) {
      return {
        schoolId,
        className,
        track: null,
        track3Stack: null,
        currentModule: null,
        completedAll: false,
        studentCount: 0,
      };
    }

    const track = students[0].track;
    const stackForModules =
      track === TrackLevel.TRACK_3 ? students[0].track3Stack ?? Track3Stack.PYTHON_FLASK : null;

    const modules = await this.prisma.module.findMany({
      where: modulesWhereForTrack(track, stackForModules),
      orderBy: moduleCurriculumOrderBy,
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

    const classState = await this.classCurriculum.getState(
      schoolId,
      className,
      track,
      track === TrackLevel.TRACK_3 ? stackForModules : null,
    );

    return {
      schoolId,
      className,
      track,
      track3Stack: track === TrackLevel.TRACK_3 ? stackForModules : null,
      currentModule,
      completedAll: !currentModule,
      studentCount: students.length,
      currentLesson: classState?.currentLesson ?? null,
      nextLessonId: classState?.currentLessonId ?? null,
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

  private async resolveNextModule(current: { track: TrackLevel; number: number; stackVariant: ModuleStackVariant }, track3Stack: Track3Stack | null) {
    if (current.track !== TrackLevel.TRACK_3) {
      return this.prisma.module.findFirst({
        where: {
          track: current.track,
          number: current.number + 1,
          stackVariant: ModuleStackVariant.COMMON,
        },
      });
    }
    const stack = track3Stack ?? Track3Stack.PYTHON_FLASK;
    const branch =
      stack === Track3Stack.PYTHON_FLASK ? ModuleStackVariant.PYTHON_FLASK : ModuleStackVariant.REACT_NODE;
    const n = current.number;
    const sv = current.stackVariant;

    if (n < 3) {
      const nextNum = n + 1;
      if (nextNum === 3) {
        return this.prisma.module.findFirst({
          where: { track: TrackLevel.TRACK_3, number: 3, stackVariant: branch },
        });
      }
      return this.prisma.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: nextNum, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    if (n === 3 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
      return this.prisma.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 4, stackVariant: sv },
      });
    }
    if (n === 4 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
      return this.prisma.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 5, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    if (n === 5) {
      return this.prisma.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 6, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    return null;
  }

  async advanceClassModule(schoolId: string, className: string, moduleId: string, passMark = 50) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true, track: true, track3Stack: true },
    });
    if (!students.length) {
      return { advanced: false, reason: 'No students in class' };
    }

    const module = await this.findOne(moduleId);
    const track3Stack =
      module.track === TrackLevel.TRACK_3 ? students[0].track3Stack ?? Track3Stack.PYTHON_FLASK : null;

    const studentIds = students.map((s) => s.id);

    await Promise.all(
      studentIds.map(async (studentId) => {
        const row = await this.prisma.moduleProgress.findUnique({
          where: { studentId_moduleId: { studentId, moduleId } },
        });
        const score = row?.score ?? null;
        const finalStatus = score != null && score >= passMark ? 'COMPLETED' : 'FAILED';
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

    const nextModule = await this.resolveNextModule(module, track3Stack);

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
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const allowed = await this.prisma.module.findMany({
      where: modulesWhereForTrack(student.track, student.track3Stack),
      select: { id: true },
    });
    const allowedIds = new Set(allowed.map((m) => m.id));

    const rows = await this.prisma.moduleProgress.findMany({
      where: { studentId },
      include: { module: true },
    });

    return rows
      .filter((r) => allowedIds.has(r.moduleId))
      .sort(
        (a, b) =>
          a.module.number - b.module.number ||
          String(a.module.stackVariant).localeCompare(String(b.module.stackVariant)),
      );
  }
}
