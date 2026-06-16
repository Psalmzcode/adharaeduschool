import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleStatus, Track3Stack, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrismaDb } from '../common/prisma-db.type';
import { curriculumBranchKey } from '../common/curriculum-branch';
import { CurriculumLessonsService } from './curriculum-lessons.service';
import { LessonActivitiesService } from './lesson-activities.service';
import { modulesWhereForTrack } from '../common/module-curriculum';

@Injectable()
export class ClassCurriculumService {
  constructor(
    private prisma: PrismaService,
    private lessons: CurriculumLessonsService,
    private lessonActivities: LessonActivitiesService,
  ) {}

  async getState(
    schoolId: string,
    className: string,
    track: TrackLevel,
    track3Stack: Track3Stack | null | undefined,
  ) {
    const key = curriculumBranchKey(track, track3Stack);
    const row = await this.prisma.classCurriculumState.findUnique({
      where: {
        schoolId_className_curriculumBranchKey: { schoolId, className, curriculumBranchKey: key },
      },
      include: {
        currentLesson: {
          include: { module: { select: { id: true, number: true, title: true, track: true } } },
        },
        lastDeliveredLesson: {
          include: { module: { select: { id: true, number: true, title: true, track: true } } },
        },
      },
    });
    return row;
  }

  /** Point class at the first published lesson of a module (after module advance). */
  async syncClassLessonPointerForModule(
    schoolId: string,
    className: string,
    track: TrackLevel,
    moduleId: string,
    track3Stack: Track3Stack | null | undefined,
    db: PrismaDb = this.prisma,
  ) {
    const first = await db.curriculumLesson.findFirst({
      where: { moduleId, isPublished: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const key = curriculumBranchKey(track, track3Stack);
    await db.classCurriculumState.upsert({
      where: {
        schoolId_className_curriculumBranchKey: { schoolId, className, curriculumBranchKey: key },
      },
      create: {
        schoolId,
        className,
        curriculumBranchKey: key,
        currentLessonId: first?.id ?? null,
      },
      update: { currentLessonId: first?.id ?? null },
    });
  }

  private async filesForModule(moduleId: string) {
    const moduleUploads = await this.prisma.upload.findMany({
      where: { entityType: ClassCurriculumService.ENTITY_MODULE_MATERIAL, entityId: moduleId },
      orderBy: { createdAt: 'desc' },
    });
    return this.mapUploadRows(moduleUploads);
  }

  private async filesForLesson(lessonId: string, moduleId: string) {
    const lessonUploads = await this.prisma.upload.findMany({
      where: { entityType: ClassCurriculumService.ENTITY_CURRICULUM_LESSON, entityId: lessonId },
      orderBy: { createdAt: 'desc' },
    });
    if (lessonUploads.length) return this.mapUploadRows(lessonUploads);
    const moduleUploads = await this.prisma.upload.findMany({
      where: { entityType: ClassCurriculumService.ENTITY_MODULE_MATERIAL, entityId: moduleId },
      orderBy: { createdAt: 'desc' },
    });
    return this.mapUploadRows(moduleUploads);
  }

  private lessonSummary(lesson: {
    id: string
    position: number
    title: string
    objective?: string | null
    outline?: unknown
    exercises?: unknown
    quickCheckQuestions?: unknown
    takeHomeTask?: string | null
    resources?: unknown
    estimatedDurationMins?: number
    module?: { id: string; number: number; title: string; track: string }
  }) {
    return {
      id: lesson.id,
      position: lesson.position,
      title: lesson.title,
      objective: lesson.objective,
      outline: lesson.outline,
      exercises: lesson.exercises,
      quickCheckQuestions: lesson.quickCheckQuestions,
      takeHomeTask: lesson.takeHomeTask,
      resources: lesson.resources,
      estimatedDurationMins: lesson.estimatedDurationMins,
      module: lesson.module,
    };
  }

  /**
   * After a session ends: advance class "next lesson" pointer and mark all students in the class
   * as having completed the delivered lesson (shared class progress).
   *
   * @param outerTx When provided (e.g. from `SessionsService.endSession`), curriculum writes use
   * this client. Notification rows are returned for the caller to persist **after** its transaction
   * commits (avoids aborting the DB transaction if `createMany` fails on PostgreSQL).
   */
  async recordDeliveryAfterSession(
    session: {
      id: string;
      schoolId: string;
      className: string;
      lessonId: string | null;
      track: string;
    },
    outerTx?: PrismaDb,
  ): Promise<{ deferredNotifications?: { userId: string; title: string; message: string; link: string }[] }> {
    if (!session.lessonId) return {};

    const track = session.track as TrackLevel;
    const dbRead = outerTx ?? this.prisma;
    const student = await dbRead.student.findFirst({
      where: { schoolId: session.schoolId, className: session.className, track },
      select: { track3Stack: true },
    });
    const stack = track === TrackLevel.TRACK_3 ? student?.track3Stack ?? Track3Stack.PYTHON_FLASK : null;
    const key = curriculumBranchKey(track, stack);

    const nextLessonId = await this.lessons.resolveNextPublishedLessonId(session.lessonId, stack);

    const runWrites = async (tx: PrismaDb) => {
      const [deliveredLesson, nextLesson] = await Promise.all([
        tx.curriculumLesson.findUnique({
          where: { id: session.lessonId },
          select: { id: true, position: true, title: true, module: { select: { number: true, title: true } } },
        }),
        nextLessonId
          ? tx.curriculumLesson.findUnique({
              where: { id: nextLessonId },
              select: { id: true, position: true, title: true, module: { select: { number: true, title: true } } },
            })
          : Promise.resolve(null),
      ]);

      await tx.classCurriculumState.upsert({
        where: {
          schoolId_className_curriculumBranchKey: {
            schoolId: session.schoolId,
            className: session.className,
            curriculumBranchKey: key,
          },
        },
        create: {
          schoolId: session.schoolId,
          className: session.className,
          curriculumBranchKey: key,
          currentLessonId: nextLessonId,
          lastDeliveredLessonId: session.lessonId,
        },
        update: { currentLessonId: nextLessonId, lastDeliveredLessonId: session.lessonId },
      });

      const students = await tx.student.findMany({
        where: { schoolId: session.schoolId, className: session.className, track },
        select: { id: true, userId: true },
      });
      const now = new Date();
      await Promise.all(
        students.map((s) =>
          tx.studentLessonProgress.upsert({
            where: { studentId_lessonId: { studentId: s.id, lessonId: session.lessonId! } },
            create: {
              studentId: s.id,
              lessonId: session.lessonId!,
              sessionId: session.id,
              completed: true,
              completedAt: now,
            },
            update: {
              sessionId: session.id,
              completed: true,
              completedAt: now,
            },
          }),
        ),
      );

      const deliveredLabel = deliveredLesson
        ? `Lesson ${deliveredLesson.position}: ${deliveredLesson.title}`
        : 'a lesson';
      const nextLabel = nextLesson ? `Lesson ${nextLesson.position}: ${nextLesson.title}` : 'the next lesson';
      const moduleLabel = nextLesson?.module?.number
        ? `Module ${nextLesson.module.number}: ${nextLesson.module.title}`
        : deliveredLesson?.module?.number
          ? `Module ${deliveredLesson.module.number}: ${deliveredLesson.module.title}`
          : 'your module';

      const msg =
        nextLessonId
          ? `Your class completed ${deliveredLabel}. Next up: ${nextLabel} (${moduleLabel}).`
          : `Your class completed ${deliveredLabel}. Your tutor will share the next lesson soon.`;

      const notifRows = students.map((s) => ({
        userId: s.userId,
        title: `Class progress updated`,
        message: msg,
        link: '/dashboard/student?section=student-modules',
      }));
      return notifRows;
    };

    if (outerTx) {
      const notifRows = await runWrites(outerTx);
      return notifRows.length ? { deferredNotifications: notifRows } : {};
    }

    const notifRows = await this.prisma.$transaction(async (tx) => runWrites(tx), {
      maxWait: 10_000,
      timeout: 60_000,
    });
    if (notifRows.length) {
      await this.prisma.notification.createMany({ data: notifRows }).catch(() => {});
    }
    return {};
  }

  /** Uploads entityType stored in `Upload` for files tied to a canonical curriculum lesson. */
  static readonly ENTITY_CURRICULUM_LESSON = 'curriculum-lesson';
  /** Uploads entityType for module-wide materials when there are no per-lesson files or as fallback. */
  static readonly ENTITY_MODULE_MATERIAL = 'module-material';
  /** Tutor lesson plan attachments (PDF, slides, etc.). */
  static readonly ENTITY_LESSON_PLAN = 'lesson-plan';

  private mapUploadRows(rows: { id: string; url: string; resourceType: string; createdAt: Date }[]) {
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      fileUrl: r.url,
      resourceType: r.resourceType,
      createdAt: r.createdAt,
      fileName: this.displayNameFromUrl(r.url),
    }));
  }

  private displayNameFromUrl(url: string) {
    try {
      const u = new URL(url);
      const last = decodeURIComponent(u.pathname.split('/').pop() || '');
      return last || 'Download';
    } catch {
      return 'Download';
    }
  }

  /**
   * Full lesson journey for the student's active module: canonical content, completion, files.
   */
  async getStudentLessonJourney(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true, schoolId: true, className: true, track: true, track3Stack: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const stack =
      student.track === TrackLevel.TRACK_3 ? student.track3Stack ?? Track3Stack.PYTHON_FLASK : null;
    const modWhere = modulesWhereForTrack(student.track, student.track3Stack);
    const progresses = await this.prisma.moduleProgress.findMany({
      where: { studentId: student.id, module: modWhere },
      include: { module: { select: { id: true, number: true, title: true, track: true, description: true } } },
      orderBy: { module: { number: 'asc' } },
    });
    const activeProgress =
      progresses.find((p) => p.status === ModuleStatus.IN_PROGRESS) ||
      progresses.find((p) => p.status === ModuleStatus.FAILED) ||
      progresses.find((p) => p.status !== ModuleStatus.LOCKED && p.status !== ModuleStatus.COMPLETED) ||
      progresses[progresses.length - 1] ||
      null;

    const state = await this.getState(student.schoolId, student.className, student.track, stack);
    const moduleId = activeProgress?.moduleId ?? state?.currentLesson?.moduleId ?? state?.lastDeliveredLesson?.moduleId ?? null;

    if (!moduleId) {
      return {
        activeModule: null,
        nextLesson: null,
        lastDeliveredLesson: null,
        lessons: [],
        moduleFiles: [],
        tutorHandouts: [],
        tutorLessonMaterials: [],
      };
    }

    const lessons = await this.prisma.curriculumLesson.findMany({
      where: { moduleId, isPublished: true },
      orderBy: { position: 'asc' },
      include: { module: { select: { id: true, number: true, title: true, track: true } } },
    });

    const progressRows = await this.prisma.studentLessonProgress.findMany({
      where: { studentId: student.id, lessonId: { in: lessons.map((l) => l.id) } },
    });
    const progressByLesson = new Map(progressRows.map((r) => [r.lessonId, r]));

    const activityByLesson = await this.lessonActivities.enrichLessonsForStudent(
      student.id,
      student.schoolId,
      student.className,
      moduleId,
      lessons.map((l) => l.id),
    );

    const lessonItems = await Promise.all(
      lessons.map(async (L) => ({
        ...this.lessonSummary(L),
        delivered: progressByLesson.get(L.id)?.completed ?? false,
        completed: progressByLesson.get(L.id)?.completed ?? false,
        completedAt: progressByLesson.get(L.id)?.completedAt ?? null,
        quickCheckScore: progressByLesson.get(L.id)?.quickCheckScore ?? null,
        files: await this.filesForLesson(L.id, moduleId),
        activities: activityByLesson.get(L.id) ?? { microQuiz: null, lessonAssignment: null },
      })),
    );

    const formativeSummary = await this.lessonActivities.studentFormativeSummary(student.id, moduleId);

    const nextLesson = state?.currentLesson
      ? {
          ...this.lessonSummary(state.currentLesson as any),
          files: await this.filesForLesson(state.currentLesson.id, state.currentLesson.moduleId),
        }
      : null;

    const lastDelivered = state?.lastDeliveredLesson
      ? {
          ...this.lessonSummary(state.lastDeliveredLesson as any),
          files: await this.filesForLesson(state.lastDeliveredLesson.id, state.lastDeliveredLesson.moduleId),
        }
      : null;

    const moduleFiles = await this.filesForModule(moduleId);

    const classLessonPlans = await this.prisma.lessonPlan.findMany({
      where: {
        schoolId: student.schoolId,
        className: student.className,
        moduleId,
      },
      orderBy: [{ materialPublishedAt: 'desc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        studentHandoutMarkdown: true,
        materialPublishedAt: true,
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });

    const tutorHandouts = classLessonPlans
      .filter((p) => p.materialPublishedAt != null && p.studentHandoutMarkdown?.trim())
      .map((p) => ({
        id: p.id,
        title: p.title,
        handoutMarkdown: p.studentHandoutMarkdown,
        publishedAt: p.materialPublishedAt,
        curriculumLesson: p.curriculumLesson,
      }));

    const tutorLessonMaterials = await Promise.all(
      classLessonPlans.map(async (p) => {
        const uploads = await this.prisma.upload.findMany({
          where: {
            entityType: ClassCurriculumService.ENTITY_LESSON_PLAN,
            entityId: p.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        const files = this.mapUploadRows(uploads);
        const hasPublishedHandout = !!(p.materialPublishedAt && p.studentHandoutMarkdown?.trim());
        if (!files.length && !hasPublishedHandout) return null;
        return {
          id: p.id,
          title: p.title,
          curriculumLesson: p.curriculumLesson,
          files,
          hasPublishedHandout,
          publishedAt: p.materialPublishedAt,
        };
      }),
    );

    return {
      activeModule: activeProgress?.module ?? lessons[0]?.module ?? null,
      moduleProgress: activeProgress
        ? { status: activeProgress.status, score: activeProgress.score }
        : null,
      nextLesson,
      lastDeliveredLesson: lastDelivered,
      lessons: lessonItems,
      lessonFormativeSummary: formativeSummary,
      moduleFiles,
      tutorHandouts,
      tutorLessonMaterials: tutorLessonMaterials.filter(Boolean),
    };
  }

  /**
   * Resolved learning files for a student: last delivered lesson, next lesson, and module fallback.
   */
  async getLearningMaterialsForStudent(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: {
        id: true,
        schoolId: true,
        className: true,
        track: true,
        track3Stack: true,
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const stack =
      student.track === TrackLevel.TRACK_3 ? student.track3Stack ?? Track3Stack.PYTHON_FLASK : null;
    const state = await this.getState(student.schoolId, student.className, student.track, stack);

    const modWhere = modulesWhereForTrack(student.track, student.track3Stack);

    const resolveFallbackModuleId = async (): Promise<string | null> => {
      const progresses = await this.prisma.moduleProgress.findMany({
        where: { studentId: student.id, module: modWhere },
        include: { module: { select: { id: true, number: true } } },
        orderBy: { module: { number: 'asc' } },
      });
      const pick =
        progresses.find((p) => p.status === ModuleStatus.IN_PROGRESS) ||
        progresses.find((p) => p.status === ModuleStatus.FAILED) ||
        progresses.find((p) => p.status !== ModuleStatus.LOCKED && p.status !== ModuleStatus.COMPLETED) ||
        progresses[0];
      return pick?.moduleId ?? null;
    };

    const buildLessonBundle = async (
      lesson: { id: string; title: string; position: number; moduleId: string; module: any },
      role: 'next' | 'last_delivered',
    ) => {
      const files = await this.filesForLesson(lesson.id, lesson.moduleId);
      return {
        role,
        lesson: { id: lesson.id, title: lesson.title, position: lesson.position },
        module: lesson.module,
        files,
      };
    };

    const bundles: Awaited<ReturnType<typeof buildLessonBundle>>[] = [];

    if (state?.lastDeliveredLesson) {
      bundles.push(await buildLessonBundle(state.lastDeliveredLesson as any, 'last_delivered'));
    }
    if (
      state?.currentLesson &&
      state.currentLesson.id !== state.lastDeliveredLesson?.id
    ) {
      bundles.push(await buildLessonBundle(state.currentLesson as any, 'next'));
    }

    if (bundles.length) {
      const primary = bundles.find((b) => b.role === 'last_delivered') ?? bundles[0];
      return {
        anchor: 'lesson' as const,
        source: primary.files.length ? 'lesson_or_module_files' : 'none',
        currentLesson: primary.lesson,
        nextLesson: bundles.find((b) => b.role === 'next')?.lesson ?? null,
        lastDeliveredLesson: bundles.find((b) => b.role === 'last_delivered')?.lesson ?? null,
        module: primary.module,
        files: primary.files,
        bundles,
      };
    }

    if (state?.currentLessonId) {
      const lesson = await this.prisma.curriculumLesson.findUnique({
        where: { id: state.currentLessonId },
        include: { module: { select: { id: true, number: true, title: true, track: true } } },
      });
      if (lesson) {
        const files = await this.filesForLesson(lesson.id, lesson.moduleId);
        return {
          anchor: 'lesson' as const,
          source: files.length ? 'lesson_or_module_files' : 'none',
          currentLesson: { id: lesson.id, title: lesson.title, position: lesson.position },
          nextLesson: { id: lesson.id, title: lesson.title, position: lesson.position },
          lastDeliveredLesson: null,
          module: lesson.module,
          files,
          bundles: [],
        };
      }
    }

    const moduleId = await resolveFallbackModuleId();
    if (!moduleId) {
      return {
        anchor: 'none' as const,
        source: 'none' as const,
        currentLesson: null,
        module: null,
        files: [],
      };
    }
    const files = await this.prisma.upload.findMany({
      where: { entityType: ClassCurriculumService.ENTITY_MODULE_MATERIAL, entityId: moduleId },
      orderBy: { createdAt: 'desc' },
    });
    const mod = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, number: true, title: true, track: true },
    });
    return {
      anchor: 'module' as const,
      source: 'module_only_uploads' as const,
      currentLesson: null,
      module: mod,
      files: this.mapUploadRows(files),
    };
  }
}
