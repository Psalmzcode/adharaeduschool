import { Injectable } from '@nestjs/common';
import { Track3Stack, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { curriculumBranchKey } from '../common/curriculum-branch';
import { CurriculumLessonsService } from './curriculum-lessons.service';

@Injectable()
export class ClassCurriculumService {
  constructor(
    private prisma: PrismaService,
    private lessons: CurriculumLessonsService,
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
      },
    });
    return row;
  }

  /**
   * After a session ends: advance class "next lesson" pointer and mark all students in the class
   * as having completed the delivered lesson (shared class progress).
   */
  async recordDeliveryAfterSession(session: {
    id: string;
    schoolId: string;
    className: string;
    lessonId: string | null;
    track: string;
  }) {
    if (!session.lessonId) return;

    const track = session.track as TrackLevel;
    const student = await this.prisma.student.findFirst({
      where: { schoolId: session.schoolId, className: session.className, track },
      select: { track3Stack: true },
    });
    const stack = track === TrackLevel.TRACK_3 ? student?.track3Stack ?? Track3Stack.PYTHON_FLASK : null;
    const key = curriculumBranchKey(track, stack);

    const nextLessonId = await this.lessons.resolveNextPublishedLessonId(session.lessonId, stack);
    const [deliveredLesson, nextLesson] = await Promise.all([
      this.prisma.curriculumLesson.findUnique({
        where: { id: session.lessonId },
        select: { id: true, position: true, title: true, module: { select: { number: true, title: true } } },
      }),
      nextLessonId
        ? this.prisma.curriculumLesson.findUnique({
            where: { id: nextLessonId },
            select: { id: true, position: true, title: true, module: { select: { number: true, title: true } } },
          })
        : Promise.resolve(null),
    ]);

    await this.prisma.classCurriculumState.upsert({
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
      },
      update: { currentLessonId: nextLessonId },
    });

    const students = await this.prisma.student.findMany({
      where: { schoolId: session.schoolId, className: session.className, track },
      select: { id: true, userId: true },
    });
    const now = new Date();
    await Promise.all(
      students.map((s) =>
        this.prisma.studentLessonProgress.upsert({
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

    // In-app notification: class moved forward together (non-blocking).
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

    const rows = students.map((s) => ({
      userId: s.userId,
      title: `Class progress updated`,
      message: msg,
      link: '/dashboard/student?section=student-modules',
    }));
    if (rows.length) {
      await this.prisma.notification.createMany({ data: rows }).catch(() => {});
    }
  }
}
