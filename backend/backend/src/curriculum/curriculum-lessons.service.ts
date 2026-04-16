import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Track3Stack, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveNextModuleRow } from '../common/module-sequence';

@Injectable()
export class CurriculumLessonsService {
  constructor(private prisma: PrismaService) {}

  async listForModule(moduleId: string, opts?: { publishedOnly?: boolean }) {
    const publishedOnly = opts?.publishedOnly !== false;
    return this.prisma.curriculumLesson.findMany({
      where: { moduleId, ...(publishedOnly ? { isPublished: true } : {}) },
      orderBy: [{ position: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.curriculumLesson.findUnique({ where: { id }, include: { module: true } });
    if (!row) throw new NotFoundException('Curriculum lesson not found');
    return row;
  }

  async create(data: {
    moduleId: string;
    position?: number;
    title: string;
    objective?: string;
    outline?: unknown;
    exercises?: unknown;
    takeHomeTask?: string;
    quickCheckQuestions?: unknown;
    resources?: unknown;
    estimatedDurationMins?: number;
    isPublished?: boolean;
  }) {
    const moduleId = String(data.moduleId || '').trim();
    if (!moduleId) throw new BadRequestException('moduleId is required');
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new BadRequestException('Module not found');

    let position = data.position;
    if (position == null || Number.isNaN(Number(position))) {
      const agg = await this.prisma.curriculumLesson.aggregate({
        where: { moduleId },
        _max: { position: true },
      });
      position = (agg._max.position ?? 0) + 1;
    }

    return this.prisma.curriculumLesson.create({
      data: {
        moduleId,
        position: Math.max(1, Math.floor(Number(position))),
        title: String(data.title || '').trim() || 'Untitled lesson',
        objective: data.objective?.trim() || null,
        outline: data.outline as any,
        exercises: data.exercises as any,
        takeHomeTask: data.takeHomeTask?.trim() || null,
        quickCheckQuestions: data.quickCheckQuestions as any,
        resources: data.resources as any,
        estimatedDurationMins: data.estimatedDurationMins != null ? Math.max(1, Number(data.estimatedDurationMins)) : 60,
        isPublished: !!data.isPublished,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      position: number;
      title: string;
      objective: string;
      outline: unknown;
      exercises: unknown;
      takeHomeTask: string;
      quickCheckQuestions: unknown;
      resources: unknown;
      estimatedDurationMins: number;
      isPublished: boolean;
    }>,
  ) {
    await this.findOne(id);
    const allowed: Record<string, unknown> = {};
    if (data.title !== undefined) allowed.title = String(data.title).trim();
    if (data.objective !== undefined) allowed.objective = data.objective?.trim() || null;
    if (data.outline !== undefined) allowed.outline = data.outline as any;
    if (data.exercises !== undefined) allowed.exercises = data.exercises as any;
    if (data.takeHomeTask !== undefined) allowed.takeHomeTask = data.takeHomeTask?.trim() || null;
    if (data.quickCheckQuestions !== undefined) allowed.quickCheckQuestions = data.quickCheckQuestions as any;
    if (data.resources !== undefined) allowed.resources = data.resources as any;
    if (data.estimatedDurationMins !== undefined) allowed.estimatedDurationMins = Math.max(1, Number(data.estimatedDurationMins));
    if (data.isPublished !== undefined) allowed.isPublished = !!data.isPublished;
    if (data.position !== undefined) allowed.position = Math.max(1, Math.floor(Number(data.position)));
    return this.prisma.curriculumLesson.update({ where: { id }, data: allowed as any });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.curriculumLesson.delete({ where: { id } });
  }

  /**
   * Next published lesson after the given one, or null if at end of published curriculum.
   * For Track 3, pass the class's `track3Stack` so branching (Python vs React) matches the class.
   */
  async resolveNextPublishedLessonId(
    lessonId: string,
    track3StackForTrack3?: Track3Stack | null,
  ): Promise<string | null> {
    const lesson = await this.prisma.curriculumLesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson) return null;

    const nextInModule = await this.prisma.curriculumLesson.findFirst({
      where: {
        moduleId: lesson.moduleId,
        position: { gt: lesson.position },
        isPublished: true,
      },
      orderBy: { position: 'asc' },
    });
    if (nextInModule) return nextInModule.id;

    const track3Stack: Track3Stack | null =
      lesson.module.track === TrackLevel.TRACK_3
        ? (track3StackForTrack3 ?? Track3Stack.PYTHON_FLASK)
        : null;

    let nextMod = await resolveNextModuleRow(this.prisma, lesson.module, track3Stack);
    while (nextMod) {
      const first = await this.prisma.curriculumLesson.findFirst({
        where: { moduleId: nextMod.id, isPublished: true },
        orderBy: { position: 'asc' },
      });
      if (first) return first.id;
      nextMod = await resolveNextModuleRow(this.prisma, nextMod, track3Stack);
    }
    return null;
  }

  async countPublishedInModule(moduleId: string) {
    return this.prisma.curriculumLesson.count({ where: { moduleId, isPublished: true } });
  }
}
