/**
 * Scenario: 20 students · Track 3 Module 1 (STANDARD) · Crown Heights demo school
 *
 * Creates class SS3B + tutor assignment, 20 users/students, module progress (all on module 1),
 *graded curriculum + class homework submissions, CBT attempts + practical submissions.
 *
 * Four students are intentionally below the 50% rule on one or both axes so after you click
 * "Advance Class Module" in the tutor dashboard they become FAILED (others COMPLETED).
 *
 * Prerequisites: `pnpm prisma migrate deploy` and full `pnpm prisma:seed` (or at least modules + school + tutor).
 *
 * Run from backend folder:
 *   pnpm exec ts-node scripts/scenario-module-retake-advance.ts
 *
 * Login (all scenario students share one password):
 *   Password: ScenarioSS3B@2026
 *   Username pattern: chr.ss3b.01 … chr.ss3b.20 (zero-padded)
 *   Registration: CHR/2024/SS3B/001 … CHR/2024/SS3B/020
 *
 * Tutor: tutor@adharaedu.com / Tutor@123 — pick class SS3B in the dashboard.
 */

import {
  PrismaClient,
  TrackLevel,
  AssignmentStatus,
  ExamStatus,
  Track3Stack,
  Prisma,
} from '@prisma/client';
import * as argon2 from '@node-rs/argon2';

const prisma = new PrismaClient();

const SCHOOL_CODE = 'CHR';
const CLASS_NAME = 'SS3B';
const STUDENT_COUNT = 20;
const SHARED_PASSWORD = 'ScenarioSS3B@2026';

/** Same composite key style as seed (Phase D). */
const ModuleStackVariant = {
  COMMON: 'COMMON' as const,
  PYTHON_FLASK: 'PYTHON_FLASK' as const,
};

function utcDate(y: number, month: number, day: number) {
  return new Date(Date.UTC(y, month - 1, day, 12, 0, 0, 0));
}

type Profile = { cbt: number; prac: number; assignment: number; classHw: number; label: string };

function buildProfiles(): Profile[] {
  const fails: Profile[] = [
    { cbt: 42, prac: 72, assignment: 80, classHw: 82, label: 'fail CBT only' },
    { cbt: 78, prac: 38, assignment: 75, classHw: 70, label: 'fail practical only' },
    { cbt: 35, prac: 40, assignment: 55, classHw: 50, label: 'fail both' },
    { cbt: 48, prac: 88, assignment: 90, classHw: 85, label: 'fail CBT (borderline)' },
  ];
  const pass: Profile[] = Array.from({ length: STUDENT_COUNT - fails.length }, (_, i) => ({
    cbt: 62 + (i % 25),
    prac: 60 + (i % 28),
    assignment: 70 + (i % 20),
    classHw: 68 + (i % 22),
    label: 'pass',
  }));
  return [...fails, ...pass];
}

async function main() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) {
    throw new Error(`School ${SCHOOL_CODE} not found — run prisma seed first.`);
  }

  const tutorUser = await prisma.user.findUnique({
    where: { email: 'tutor@adharaedu.com' },
    select: { id: true },
  });
  if (!tutorUser) {
    throw new Error('Demo tutor tutor@adharaedu.com not found — run prisma seed first.');
  }

  const tutor = await prisma.tutor.findUnique({
    where: { userId: tutorUser.id },
    select: { id: true },
  });
  if (!tutor) {
    throw new Error('Tutor profile missing.');
  }

  const track3Mods = await prisma.module.findMany({
    where: {
      track: TrackLevel.TRACK_3,
      OR: [{ stackVariant: ModuleStackVariant.COMMON }, { stackVariant: ModuleStackVariant.PYTHON_FLASK }],
    } as unknown as Prisma.ModuleWhereInput,
    orderBy: [{ number: 'asc' }, { stackVariant: 'asc' }] as Prisma.ModuleOrderByWithRelationInput[],
  });

  const modT3First = track3Mods[0];
  if (!modT3First) {
    throw new Error('No Track 3 modules — run prisma seed first.');
  }

  const scenarioPw = await argon2.hash(SHARED_PASSWORD);

  await prisma.tutorAssignment.upsert({
    where: { id: 'scenario-tutor-ss3b' },
    update: {
      termLabel: '2025/2026 Term 2',
      isActive: true,
      track: TrackLevel.TRACK_3,
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'scenario-tutor-ss3b',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_3,
      className: CLASS_NAME,
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.TutorAssignmentCreateInput,
  });

  const cbtExamId = 'seed-cbt-track3-module1';
  await prisma.cBTExam.upsert({
    where: { id: cbtExamId },
    update: {},
    create: {
      id: cbtExamId,
      tutorId: tutor.id,
      moduleId: modT3First.id,
      title: '[SEED] Module 1 quick check',
      description: 'Seeded CBT for class performance demo.',
      track: TrackLevel.TRACK_3,
      durationMins: 20,
      totalQuestions: 5,
      passScore: 50,
      isPublished: true,
      isVetted: true,
    },
  });

  const futureCbtSlot = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.examSchedule.upsert({
    where: { id: 'scenario-exam-schedule-ss3b-cbt' },
    update: {
      scheduledAt: futureCbtSlot,
      durationMins: 20,
      status: ExamStatus.SCHEDULED,
      isActive: true,
      maxAttempts: 3,
      accessCode: 'SS3B',
    },
    create: {
      id: 'scenario-exam-schedule-ss3b-cbt',
      cbtExamId,
      schoolId: school.id,
      className: CLASS_NAME,
      scheduledAt: futureCbtSlot,
      venue: 'Computer Lab (scenario SS3B)',
      durationMins: 20,
      status: ExamStatus.SCHEDULED,
      createdBy: tutorUser.id,
      accessCode: 'SS3B',
      maxAttempts: 3,
    },
  });

  const curriculumAssignId = 'seed-curriculum-assign-track3-m1';
  await prisma.assignment.upsert({
    where: { id: curriculumAssignId },
    update: {},
    create: {
      id: curriculumAssignId,
      moduleId: modT3First.id,
      title: '[SEED] Track 3 Module 1 — reflection',
      description: 'Short write-up for class performance demo.',
      dueDate: utcDate(2026, 3, 25),
    },
  });

  const classHwId = 'scenario-class-hw-ss3b-track3-m1';
  await prisma.classAssignment.upsert({
    where: { id: classHwId },
    update: { isPublished: true },
    create: {
      id: classHwId,
      tutorId: tutorUser.id,
      schoolId: school.id,
      className: CLASS_NAME,
      moduleId: modT3First.id,
      title: '[Scenario SS3B] Homework: layout sketch',
      description: 'Scenario homework for module retake / advance testing.',
      dueDate: utcDate(2026, 3, 22),
      maxScore: 100,
      isPublished: true,
    },
  });

  const practicalTaskId = 'scenario-practical-ss3b-m1';
  await prisma.practicalTask.upsert({
    where: { id: practicalTaskId },
    update: { isPublished: true },
    create: {
      id: practicalTaskId,
      tutorId: tutorUser.id,
      schoolId: school.id,
      className: CLASS_NAME,
      moduleId: modT3First.id,
      title: '[Scenario SS3B] Lab: simple webpage',
      description: 'Hands-on task for advance / retake scenario.',
      maxScore: 100,
      passScore: 50,
      isPublished: true,
    },
  });

  const profiles = buildProfiles();
  const created: Array<{
    idx: number;
    reg: string;
    username: string;
    label: string;
    cbt: number;
    prac: number;
  }> = [];

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const n = i + 1;
    const regNumber = `CHR/2024/${CLASS_NAME}/${String(n).padStart(3, '0')}`;
    const username = `chr.ss3b.${String(n).padStart(2, '0')}`;
    const email = `ss3b-scen-${String(n).padStart(2, '0')}@crownheights.edu.ng`;
    const p = profiles[i];

    const user = await prisma.user.upsert({
      where: { username },
      update: {
        password: scenarioPw,
        firstName: 'Scenario',
        lastName: `Student${n}`,
        role: 'STUDENT',
        schoolId: school.id,
        mustChangePassword: false,
      },
      create: {
        email,
        username,
        password: scenarioPw,
        firstName: 'Scenario',
        lastName: `Student${n}`,
        role: 'STUDENT',
        schoolId: school.id,
        mustChangePassword: false,
      },
    });

    const stu = await prisma.student.upsert({
      where: { regNumber },
      update: {
        className: CLASS_NAME,
        termLabel: '2025/2026 Term 2',
        track: TrackLevel.TRACK_3,
        track3Stack: Track3Stack.PYTHON_FLASK,
      } as Prisma.StudentUpdateInput,
      create: {
        userId: user.id,
        schoolId: school.id,
        regNumber,
        className: CLASS_NAME,
        track: TrackLevel.TRACK_3,
        termLabel: '2025/2026 Term 2',
        track3Stack: Track3Stack.PYTHON_FLASK,
      } as unknown as Prisma.StudentCreateInput,
    });

    for (let mi = 0; mi < track3Mods.length; mi++) {
      const mod = track3Mods[mi];
      const row =
        mi === 0
          ? { score: null as number | null, status: 'IN_PROGRESS' as const }
          : { score: null as number | null, status: 'LOCKED' as const };
      await prisma.moduleProgress.upsert({
        where: { studentId_moduleId: { studentId: stu.id, moduleId: mod.id } },
        update: {
          status: row.status,
          score: row.score ?? undefined,
          completedAt: null,
        },
        create: {
          studentId: stu.id,
          moduleId: mod.id,
          status: row.status,
          score: row.score,
          completedAt: null,
        },
      });
    }

    await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: curriculumAssignId, studentId: stu.id } },
      update: {
        grade: p.assignment,
        status: AssignmentStatus.GRADED,
        gradedAt: new Date(),
      },
      create: {
        assignmentId: curriculumAssignId,
        studentId: stu.id,
        status: AssignmentStatus.GRADED,
        grade: p.assignment,
        notes: 'scenario-module-retake-advance',
        gradedAt: new Date(),
      },
    });

    await prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: classHwId, studentId: stu.id } },
      update: {
        score: p.classHw,
        status: 'GRADED',
        gradedAt: new Date(),
      },
      create: {
        assignmentId: classHwId,
        studentId: stu.id,
        score: p.classHw,
        status: 'GRADED',
        textBody: 'scenario class homework',
        gradedAt: new Date(),
      },
    });

    const attemptId = `scenario-m1-ss3b-cbt-${String(n).padStart(2, '0')}`;
    await prisma.examAttempt.upsert({
      where: { id: attemptId },
      update: {
        score: p.cbt,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
        totalCorrect: Math.max(0, Math.round((p.cbt / 100) * 5)),
      },
      create: {
        id: attemptId,
        cbtExamId,
        studentId: stu.id,
        answers: { 0: 0, 1: 1 } as object,
        score: p.cbt,
        totalCorrect: Math.max(0, Math.round((p.cbt / 100) * 5)),
        timeTaken: 500,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });

    await prisma.practicalSubmission.upsert({
      where: {
        taskId_studentId_attempt: { taskId: practicalTaskId, studentId: stu.id, attempt: 1 },
      },
      update: {
        totalScore: p.prac,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
      create: {
        taskId: practicalTaskId,
        studentId: stu.id,
        attempt: 1,
        evidenceText: 'scenario practical evidence',
        totalScore: p.prac,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
    });

    created.push({
      idx: n,
      reg: regNumber,
      username,
      label: p.label,
      cbt: p.cbt,
      prac: p.prac,
    });
  }

  console.log('\n✅ Scenario ready: class', CLASS_NAME, '—', STUDENT_COUNT, 'students');
  console.log('   Tutor dashboard: pick school Crown Heights → class', CLASS_NAME);
  console.log('   Tutor login: tutor@adharaedu.com / Tutor@123');
  console.log('   Student password (all):', SHARED_PASSWORD);
  console.log('\n   Expected after "Advance Class Module" on module', modT3First.number, `(${modT3First.title}):`);
  for (const row of created) {
    const cbtOk = row.cbt >= 50;
    const prOk = row.prac >= 50;
    const will = cbtOk && prOk ? 'COMPLETED' : 'FAILED';
    console.log(
      `   #${String(row.idx).padStart(2, '0')} ${row.username}  CBT ${row.cbt}%  Prac ${row.prac}%  → ${will}  (${row.label})`,
    );
  }

  console.log(
    '\n   Retake: for FAILED rows, raise CBT and/or practical (new attempt / submission), then tutor "Clear failed module".',
  );
  console.log('   CBT schedule for this class uses access code SS3B (max 3 attempts).\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
