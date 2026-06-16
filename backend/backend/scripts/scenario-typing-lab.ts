/**
 * Optional smoke test for Typing Lab API (data is also created by `pnpm prisma:seed`).
 *
 * Run after seed when you want to verify endpoints without a full re-seed:
 *   pnpm scenario:typing-lab
 *
 * Test logins (reg number + password):
 *   CHR/2026/SS1A/901 / student@901  — on Module 2 (typing unlocked)
 *   CHR/2026/SS1A/902 / student@902  — on Module 2
 *   CHR/2026/SS1A/903 / student@903  — Module 3 in progress (lab still open)
 *
 * Tutor: tutor@adharaedu.com / Tutor@123 — class SS1A → Mark Results (Typing column)
 */

import {
  PrismaClient,
  TrackLevel,
  ModuleType,
  ModuleStackVariant,
  Prisma,
} from '@prisma/client';
import * as argon2 from '@node-rs/argon2';

const prisma = new PrismaClient();

const SCHOOL_CODE = 'CHR';
const CLASS_NAME = 'SS1A';
const API_BASE = (process.env.API_URL || 'http://localhost:3002/api/v1').replace(/\/$/, '');

type ProgressRow = { score: number | null; status: string };

function studentPassword(regNumber: string) {
  const suffix = regNumber.split('/').pop() || '000';
  return `student@${suffix}`;
}

async function upsertStudentModuleProgress(
  studentId: string,
  modules: { id: string }[],
  rows: ProgressRow[],
) {
  for (let i = 0; i < modules.length; i++) {
    const row = rows[i] || { score: null, status: 'LOCKED' };
    const completedAt = row.status === 'COMPLETED' ? new Date() : null;
    await prisma.moduleProgress.upsert({
      where: { studentId_moduleId: { studentId, moduleId: modules[i].id } },
      update: { status: row.status as any, score: row.score, completedAt },
      create: {
        studentId,
        moduleId: modules[i].id,
        status: row.status as any,
        score: row.score,
        completedAt,
      },
    });
  }
}

async function upsertScenarioStudent(opts: {
  email: string;
  username: string;
  regNumber: string;
  firstName: string;
  lastName: string;
  schoolId: string;
}) {
  const passwordHash = await argon2.hash(studentPassword(opts.regNumber));
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      password: passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      role: 'STUDENT',
      schoolId: opts.schoolId,
      username: opts.username,
      mustChangePassword: false,
    },
    create: {
      email: opts.email,
      username: opts.username,
      password: passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      role: 'STUDENT',
      schoolId: opts.schoolId,
      mustChangePassword: false,
    },
  });
  const student = await prisma.student.upsert({
    where: { regNumber: opts.regNumber },
    update: {
      className: CLASS_NAME,
      track: TrackLevel.TRACK_1,
      termLabel: '2025/2026 Term 2',
    },
    create: {
      userId: user.id,
      schoolId: opts.schoolId,
      regNumber: opts.regNumber,
      className: CLASS_NAME,
      track: TrackLevel.TRACK_1,
      termLabel: '2025/2026 Term 2',
    },
  });
  return { user, student };
}

async function apiLogin(login: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Login failed (${res.status})`);
  return data.token as string;
}

async function apiGet(token: string, path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function runSmokeTest(module2Id: string, schoolId: string) {
  console.log('\n── API smoke test ──');
  const reg901 = 'CHR/2026/SS1A/901';
  const reg903 = 'CHR/2026/SS1A/903';
  const studentTok = await apiLogin(reg901, studentPassword(reg901));

  const access = await apiGet(studentTok, '/typing/access');
  if (!access.ok || !access.data?.unlocked || access.data?.moduleId !== module2Id) {
    throw new Error('GET /typing/access — lab should be unlocked on Module 2');
  }
  console.log('✓ GET /typing/access — unlocked for', reg901);

  const drills = await apiGet(studentTok, '/typing/drills');
  if (!drills.ok || !Array.isArray(drills.data?.drills) || drills.data.drills.length < 4) {
    throw new Error('GET /typing/drills failed');
  }
  console.log('✓ GET /typing/drills —', drills.data.drills.length, 'drills');

  const homeRow = drills.data.drills.find((d: { key: string }) => d.key === 'home_row');
  const typed = String(homeRow?.text || 'asdf jkl; ').slice(0, 100);
  const practiceRes = await fetch(`${API_BASE}/typing/attempts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentTok}`,
    },
    body: JSON.stringify({
      moduleId: module2Id,
      drillKey: 'home_row',
      typed,
      elapsedSec: 60,
    }),
  });
  const practiceData = await practiceRes.json().catch(() => ({}));
  if (!practiceRes.ok) {
    throw new Error(`POST practice attempt failed: ${practiceData.message || practiceRes.status}`);
  }
  console.log('✓ POST /typing/attempts (practice) —', practiceData.wpm, 'WPM');

  const advancedTok = await apiLogin(reg903, studentPassword(reg903));
  const advancedAccess = await apiGet(advancedTok, '/typing/access');
  if (!advancedAccess.ok || !advancedAccess.data?.unlocked) {
    throw new Error('Module 3 student should still have typing lab unlocked');
  }
  console.log('✓ GET /typing/access — still unlocked on Module 3 for', reg903);

  const tutorTok = await apiLogin('tutor@adharaedu.com', 'Tutor@123');
  const classSum = await apiGet(
    tutorTok,
    `/typing/class-summary?schoolId=${encodeURIComponent(schoolId)}&className=${encodeURIComponent(CLASS_NAME)}`,
  );
  if (!classSum.ok || !Array.isArray(classSum.data)) {
    throw new Error('GET /typing/class-summary failed');
  }
  const unlocked = classSum.data.filter((r: { labUnlocked: boolean }) => r.labUnlocked);
  if (unlocked.length < 2) {
    throw new Error('Expected multiple unlocked Track 1 students in class summary');
  }
  console.log('✓ GET /typing/class-summary —', unlocked.length, 'students with lab unlocked');

  console.log('\n✅ Typing lab smoke test passed\n');
}

async function main() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) throw new Error(`School ${SCHOOL_CODE} not found — run prisma seed first.`);

  const tutorUser = await prisma.user.findUnique({
    where: { email: 'tutor@adharaedu.com' },
    select: { id: true },
  });
  if (!tutorUser) throw new Error('Demo tutor not found — run prisma seed first.');

  const tutor = await prisma.tutor.findUnique({
    where: { userId: tutorUser.id },
    select: { id: true },
  });
  if (!tutor) throw new Error('Tutor profile missing.');

  const track1Mods = await prisma.module.findMany({
    where: {
      track: TrackLevel.TRACK_1,
      moduleType: ModuleType.STANDARD,
      stackVariant: ModuleStackVariant.COMMON,
    },
    orderBy: { number: 'asc' },
  });
  const mod2 = track1Mods.find((m) => m.number === 2);
  if (!mod2) {
    throw new Error('Track 1 module 2 not found — run prisma seed first.');
  }

  const lesson2 = await prisma.curriculumLesson.findFirst({
    where: { moduleId: mod2.id, isPublished: true },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await prisma.tutorAssignment.upsert({
    where: { id: 'scenario-tutor-ss1a-typing' },
    update: {
      termLabel: '2025/2026 Term 2',
      isActive: true,
      track: TrackLevel.TRACK_1,
    } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'scenario-tutor-ss1a-typing',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_1,
      className: CLASS_NAME,
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
    } as unknown as Prisma.TutorAssignmentCreateInput,
  });

  if (lesson2) {
    await prisma.classCurriculumState.upsert({
      where: {
        schoolId_className_curriculumBranchKey: {
          schoolId: school.id,
          className: CLASS_NAME,
          curriculumBranchKey: TrackLevel.TRACK_1,
        },
      },
      update: {
        currentLessonId: lesson2.id,
        lastDeliveredLessonId: lesson2.id,
      },
      create: {
        schoolId: school.id,
        className: CLASS_NAME,
        curriculumBranchKey: TrackLevel.TRACK_1,
        currentLessonId: lesson2.id,
        lastDeliveredLessonId: lesson2.id,
      },
    });
  }

  const progressOnModule2: ProgressRow[] = track1Mods.map((m) => {
    if (m.number === 1) return { score: 78, status: 'COMPLETED' };
    if (m.number === 2) return { score: null, status: 'IN_PROGRESS' };
    return { score: null, status: 'LOCKED' };
  });

  const progressOnModule3: ProgressRow[] = track1Mods.map((m) => {
    if (m.number === 1) return { score: 80, status: 'COMPLETED' };
    if (m.number === 2) return { score: 72, status: 'COMPLETED' };
    if (m.number === 3) return { score: null, status: 'IN_PROGRESS' };
    return { score: null, status: 'LOCKED' };
  });

  const s1 = await upsertScenarioStudent({
    email: 'typing.demo@crownheights.edu.ng',
    username: 'chr.typing',
    regNumber: 'CHR/2026/SS1A/901',
    firstName: 'Demo',
    lastName: 'Typist',
    schoolId: school.id,
  });
  const s2 = await upsertScenarioStudent({
    email: 'typing2.demo@crownheights.edu.ng',
    username: 'chr.typing2',
    regNumber: 'CHR/2026/SS1A/902',
    firstName: 'Ada',
    lastName: 'Keys',
    schoolId: school.id,
  });
  const s3 = await upsertScenarioStudent({
    email: 'typing3.demo@crownheights.edu.ng',
    username: 'chr.typing3',
    regNumber: 'CHR/2026/SS1A/903',
    firstName: 'Samuel',
    lastName: 'Ali',
    schoolId: school.id,
  });

  await upsertStudentModuleProgress(s1.student.id, track1Mods, progressOnModule2);
  await upsertStudentModuleProgress(s2.student.id, track1Mods, progressOnModule2);
  await upsertStudentModuleProgress(s3.student.id, track1Mods, progressOnModule3);

  console.log('✅ Typing lab scenario ready — Crown Heights', CLASS_NAME, '(Track 1)');
  console.log('   Anchor module:', mod2.number, mod2.title);
  console.log('   Students (reg no / password):');
  console.log('     CHR/2026/SS1A/901 /', studentPassword('CHR/2026/SS1A/901'), '— Module 2 in progress');
  console.log('     CHR/2026/SS1A/902 /', studentPassword('CHR/2026/SS1A/902'), '— Module 2 in progress');
  console.log('     CHR/2026/SS1A/903 /', studentPassword('CHR/2026/SS1A/903'), '— Module 3 (lab still open)');
  console.log('   Tutor: tutor@adharaedu.com / Tutor@123 → class', CLASS_NAME);

  try {
    await runSmokeTest(mod2.id, school.id);
  } catch (e: any) {
    console.error('⚠️  Smoke test skipped or failed:', e.message);
    console.error('   Ensure the API is running: pnpm start:dev (port 3002)\n');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
