import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ModuleStackVariant, Track3Stack, TrackLevel, ModuleType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrismaDb } from '../common/prisma-db.type';
import { moduleCurriculumOrderBy, modulesWhereForTrack } from '../common/module-curriculum';
import { ClassCurriculumService } from '../curriculum/class-curriculum.service';
import { AcademicAuditService, AuditActor } from '../academic-audit/academic-audit.service';
import { AcademicAuditAction } from '@prisma/client';

@Injectable()
export class ModulesService {
  constructor(
    private prisma: PrismaService,
    private classCurriculum: ClassCurriculumService,
    private audit: AcademicAuditService,
  ) {}

  private async bestModuleQuizAndPracticalByStudent(
    studentIds: string[],
    moduleId: string,
    db: PrismaDb = this.prisma,
  ): Promise<{
    bestCbtByStudentId: Map<string, { score: number; submittedAt: Date | null; cbtExamId: string }>;
    bestPracticalByStudentId: Map<string, { score: number; gradedAt: Date | null; taskId: string }>;
  }> {
    const ids = (studentIds || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (!ids.length) {
      return { bestCbtByStudentId: new Map(), bestPracticalByStudentId: new Map() };
    }

    // Best module CBT quiz score per student (STANDARD module only).
    const attempts = await db.examAttempt.findMany({
      where: {
        studentId: { in: ids },
        status: 'COMPLETED',
        score: { not: null },
        cbtExam: {
          moduleId,
          module: { moduleType: ModuleType.STANDARD },
        } as any,
      } as any,
      orderBy: [{ studentId: 'asc' }, { score: 'desc' }, { submittedAt: 'desc' }],
      select: { studentId: true, score: true, submittedAt: true, cbtExamId: true },
    });
    const bestCbtByStudentId = new Map<string, { score: number; submittedAt: Date | null; cbtExamId: string }>();
    for (const a of attempts) {
      const sid = String((a as any).studentId || '');
      if (!sid || bestCbtByStudentId.has(sid)) continue;
      const score = Number((a as any).score);
      if (Number.isNaN(score)) continue;
      bestCbtByStudentId.set(sid, {
        score,
        submittedAt: (a as any).submittedAt ?? null,
        cbtExamId: String((a as any).cbtExamId || ''),
      });
    }

    // Best practical score per student for this module.
    const practicals = await db.practicalSubmission.findMany({
      where: {
        studentId: { in: ids },
        totalScore: { not: null },
        task: { moduleId },
      } as any,
      orderBy: [{ studentId: 'asc' }, { totalScore: 'desc' }, { gradedAt: 'desc' }],
      select: { studentId: true, totalScore: true, gradedAt: true, taskId: true },
    });
    const bestPracticalByStudentId = new Map<string, { score: number; gradedAt: Date | null; taskId: string }>();
    for (const p of practicals) {
      const sid = String((p as any).studentId || '');
      if (!sid || bestPracticalByStudentId.has(sid)) continue;
      const score = Number((p as any).totalScore);
      if (Number.isNaN(score)) continue;
      bestPracticalByStudentId.set(sid, {
        score,
        gradedAt: (p as any).gradedAt ?? null,
        taskId: String((p as any).taskId || ''),
      });
    }

    return { bestCbtByStudentId, bestPracticalByStudentId };
  }

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
      where: {
        ...modulesWhereForTrack(track, stackForModules),
        moduleType: ModuleType.STANDARD,
      },
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
    actor?: AuditActor,
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

    await this.prisma.$transaction(
      async (tx) => {
        await Promise.all(
          sanitized.map((s) =>
            tx.moduleProgress.upsert({
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
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    if (actor && sanitized.length) {
      await this.audit.log({
        schoolId,
        actor,
        action: AcademicAuditAction.MODULE_SCORE_UPDATE,
        className,
        moduleId,
        summary: `Updated module scores for ${className} (${sanitized.length} student(s))`,
        metadata: { count: sanitized.length },
      });
    }

    return { updated: sanitized.length };
  }

  private async resolveNextModule(
    current: { track: TrackLevel; number: number; stackVariant: ModuleStackVariant },
    track3Stack: Track3Stack | null,
    db: PrismaDb = this.prisma,
  ) {
    if (current.track !== TrackLevel.TRACK_3) {
      return db.module.findFirst({
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
        return db.module.findFirst({
          where: { track: TrackLevel.TRACK_3, number: 3, stackVariant: branch },
        });
      }
      return db.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: nextNum, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    if (n === 3 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
      return db.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 4, stackVariant: sv },
      });
    }
    if (n === 4 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
      return db.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 5, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    if (n === 5) {
      return db.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 6, stackVariant: ModuleStackVariant.COMMON },
      });
    }
    return null;
  }

  async advanceClassModule(
    schoolId: string,
    className: string,
    moduleId: string,
    passMark = 50,
    actor?: AuditActor,
  ) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true, track: true, track3Stack: true },
    });
    if (!students.length) {
      return { advanced: false, reason: 'No students in class' };
    }

    const studentIds = students.map((s) => s.id);
    const track3StackFromClass =
      students[0].track === TrackLevel.TRACK_3 ? students[0].track3Stack ?? Track3Stack.PYTHON_FLASK : null;

    // Atomic apply of scores + opening next module (rolls back on any DB error mid-class).
    const result = await this.prisma.$transaction(
      async (tx) => {
        const moduleRow = await tx.module.findUnique({ where: { id: moduleId } });
        if (!moduleRow) throw new NotFoundException('Module not found');

        const moduleMeta = await tx.module.findUnique({
          where: { id: moduleId },
          select: { moduleType: true },
        } as any);
        const modType = (moduleMeta as any)?.moduleType as ModuleType | undefined;
        if (modType === ModuleType.TERM_EXAM || modType === ModuleType.TRACK_COMPLETION_EXAM) {
          throw new BadRequestException('Advance module is for standard modules only');
        }

        const track3Stack =
          moduleRow.track === TrackLevel.TRACK_3 ? track3StackFromClass : null;

        // New rule: module completion is gated by BOTH module CBT quiz and module practical (≥ passMark each).
        // We still store a single module score for reporting: composite = average(best CBT, best Practical).
        const { bestCbtByStudentId, bestPracticalByStudentId } =
          await this.bestModuleQuizAndPracticalByStudent(studentIds, moduleId, tx);

        await Promise.all(
          studentIds.map(async (studentId) => {
            const bestCbt = bestCbtByStudentId.get(studentId);
            const bestPractical = bestPracticalByStudentId.get(studentId);
            const cbtScore = bestCbt?.score ?? null;
            const practicalScore = bestPractical?.score ?? null;

            const cbtPassed = cbtScore != null && cbtScore >= passMark;
            const practicalPassed = practicalScore != null && practicalScore >= passMark;
            const finalStatus = cbtPassed && practicalPassed ? 'COMPLETED' : 'FAILED';

            const composite =
              cbtScore != null && practicalScore != null
                ? Math.round((cbtScore + practicalScore) / 2)
                : undefined;

            await tx.moduleProgress.upsert({
              where: { studentId_moduleId: { studentId, moduleId } },
              create: {
                studentId,
                moduleId,
                score: composite,
                status: finalStatus,
                completedAt: new Date(),
              },
              update: {
                score: composite,
                status: finalStatus,
                completedAt: new Date(),
              },
            });
          }),
        );

        const nextModule = await this.resolveNextModule(moduleRow, track3Stack, tx);

        if (!nextModule) {
          return { advanced: true, nextModule: null, message: 'Class completed final module' };
        }

        await Promise.all(
          studentIds.map((studentId) =>
            tx.moduleProgress.upsert({
              where: { studentId_moduleId: { studentId, moduleId: nextModule.id } },
              create: { studentId, moduleId: nextModule.id, status: 'IN_PROGRESS' },
              update: { status: 'IN_PROGRESS' },
            }),
          ),
        );

        await this.classCurriculum.syncClassLessonPointerForModule(
          schoolId,
          className,
          students[0].track,
          nextModule.id,
          track3StackFromClass,
          tx,
        );

        return { advanced: true, nextModule, moduleTitle: moduleRow.title, moduleNumber: moduleRow.number };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    if (actor && result?.advanced) {
      const modLabel = (result as any).moduleNumber
        ? `Module ${(result as any).moduleNumber}: ${(result as any).moduleTitle || ''}`
        : 'module';
      const next = (result as any).nextModule;
      await this.audit.log({
        schoolId,
        actor,
        action: AcademicAuditAction.MODULE_ADVANCE,
        className,
        moduleId,
        summary: next
          ? `Advanced ${className} past ${modLabel} → Mod ${next.number}: ${next.title}`
          : `Advanced ${className} past final ${modLabel}`,
        metadata: { passMark, studentCount: students.length, nextModuleId: next?.id ?? null },
      });
    }

    return result;
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

  private async assertCanTutorStudentClass(
    actorUserId: string,
    studentId: string,
    db: PrismaDb = this.prisma,
  ): Promise<void> {
    const actor = await db.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true },
    });
    if (!actor) throw new ForbiddenException('Unauthorized');
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role !== Role.TUTOR) throw new ForbiddenException('Only tutors and super admins can perform retakes');

    const tutor = await db.tutor.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!tutor) throw new ForbiddenException('Tutor profile not found');

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, className: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const assignment = await db.tutorAssignment.findFirst({
      where: {
        tutorId: tutor.id,
        schoolId: student.schoolId,
        className: student.className,
        isActive: true,
      },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException('You are not assigned to this class');
  }

  async getModuleRetakeStatus(studentId: string, moduleId: string, passMark = 50, db: PrismaDb = this.prisma) {
    const module = await db.module.findUnique({
      where: { id: moduleId },
      select: { id: true, number: true, title: true, track: true, moduleType: true },
    } as any);
    if (!module) throw new NotFoundException('Module not found');
    const modType = (module as any).moduleType as ModuleType | undefined;
    if (modType === ModuleType.TERM_EXAM || modType === ModuleType.TRACK_COMPLETION_EXAM) {
      throw new BadRequestException('Retakes apply to standard modules only');
    }

    const { bestCbtByStudentId, bestPracticalByStudentId } =
      await this.bestModuleQuizAndPracticalByStudent([studentId], moduleId, db);
    const bestCbt = bestCbtByStudentId.get(studentId) ?? null;
    const bestPractical = bestPracticalByStudentId.get(studentId) ?? null;

    const cbtScore = typeof bestCbt?.score === 'number' ? bestCbt.score : null;
    const practicalScore = typeof bestPractical?.score === 'number' ? bestPractical.score : null;

    const cbtPassed = cbtScore != null && cbtScore >= passMark;
    const practicalPassed = practicalScore != null && practicalScore >= passMark;

    const compositeScore =
      cbtScore != null && practicalScore != null
        ? Math.round((cbtScore + practicalScore) / 2)
        : null;

    return {
      studentId,
      module: { id: module.id, number: module.number, title: module.title },
      passMark,
      cbt: { bestScore: cbtScore, passed: cbtPassed, cbtExamId: bestCbt?.cbtExamId ?? null, submittedAt: bestCbt?.submittedAt ?? null },
      practical: { bestScore: practicalScore, passed: practicalPassed, taskId: bestPractical?.taskId ?? null, gradedAt: bestPractical?.gradedAt ?? null },
      compositeScore,
      ready: cbtPassed && practicalPassed,
    };
  }

  async getClassSuggestedModuleScores(schoolId: string, className: string, moduleId: string, passMark = 50) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, className },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);
    const { bestCbtByStudentId, bestPracticalByStudentId } =
      await this.bestModuleQuizAndPracticalByStudent(studentIds, moduleId);

    return studentIds.map((studentId) => {
      const cbt = bestCbtByStudentId.get(studentId);
      const prac = bestPracticalByStudentId.get(studentId);
      const cbtScore = cbt?.score ?? null;
      const practicalScore = prac?.score ?? null;
      const cbtPassed = cbtScore != null && cbtScore >= passMark;
      const practicalPassed = practicalScore != null && practicalScore >= passMark;
      /** Suggested mark for the tutor table: average when both exist; otherwise the available component (so practical-only or CBT-only still prefills). */
      const composite =
        cbtScore != null && practicalScore != null
          ? Math.round((cbtScore + practicalScore) / 2)
          : cbtScore != null
            ? Math.round(cbtScore)
            : practicalScore != null
              ? Math.round(practicalScore)
              : null;
      return {
        studentId,
        passMark,
        cbt: { bestScore: cbtScore, passed: cbtPassed },
        practical: { bestScore: practicalScore, passed: practicalPassed },
        compositeScore: composite,
        ready: cbtPassed && practicalPassed,
      };
    });
  }

  async applyModuleRetake(actorUserId: string, studentId: string, moduleId: string, passMark = 50, actorRole?: Role) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, className: true, user: { select: { firstName: true, lastName: true } } },
    });
    const moduleRow = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { number: true, title: true },
    });

    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.assertCanTutorStudentClass(actorUserId, studentId, tx);
        const status = await this.getModuleRetakeStatus(studentId, moduleId, passMark, tx);
        if (!status.ready) {
          const missing = [
            status.cbt.passed ? null : 'Module CBT quiz not passed',
            status.practical.passed ? null : 'Module practical not passed',
          ].filter(Boolean);
          throw new BadRequestException(`Retake not cleared: ${missing.join('; ')}`);
        }

        const finalScore =
          typeof status.compositeScore === 'number'
            ? status.compositeScore
            : Math.round((Number(status.cbt.bestScore || 0) + Number(status.practical.bestScore || 0)) / 2);

        const updated = await tx.moduleProgress.upsert({
          where: { studentId_moduleId: { studentId, moduleId } },
          create: {
            studentId,
            moduleId,
            status: 'COMPLETED',
            score: finalScore,
            completedAt: new Date(),
          },
          update: {
            status: 'COMPLETED',
            score: finalScore,
            completedAt: new Date(),
          },
        });

        return { ...status, applied: true, moduleProgress: updated };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if (student && moduleRow) {
      const name = `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim() || 'Student';
      await this.audit.log({
        schoolId: student.schoolId,
        actor: { userId: actorUserId, role: actorRole || Role.TUTOR },
        action: AcademicAuditAction.MODULE_RETAKE,
        className: student.className,
        studentId,
        moduleId,
        summary: `Retake cleared for ${name} on Mod ${moduleRow.number}: ${moduleRow.title}`,
        metadata: { passMark, finalScore: (result as any).moduleProgress?.score },
      });
    }

    return result;
  }
}
