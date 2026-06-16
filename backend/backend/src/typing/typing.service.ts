import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleStackVariant, TrackLevel } from '@prisma/client';
import { geminiGenerateJson } from '../common/gemini-json.client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORMAL_TEST_DURATION_SEC,
  PROGRAMME_WPM_TARGET,
  TYPING_DRILLS,
  TRACK1_TYPING_MODULE_NUMBER,
  computeTypingMetrics,
  drillByKey,
  isTrack1TypingAnchorModule,
  moduleProgressUnlocksTypingLab,
} from './typing.constants';
import {
  TypingFeedbackContext,
  analyzeTypingErrorProfile,
  buildRuleBasedTypingFeedback,
  buildTypingFeedbackGeminiPrompt,
  mergeErrorProfiles,
  parseErrorProfile,
  parseTypingFeedbackJson,
} from './typing-feedback.util';

@Injectable()
export class TypingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}



  listDrills() {

    return {

      formalTestDurationSec: FORMAL_TEST_DURATION_SEC,

      programmeWpmTarget: 25,

      drills: TYPING_DRILLS.map((d) => ({

        key: d.key,

        title: d.title,

        description: d.description,

        kind: d.kind,

        text: d.text,

        preview: d.text.slice(0, 120) + (d.text.length > 120 ? '…' : ''),

      })),

    };

  }



  async findTrack1TypingModule() {

    return this.prisma.module.findFirst({

      where: {

        track: TrackLevel.TRACK_1,

        number: TRACK1_TYPING_MODULE_NUMBER,

        stackVariant: ModuleStackVariant.COMMON,

      },

      select: { id: true, number: true, title: true, track: true },

    });

  }



  /** Track 1 students unlock the lab once Module 2 is no longer LOCKED (tutor-paced). */

  async getStudentTypingLabAccess(userId: string) {

    const student = await this.prisma.student.findUnique({

      where: { userId },

      select: { id: true, track: true },

    });

    if (!student) throw new NotFoundException('Student profile not found');



    const anchor = await this.findTrack1TypingModule();

    if (!student || student.track !== TrackLevel.TRACK_1 || !anchor) {

      return {

        unlocked: false,

        moduleId: anchor?.id ?? null,

        moduleNumber: anchor?.number ?? TRACK1_TYPING_MODULE_NUMBER,

        moduleTitle: anchor?.title ?? null,

        reason: student?.track !== TrackLevel.TRACK_1 ? 'not_track_1' : 'no_anchor_module',

      };

    }



    const progress = await this.prisma.moduleProgress.findUnique({

      where: { studentId_moduleId: { studentId: student.id, moduleId: anchor.id } },

      select: { status: true },

    });



    const unlocked = moduleProgressUnlocksTypingLab(progress?.status);

    return {

      unlocked,

      moduleId: anchor.id,

      moduleNumber: anchor.number,

      moduleTitle: anchor.title,

      reason: unlocked ? 'module_2_reached' : 'module_2_locked',

    };

  }



  private async assertCanUseTypingLab(userId: string, moduleId: string) {

    const access = await this.getStudentTypingLabAccess(userId);

    if (!access.unlocked || !access.moduleId) {

      throw new BadRequestException(

        'Typing lab unlocks on Track 1 once your class reaches Module 2 (Mouse, Keyboard & Windows)',

      );

    }

    if (moduleId !== access.moduleId) {

      throw new BadRequestException('Invalid typing module reference');

    }

    const module = await this.prisma.module.findUnique({

      where: { id: moduleId },

      select: { id: true, number: true, title: true, track: true },

    });

    if (!module || !isTrack1TypingAnchorModule(module)) {

      throw new BadRequestException('Invalid typing module reference');

    }

    return module;

  }



  async saveAttempt(

    userId: string,

    data: {

      moduleId: string;

      drillKey: string;

      typed: string;

      elapsedSec: number;

    },

  ) {

    const module = await this.assertCanUseTypingLab(userId, data.moduleId);



    const drill = drillByKey(data.drillKey);

    if (!drill) throw new BadRequestException('Unknown typing drill');



    if (drill.kind === 'formal_test' && data.elapsedSec < FORMAL_TEST_DURATION_SEC - 5) {

      throw new BadRequestException(`Formal test must run for the full ${FORMAL_TEST_DURATION_SEC / 60} minutes`);

    }



    const student = await this.prisma.student.findUnique({

      where: { userId },

      select: { id: true },

    });

    if (!student) throw new NotFoundException('Student profile not found');



    const metrics = computeTypingMetrics(
      { typed: data.typed, source: drill.text, elapsedSec: data.elapsedSec },
      drill.kind,
    );
    const errorProfile = analyzeTypingErrorProfile(data.typed, drill.text);

    return this.prisma.typingAttempt.create({
      data: {
        studentId: student.id,
        moduleId: module.id,
        kind: drill.kind,
        drillKey: drill.key,
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        correctChars: metrics.correctChars,
        errorCount: metrics.errorCount,
        durationSec: metrics.durationSec,
        isValidScore: metrics.isValidScore,
        errorProfile: errorProfile as object,
      },
    });
  }



  async resolveTypingModuleId(moduleId?: string | null) {

    if (moduleId) {

      const module = await this.prisma.module.findUnique({

        where: { id: moduleId },

        select: { id: true, number: true, title: true, track: true },

      });

      if (module && isTrack1TypingAnchorModule(module)) return module.id;

    }

    const anchor = await this.findTrack1TypingModule();

    if (!anchor) throw new NotFoundException('Track 1 typing anchor module not found');

    return anchor.id;

  }



  async mySummary(userId: string, moduleId?: string) {

    const student = await this.prisma.student.findUnique({

      where: { userId },

      select: { id: true },

    });

    if (!student) throw new NotFoundException('Student profile not found');



    const resolvedModuleId = await this.resolveTypingModuleId(moduleId);

    const access = await this.getStudentTypingLabAccess(userId);



    const attempts = await this.prisma.typingAttempt.findMany({

      where: { studentId: student.id, moduleId: resolvedModuleId },

      orderBy: { submittedAt: 'desc' },

      take: 50,

    });



    const validFormal = attempts.filter((a) => a.kind === 'formal_test' && a.isValidScore);

    const bestFormal = validFormal.sort((a, b) => b.wpm - a.wpm)[0] ?? null;

    const practiceCount = attempts.filter((a) => a.kind === 'practice').length;



    return {

      moduleId: resolvedModuleId,

      unlocked: access.unlocked,

      practiceSessions: practiceCount,

      bestFormal: bestFormal

        ? {

            wpm: bestFormal.wpm,

            accuracy: bestFormal.accuracy,

            submittedAt: bestFormal.submittedAt,

          }

        : null,

      recent: attempts.slice(0, 8).map((a) => ({

        id: a.id,

        kind: a.kind,

        drillKey: a.drillKey,

        wpm: a.wpm,

        accuracy: a.accuracy,

        isValidScore: a.isValidScore,

        submittedAt: a.submittedAt,

      })),

    };

  }



  async classSummary(schoolId: string, className: string, moduleId?: string) {

    const students = await this.prisma.student.findMany({

      where: { schoolId, className, track: TrackLevel.TRACK_1 },

      select: {

        id: true,

        user: { select: { firstName: true, lastName: true } },

      },

    });

    if (!students.length) return [];



    const resolvedModuleId = await this.resolveTypingModuleId(moduleId);



    const anchorProgress = await this.prisma.moduleProgress.findMany({

      where: {

        moduleId: resolvedModuleId,

        studentId: { in: students.map((s) => s.id) },

      },

      select: { studentId: true, status: true },

    });

    const unlockByStudent = new Map(

      anchorProgress.map((p) => [p.studentId, moduleProgressUnlocksTypingLab(p.status)]),

    );



    const attempts = await this.prisma.typingAttempt.findMany({

      where: {

        moduleId: resolvedModuleId,

        studentId: { in: students.map((s) => s.id) },

      },

      orderBy: [{ wpm: 'desc' }, { submittedAt: 'desc' }],

    });



    return students.map((s) => {

      const mine = attempts.filter((a) => a.studentId === s.id);

      const bestFormal = mine

        .filter((a) => a.kind === 'formal_test' && a.isValidScore)

        .sort((a, b) => b.wpm - a.wpm)[0];

      const name = `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim();

      return {

        studentId: s.id,

        studentLabel: name || s.id,

        labUnlocked: unlockByStudent.get(s.id) ?? false,

        practiceSessions: mine.filter((a) => a.kind === 'practice').length,

        bestFormalWpm: bestFormal?.wpm ?? null,

        bestFormalAccuracy: bestFormal?.accuracy ?? null,

        lastAttemptAt: mine[0]?.submittedAt ?? null,

      };

    });

  }

  private weekStartDaysAgo(days: number) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  }

  private async buildFeedbackContext(userId: string, moduleId?: string): Promise<TypingFeedbackContext> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true, user: { select: { firstName: true } } },
    });
    if (!student) throw new NotFoundException('Student profile not found');

    const resolvedModuleId = await this.resolveTypingModuleId(moduleId);
    const thisWeekStart = this.weekStartDaysAgo(7);
    const lastWeekStart = this.weekStartDaysAgo(14);

    const attempts = await this.prisma.typingAttempt.findMany({
      where: { studentId: student.id, moduleId: resolvedModuleId },
      orderBy: { submittedAt: 'desc' },
      take: 40,
    });

    const thisWeek = attempts.filter((a) => a.submittedAt >= thisWeekStart);
    const lastWeek = attempts.filter((a) => a.submittedAt >= lastWeekStart && a.submittedAt < thisWeekStart);

    const bestWpm = (rows: typeof attempts) => {
      if (!rows.length) return null;
      return Math.max(...rows.map((a) => Math.round(a.wpm)));
    };

    const avgAccuracy = (rows: typeof attempts) => {
      if (!rows.length) return null;
      const sum = rows.reduce((s, a) => s + a.accuracy, 0);
      return Math.round((sum / rows.length) * 10) / 10;
    };

    const profiles = attempts
      .map((a) => parseErrorProfile(a.errorProfile))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const errorProfile = mergeErrorProfiles(profiles);

    const drillStats = new Map<string, { totalAcc: number; count: number }>();
    for (const a of thisWeek) {
      const cur = drillStats.get(a.drillKey) || { totalAcc: 0, count: 0 };
      cur.totalAcc += a.accuracy;
      cur.count += 1;
      drillStats.set(a.drillKey, cur);
    }

    let weakestDrillKey: string | null = null;
    let weakestDrillAccuracy: number | null = null;
    for (const [key, stat] of drillStats) {
      const avg = stat.totalAcc / stat.count;
      if (weakestDrillAccuracy == null || avg < weakestDrillAccuracy) {
        weakestDrillAccuracy = avg;
        weakestDrillKey = key;
      }
    }

    const practiceDrillKeys = TYPING_DRILLS.filter((d) => d.kind === 'practice').map((d) => d.key);
    const triedThisWeek = new Set(thisWeek.map((a) => a.drillKey));
    const neverTriedDrillKeys = practiceDrillKeys.filter((k) => !triedThisWeek.has(k));
    const recentDrillKeys = Array.from(new Set(attempts.slice(0, 10).map((a) => a.drillKey)));

    return {
      firstName: String(student.user?.firstName || 'Student').trim() || 'Student',
      programmeWpmTarget: PROGRAMME_WPM_TARGET,
      practiceSessionsThisWeek: thisWeek.filter((a) => a.kind === 'practice').length,
      thisWeekBestWpm: bestWpm(thisWeek),
      lastWeekBestWpm: bestWpm(lastWeek),
      thisWeekAvgAccuracy: avgAccuracy(thisWeek),
      errorProfile,
      weakestDrillKey,
      weakestDrillAccuracy,
      neverTriedDrillKeys,
      recentDrillKeys,
    };
  }

  async myFeedback(userId: string, moduleId?: string) {
    await this.assertCanUseTypingLab(userId, await this.resolveTypingModuleId(moduleId));
    const ctx = await this.buildFeedbackContext(userId, moduleId);
    const fallback = buildRuleBasedTypingFeedback(ctx);

    const apiKey = (this.config.get<string>('GEMINI_API_KEY') || '').trim();
    if (!apiKey) return fallback;

    try {
      const { jsonText } = await geminiGenerateJson(
        this.config,
        buildTypingFeedbackGeminiPrompt(ctx),
        { temperature: 0.4, maxOutputTokens: 512 },
      );
      const parsed = parseTypingFeedbackJson(jsonText);
      return parsed || fallback;
    } catch {
      return fallback;
    }
  }

}


