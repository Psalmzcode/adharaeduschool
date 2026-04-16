import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef, toLessonPlanTitle } from '../common/module-content';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tutorUserId: string) {
    return this.prisma.lessonPlan.findMany({
      where: { tutorId: tutorUserId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });
  }

  async findBySchool(schoolId: string) {
    return this.prisma.lessonPlan.findMany({
      where: { schoolId },
      include: {
        tutor: { select: { firstName: true, lastName: true } },
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findForStudent(studentUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      select: { schoolId: true, className: true, track: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return this.prisma.lessonPlan.findMany({
      where: {
        schoolId: student.schoolId,
        className: student.className,
      },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });
  }

  private async resolveCurriculumLessonId(moduleId: string, curriculumLessonId: string | null | undefined) {
    const raw = curriculumLessonId?.trim() || '';
    if (!raw) return null;
    const lesson = await this.prisma.curriculumLesson.findUnique({ where: { id: raw } });
    if (!lesson) throw new BadRequestException('Curriculum lesson not found');
    if (lesson.moduleId !== moduleId) throw new BadRequestException('Curriculum lesson does not belong to this module');
    return lesson.id;
  }

  async create(tutorUserId: string, data: any) {
    const moduleRef = await resolveModuleRef(this.prisma, data?.moduleId);
    const curriculumLessonId = await this.resolveCurriculumLessonId(moduleRef.moduleId, data?.curriculumLessonId);
    const classNames: string[] = Array.isArray(data.classNames)
      ? Array.from(new Set(data.classNames.map((c: any) => String(c || '').trim()).filter(Boolean)))
      : [];
    const targets: string[] = classNames.length ? classNames : [String(data.className || '').trim()].filter(Boolean);

    const createOne = (className: string) =>
      this.prisma.lessonPlan.create({
        data: {
          tutorId: tutorUserId,
          schoolId: data.schoolId || '',
          className,
          moduleId: moduleRef.moduleId,
          curriculumLessonId,
          title: toLessonPlanTitle(moduleRef),
          durationMins: data.durationMins || 75,
          venue: data.venue,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          steps: data.steps || [],
        },
        include: {
          curriculumLesson: { select: { id: true, title: true, position: true } },
        },
      });

    if (targets.length <= 1) {
      return createOne(targets[0] || data.className);
    }

    return this.prisma.$transaction(targets.map((className) => createOne(className)));
  }

  async update(id: string, tutorUserId: string, data: any) {
    const plan = await this.prisma.lessonPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    if (plan.tutorId !== tutorUserId) throw new ForbiddenException();
    const nextModuleId = data?.moduleId ?? plan.moduleId;
    const moduleRef = await resolveModuleRef(this.prisma, nextModuleId);
    let curriculumLessonId: string | null | undefined = undefined;
    if (data?.curriculumLessonId !== undefined) {
      curriculumLessonId = await this.resolveCurriculumLessonId(moduleRef.moduleId, data.curriculumLessonId);
    }
    const allowed: any = {
      className: data?.className,
      moduleId: moduleRef.moduleId,
      title: toLessonPlanTitle(moduleRef),
      durationMins: data?.durationMins,
      venue: data?.venue,
      scheduledAt: data?.scheduledAt ? new Date(data.scheduledAt) : data?.scheduledAt === null ? null : undefined,
      steps: data?.steps,
    };
    if (curriculumLessonId !== undefined) {
      allowed.curriculumLessonId = curriculumLessonId;
    }
    const sanitized = Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined),
    );
    return this.prisma.lessonPlan.update({
      where: { id },
      data: sanitized,
      include: {
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });
  }

  async delete(id: string, tutorUserId: string) {
    const plan = await this.prisma.lessonPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException();
    if (plan.tutorId !== tutorUserId) throw new ForbiddenException();
    return this.prisma.lessonPlan.delete({ where: { id } });
  }
}
