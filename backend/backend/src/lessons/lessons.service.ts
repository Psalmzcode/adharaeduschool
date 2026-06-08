import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveModuleRef, toLessonPlanTitle } from '../common/module-content';
import {
  geminiGenerateJson,
  geminiGenerateText,
  preferredLessonGeminiModels,
} from '../common/gemini-json.client';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

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
        materialPublishedAt: { not: null },
        studentHandoutMarkdown: { not: null },
      },
      orderBy: [{ materialPublishedAt: 'desc' }, { scheduledAt: 'desc' }],
      select: {
        id: true,
        title: true,
        moduleId: true,
        className: true,
        studentHandoutMarkdown: true,
        materialPublishedAt: true,
        scheduledAt: true,
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });
  }

  /** Publish tutor AI (or edited) student handout to the class. */
  async publishMaterial(
    planId: string,
    tutorUserId: string,
    data?: { studentHandoutMarkdown?: string },
  ) {
    const plan = await this.prisma.lessonPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    if (plan.tutorId !== tutorUserId) throw new ForbiddenException();

    const handout = String(data?.studentHandoutMarkdown ?? plan.studentHandoutMarkdown ?? '').trim();
    if (handout.length < 100) {
      throw new BadRequestException('Student handout is too short to publish (min ~100 characters)');
    }

    const updated = await this.prisma.lessonPlan.update({
      where: { id: planId },
      data: {
        studentHandoutMarkdown: handout,
        materialPublishedAt: new Date(),
      },
      include: {
        curriculumLesson: { select: { id: true, title: true, position: true } },
      },
    });

    const students = await this.prisma.student.findMany({
      where: { schoolId: plan.schoolId, className: plan.className },
      select: { userId: true },
    });
    if (students.length) {
      await this.prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.userId,
          title: `New lesson material: ${plan.title}`,
          message: `Your tutor published handout notes for ${plan.className}. Open My Modules to read.`,
          link: '/dashboard/student?section=student-modules',
        })),
      }).catch(() => {});
    }

    return updated;
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
          studentHandoutMarkdown: data.studentHandoutMarkdown?.trim() || null,
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
      studentHandoutMarkdown: data?.studentHandoutMarkdown,
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

  /**
   * Gemini draft of lesson steps (tutor reviews before save). Uses module objectives + optional linked curriculum lesson.
   */
  async generateStepDraft(
    tutorUserId: string,
    data: { moduleId?: string; curriculumLessonId?: string | null; durationMins?: number },
  ) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) throw new BadRequestException('Tutor profile not found');

    const moduleId = String(data?.moduleId || '').trim();
    if (!moduleId) throw new BadRequestException('moduleId is required');

    const durationMins = Math.min(Math.max(Number(data?.durationMins) || 75, 20), 180);

    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        title: true,
        number: true,
        description: true,
        objectives: true,
        track: true,
      },
    });
    if (!module) throw new BadRequestException('Module not found');

    let lessonBlock = '';
    const rawLessonId = String(data?.curriculumLessonId || '').trim();
    if (rawLessonId) {
      const lesson = await this.prisma.curriculumLesson.findUnique({
        where: { id: rawLessonId },
        select: {
          id: true,
          title: true,
          position: true,
          objective: true,
          quickCheckQuestions: true,
          exercises: true,
          resources: true,
          moduleId: true,
        },
      });
      if (!lesson) throw new BadRequestException('Curriculum lesson not found');
      if (lesson.moduleId !== moduleId) throw new BadRequestException('Curriculum lesson does not belong to this module');
      lessonBlock = `\nLinked curriculum lesson (anchor for this session):\n${JSON.stringify(lesson)}\n`;
    }

    const prompt = [
      `You are drafting a lesson plan for Nigerian secondary-school ICT / programming classes.`,
      `Return ONLY valid JSON with this exact shape:`,
      `{"steps":[{"title":string,"desc":string,"mins":number}]}`,
      ``,
      `Rules:`,
      `- Produce between 4 and 7 steps.`,
      `- Titles are short section headings (e.g. "Starter", "Demo", "Guided practice").`,
      `- Descriptions are practical classroom instructions (what the teacher does + what students do).`,
      `- Minutes are positive integers and MUST sum exactly to ${durationMins}.`,
      `- Align content with the module objectives and (if provided) the linked curriculum lesson.`,
      ``,
      `Module context:`,
      JSON.stringify(module),
      lessonBlock,
    ].join('\n');

    const { jsonText, modelUsed } = await geminiGenerateJson(this.config, prompt, { temperature: 0.35 });
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for lesson steps');
    }
    const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const steps = rawSteps
      .map((s: any) => ({
        title: String(s?.title || '').trim(),
        desc: String(s?.desc || '').trim(),
        mins: Math.max(0, Math.round(Number(s?.mins) || 0)),
      }))
      .filter((s) => s.title || s.desc || s.mins > 0);

    if (steps.length < 3) {
      throw new BadRequestException('AI returned too few lesson steps — try again');
    }

    let sum = steps.reduce((a, s) => a + s.mins, 0);
    if (sum !== durationMins && steps.length) {
      const diff = durationMins - sum;
      const last = { ...steps[steps.length - 1] };
      last.mins = Math.max(1, last.mins + diff);
      steps[steps.length - 1] = last;
      sum = steps.reduce((a, s) => a + s.mins, 0);
    }
    if (sum !== durationMins) {
      throw new BadRequestException(`AI step minutes (${sum}) did not match duration (${durationMins}) — adjust manually or retry`);
    }

    return {
      steps: steps.map((s) => ({ ...s, color: 'var(--gold)' })),
      modelUsed,
    };
  }

  private stripMarkdownFences(text: string): string {
    const t = String(text || '').trim();
    const wrapped = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
    return wrapped ? wrapped[1].trim() : t;
  }

  private parsePracticeAndSlides(parsed: any) {
    const practice = parsed?.practice && typeof parsed.practice === 'object' ? parsed.practice : {};
    const classwork = Array.isArray(practice?.classwork)
      ? practice.classwork.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];
    const homework = Array.isArray(practice?.homework)
      ? practice.homework.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];
    const answers = Array.isArray(practice?.answers)
      ? practice.answers.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];
    const rawSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];
    const slides = rawSlides
      .map((s: any) => ({
        title: String(s?.title || '').trim(),
        bullets: Array.isArray(s?.bullets)
          ? s.bullets.map((b: any) => String(b || '').trim()).filter(Boolean)
          : [],
      }))
      .filter((s) => s.title || s.bullets.length);
    return { classwork, homework, answers, slides };
  }

  private validateLearningMaterialPack(opts: {
    studentHandoutMarkdown: string;
    teacherGuideMarkdown: string;
    classwork: string[];
    homework: string[];
    answers: string[];
    slides: { title: string; bullets: string[] }[];
    minHandout: number;
    minTeacher: number;
  }) {
    if (opts.slides.length < 4) throw new BadRequestException('AI returned too few slides — try again');
    if (!opts.teacherGuideMarkdown || opts.teacherGuideMarkdown.length < opts.minTeacher) {
      throw new BadRequestException(
        `AI teacher guide was too short (need ~${opts.minTeacher}+ characters) — try again or link a curriculum lesson`,
      );
    }
    if (!opts.studentHandoutMarkdown || opts.studentHandoutMarkdown.length < opts.minHandout) {
      throw new BadRequestException(
        `AI student handout was too short (need ~${opts.minHandout}+ characters) — try again or link a curriculum lesson`,
      );
    }
    if (opts.classwork.length < 5 || opts.homework.length < 3 || opts.answers.length < 5) {
      throw new BadRequestException('AI practice section was incomplete — try again');
    }
  }

  private buildSlidesMarkdown(sessionTitle: string, slides: { title: string; bullets: string[] }[]) {
    const mdLines: string[] = [`# ${sessionTitle}`, ''];
    for (const s of slides) {
      mdLines.push(`## ${s.title}`, '');
      for (const b of s.bullets) mdLines.push(`- ${b}`);
      mdLines.push('');
    }
    return mdLines.join('\n').trim();
  }

  /** Quick single-JSON draft (legacy path — faster, shallower). */
  private async generateLearningMaterialQuick(module: any, lessonBlock: string) {
    const prompt = [
      `You are writing a teachable lesson material pack for Nigerian secondary-school ICT / programming classes.`,
      `Return ONLY valid JSON:`,
      `{"sessionTitle":string,"teacherGuideMarkdown":string,"studentHandoutMarkdown":string,` +
        `"practice":{"classwork":string[],"homework":string[],"answers":string[]},` +
        `"slides":[{"title":string,"bullets":string[]}]} `,
      `Keep content concise but complete. Module: ${JSON.stringify(module)}`,
      lessonBlock,
    ].join('\n');

    const { jsonText, modelUsed } = await geminiGenerateJson(this.config, prompt, {
      temperature: 0.4,
      modelsEnvKey: 'GEMINI_MODEL',
    });
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for learning material');
    }

    const sessionTitle = String(parsed?.sessionTitle || `Module ${module.number}: ${module.title}`).trim();
    const teacherGuideMarkdown = String(parsed?.teacherGuideMarkdown || '').trim();
    const studentHandoutMarkdown = String(parsed?.studentHandoutMarkdown || '').trim();
    const { classwork, homework, answers, slides } = this.parsePracticeAndSlides(parsed);

    this.validateLearningMaterialPack({
      studentHandoutMarkdown,
      teacherGuideMarkdown,
      classwork,
      homework,
      answers,
      slides,
      minHandout: 200,
      minTeacher: 200,
    });

    return {
      sessionTitle,
      slides,
      markdown: this.buildSlidesMarkdown(sessionTitle, slides),
      teacherGuideMarkdown,
      studentHandoutMarkdown,
      practice: { classwork, homework, answers },
      modelUsed,
      depth: 'quick' as const,
    };
  }

  /**
   * Multi-pass Gemini draft: long Markdown handout + teacher guide, then JSON for practice/slides.
   * Uses GEMINI_MODEL_LESSONS (flash-first) for depth; GEMINI_MODEL for the small JSON pass.
   */
  private async generateLearningMaterialFull(module: any, lessonBlock: string) {
    const lessonModels = preferredLessonGeminiModels(this.config);
    const longOpts = {
      temperature: 0.4,
      maxOutputTokens: 8192,
      ...(lessonModels.length
        ? { models: lessonModels }
        : { modelsEnvKey: 'GEMINI_MODEL' as const }),
    };

    const contextBlock = [
      `Track: ${module.track}`,
      `Module ${module.number}: ${module.title}`,
      `Description: ${module.description || '—'}`,
      `Objectives: ${JSON.stringify(module.objectives ?? [])}`,
      lessonBlock,
    ].join('\n');

    const handoutPrompt = [
      `You are writing a COMPLETE student revision handout in Markdown for Nigerian secondary-school ICT / programming.`,
      `Output Markdown only (no JSON, no outer code fences). Minimum 2000 characters.`,
      `Required sections (use ## headings):`,
      `## Introduction`,
      `## Core concepts (explain every major idea for this topic in depth)`,
      `## Worked example 1`,
      `## Worked example 2`,
      `## Worked example 3 (include full runnable code in fenced blocks where relevant)`,
      `## Common mistakes`,
      `## Practice questions (questions only, no answers)`,
      `## Recap`,
      `Use clear English. Include definitions, bullet key points, and step-by-step explanations.`,
      ``,
      contextBlock,
    ].join('\n');

    const { text: handoutRaw, modelUsed: handoutModel } = await geminiGenerateText(
      this.config,
      handoutPrompt,
      longOpts,
    );
    const studentHandoutMarkdown = this.stripMarkdownFences(handoutRaw);

    const teacherPrompt = [
      `You are writing a teacher classroom guide in Markdown for a 75-minute Nigerian SS ICT / programming lesson.`,
      `Output Markdown only (no JSON, no outer code fences). Minimum 3000 characters.`,
      `Include: session objectives, materials needed, minute-by-minute flow (0–75),`,
      `what the teacher says/does, live demos, guided practice, checks for understanding,`,
      `differentiation tips, common student mistakes, and closing recap.`,
      `Align with the student handout below and expand with classroom delivery detail.`,
      ``,
      contextBlock,
      ``,
      `Student handout (align your teaching to this):`,
      studentHandoutMarkdown.slice(0, 6000),
    ].join('\n');

    const { text: teacherRaw, modelUsed: teacherModel } = await geminiGenerateText(
      this.config,
      teacherPrompt,
      longOpts,
    );
    const teacherGuideMarkdown = this.stripMarkdownFences(teacherRaw);

    const metaPrompt = [
      `Return ONLY valid JSON:`,
      `{"sessionTitle":string,"practice":{"classwork":string[],"homework":string[],"answers":string[]},` +
        `"slides":[{"title":string,"bullets":string[]}]} `,
      `Rules:`,
      `- sessionTitle: short class session title for Module ${module.number}: ${module.title}`,
      `- practice: at least 5 classwork, 3 homework, 5+ answer key entries`,
      `- slides: 8–12 slides, 4–6 short bullets each (classroom summary, not the full handout)`,
      ``,
      `Topic summary (from generated handout):`,
      studentHandoutMarkdown.slice(0, 4000),
    ].join('\n');

    const { jsonText, modelUsed: metaModel } = await geminiGenerateJson(this.config, metaPrompt, {
      temperature: 0.35,
      modelsEnvKey: 'GEMINI_MODEL',
    });
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for practice/slides');
    }

    const sessionTitle = String(parsed?.sessionTitle || `Module ${module.number}: ${module.title}`).trim();
    const { classwork, homework, answers, slides } = this.parsePracticeAndSlides(parsed);

    this.validateLearningMaterialPack({
      studentHandoutMarkdown,
      teacherGuideMarkdown,
      classwork,
      homework,
      answers,
      slides,
      minHandout: 2000,
      minTeacher: 3000,
    });

    return {
      sessionTitle,
      slides,
      markdown: this.buildSlidesMarkdown(sessionTitle, slides),
      teacherGuideMarkdown,
      studentHandoutMarkdown,
      practice: { classwork, homework, answers },
      modelUsed: [handoutModel, teacherModel, metaModel].filter(Boolean).join(' → '),
      depth: 'full' as const,
    };
  }

  /**
   * Gemini draft of teaching material pack (teacher guide + student handout + practice + slides).
   * Default `depth: full` uses multi-pass generation for richer handouts.
   */
  async generateLearningMaterialDraft(
    tutorUserId: string,
    data: { moduleId?: string; curriculumLessonId?: string | null; depth?: 'full' | 'quick' },
  ) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { userId: tutorUserId },
      select: { id: true },
    });
    if (!tutor) throw new BadRequestException('Tutor profile not found');

    const moduleId = String(data?.moduleId || '').trim();
    if (!moduleId) throw new BadRequestException('moduleId is required');

    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        title: true,
        number: true,
        description: true,
        objectives: true,
        track: true,
      },
    });
    if (!module) throw new BadRequestException('Module not found');

    let lessonBlock = '';
    const rawLessonId = String(data?.curriculumLessonId || '').trim();
    if (rawLessonId) {
      const lesson = await this.prisma.curriculumLesson.findUnique({
        where: { id: rawLessonId },
        select: {
          id: true,
          title: true,
          position: true,
          objective: true,
          outline: true,
          exercises: true,
          quickCheckQuestions: true,
          resources: true,
          moduleId: true,
        },
      });
      if (!lesson) throw new BadRequestException('Curriculum lesson not found');
      if (lesson.moduleId !== moduleId) throw new BadRequestException('Curriculum lesson does not belong to this module');
      lessonBlock = `\nLinked curriculum lesson (anchor all content to this):\n${JSON.stringify(lesson)}\n`;
    }

    const depth = data?.depth === 'quick' ? 'quick' : 'full';
    if (depth === 'quick') {
      return this.generateLearningMaterialQuick(module, lessonBlock);
    }
    return this.generateLearningMaterialFull(module, lessonBlock);
  }
}
