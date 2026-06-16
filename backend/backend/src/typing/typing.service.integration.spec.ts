/**
 * Integration tests for TypingService (real PostgreSQL). Opt-in only.
 *
 * Prerequisites:
 *   pnpm prisma:seed
 *   pnpm scenario:typing-lab
 *
 * Run:
 *   RUN_INTEGRATION=1 pnpm test:integration -- typing.service.integration
 */

import { ConfigService } from '@nestjs/config';
import { PrismaClient, TrackLevel, ModuleStackVariant } from '@prisma/client';
import { TypingService } from './typing.service';
import { PrismaService } from '../prisma/prisma.service';

const runIntegration = process.env.RUN_INTEGRATION === '1';

(runIntegration ? describe : describe.skip)('TypingService integration', () => {
  let prisma: PrismaClient;
  let service: TypingService;
  let module2Id: string;
  let studentUserId: string;
  let schoolId: string;
  const className = 'SS1A';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const mod2 = await prisma.module.findFirst({
      where: {
        track: TrackLevel.TRACK_1,
        number: 2,
        stackVariant: ModuleStackVariant.COMMON,
      },
    });
    if (!mod2) {
      throw new Error('Track 1 module 2 missing — run prisma seed + scenario:typing-lab');
    }
    module2Id = mod2.id;

    const studentUser = await prisma.user.findUnique({
      where: { email: 'typing.demo@crownheights.edu.ng' },
      select: { id: true },
    });
    if (!studentUser) {
      throw new Error('Scenario student missing — run pnpm scenario:typing-lab');
    }
    studentUserId = studentUser.id;

    const student = await prisma.student.findFirst({
      where: { userId: studentUserId },
      select: { schoolId: true },
    });
    if (!student) throw new Error('Student profile missing');
    schoolId = student.schoolId;

    service = new TypingService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists drills with formal duration', () => {
    const catalog = service.listDrills();
    expect(catalog.drills.length).toBeGreaterThanOrEqual(5);
    expect(catalog.drills.some((d) => d.key === 'number_row')).toBe(true);
    expect(catalog.formalTestDurationSec).toBe(180);
    expect(catalog.drills.some((d) => d.key === 'formal')).toBe(true);
  });

  it('grants access for Track 1 student who reached Module 2', async () => {
    const access = await service.getStudentTypingLabAccess(studentUserId);
    expect(access.unlocked).toBe(true);
    expect(access.moduleId).toBe(module2Id);
  });

  it('saves practice attempt for unlocked Track 1 student', async () => {
    const drill = service.listDrills().drills.find((d) => d.key === 'words');
    expect(drill?.text).toBeTruthy();
    const attempt = await service.saveAttempt(studentUserId, {
      moduleId: module2Id,
      drillKey: 'words',
      typed: String(drill!.text).slice(0, 50),
      elapsedSec: 30,
    });
    expect(attempt.kind).toBe('practice');
    expect(attempt.wpm).toBeGreaterThan(0);
  });

  it('returns my-summary with recent attempts', async () => {
    const summary = await service.mySummary(studentUserId, module2Id);
    expect(summary.moduleId).toBe(module2Id);
    expect(summary.unlocked).toBe(true);
    expect(summary.practiceSessions).toBeGreaterThan(0);
    expect(Array.isArray(summary.recent)).toBe(true);
  });

  it('returns coaching feedback for unlocked student', async () => {
    const fb = await service.myFeedback(studentUserId, module2Id);
    expect(fb.headline).toBeTruthy();
    expect(fb.suggestion).toBeTruthy();
    expect(Array.isArray(fb.paragraphs)).toBe(true);
    expect(['ai', 'rule']).toContain(fb.source);
  });

  it('returns class-summary for SS1A Track 1', async () => {
    const rows = await service.classSummary(schoolId, className);
    expect(rows.length).toBeGreaterThan(0);
    const demo = rows.find((r) => r.studentLabel.includes('Demo') || r.practiceSessions > 0);
    expect(demo).toBeTruthy();
    expect(demo?.labUnlocked).toBe(true);
  });

  it('rejects attempts on non-anchor module', async () => {
    const other = await prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_3, number: 4 },
    });
    if (!other) return;
    await expect(
      service.saveAttempt(studentUserId, {
        moduleId: other.id,
        drillKey: 'home_row',
        typed: 'asdf',
        elapsedSec: 10,
      }),
    ).rejects.toThrow(/Invalid typing module|Typing lab unlocks/i);
  });
});
