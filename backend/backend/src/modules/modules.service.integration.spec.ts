/**
 * Integration tests (real PostgreSQL). Does not run by default.
 *
 * Prerequisites: migrated DB + Track 1 modules 1 & 2 (seed or prior upsert).

 * Run:
 *   RUN_INTEGRATION=1 pnpm test:integration
 *
 * Uses DATABASE_URL from the environment (same as the app).
 */

import { PrismaClient, TrackLevel, ExamStatus, ModuleStackVariant, Role } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { ModulesService } from './modules.service';
import { ClassCurriculumService } from '../curriculum/class-curriculum.service';
import { PrismaService } from '../prisma/prisma.service';

const runIntegration = process.env.RUN_INTEGRATION === '1';

(runIntegration ? describe : describe.skip)('ModulesService integration', () => {
  let prisma: PrismaClient;
  let service: ModulesService;

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let schoolId: string;
  let tutorUserId: string;
  let tutorId: string;
  let superAdminUserId: string;
  let module1Id: string;
  let module2Id: string;
  let studentPassId: string;
  let studentFailId: string;
  let cbtExamId: string;
  let practicalTaskId: string;
  const className = `I1${suffix}`;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const m1 = await prisma.module.findFirst({
      where: {
        track: TrackLevel.TRACK_1,
        number: 1,
        stackVariant: ModuleStackVariant.COMMON,
      },
    });
    const m2 = await prisma.module.findFirst({
      where: {
        track: TrackLevel.TRACK_1,
        number: 2,
        stackVariant: ModuleStackVariant.COMMON,
      },
    });
    if (!m1 || !m2) {
      await prisma.$disconnect();
      throw new Error(
        'Track 1 modules 1 & 2 (COMMON) are required. Run `pnpm prisma:seed` against this database first.',
      );
    }
    module1Id = m1.id;
    module2Id = m2.id;

    const pw = await argon2.hash('ItTest@123');

    const school = await prisma.school.create({
      data: {
        name: `Integration School ${suffix}`,
        code: `IT${suffix}`,
        address: 'Test Street',
        state: 'Lagos',
        lga: 'Test LGA',
        principalName: 'Principal Test',
        principalPhone: '+2348000000000',
        status: 'APPROVED',
        enrolledTracks: [TrackLevel.TRACK_1],
      },
    });
    schoolId = school.id;

    const superAdmin = await prisma.user.create({
      data: {
        email: `sa-${suffix}@integration.adhara.edu`,
        password: pw,
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
      },
    });
    superAdminUserId = superAdmin.id;

    const tutorUser = await prisma.user.create({
      data: {
        email: `tutor-${suffix}@integration.adhara.edu`,
        username: `tutor.it.${suffix}`,
        password: pw,
        firstName: 'Tutor',
        lastName: 'Integration',
        role: Role.TUTOR,
      },
    });
    tutorUserId = tutorUser.id;

    const tutor = await prisma.tutor.create({
      data: {
        userId: tutorUser.id,
        tracks: [TrackLevel.TRACK_1],
        isVerified: true,
      },
    });
    tutorId = tutor.id;

    await prisma.tutorAssignment.create({
      data: {
        tutorId: tutor.id,
        schoolId: school.id,
        track: TrackLevel.TRACK_1,
        className,
        termLabel: '2025/2026 Term 2',
        startDate: new Date('2026-01-06'),
        isActive: true,
      },
    });

    cbtExamId = `it-cbt-${suffix}`;
    await prisma.cBTExam.create({
      data: {
        id: cbtExamId,
        tutorId: tutor.id,
        moduleId: module1Id,
        title: `[IT] Module 1 quiz ${suffix}`,
        description: 'integration',
        track: TrackLevel.TRACK_1,
        durationMins: 15,
        totalQuestions: 5,
        passScore: 50,
        isPublished: true,
        isVetted: true,
      },
    });

    practicalTaskId = `it-prac-${suffix}`;
    await prisma.practicalTask.create({
      data: {
        id: practicalTaskId,
        tutorId: tutorUser.id,
        schoolId: school.id,
        className,
        moduleId: module1Id,
        title: `[IT] Lab ${suffix}`,
        description: 'integration',
        maxScore: 100,
        passScore: 50,
        isPublished: true,
      },
    });

    async function createStudent(n: string, name: string) {
      const reg = `IT/${suffix}/JSS2/${n}`;
      const u = await prisma.user.create({
        data: {
          email: `stu-${suffix}-${n}@integration.adhara.edu`,
          username: `stu.it.${suffix}.${n}`,
          password: pw,
          firstName: name,
          lastName: 'Student',
          role: Role.STUDENT,
          schoolId: school.id,
        },
      });
      return prisma.student.create({
        data: {
          userId: u.id,
          schoolId: school.id,
          regNumber: reg,
          className,
          track: TrackLevel.TRACK_1,
          termLabel: '2025/2026 Term 2',
        },
      });
    }

    const sPass = await createStudent('01', 'Pass');
    const sFail = await createStudent('02', 'Fail');
    studentPassId = sPass.id;
    studentFailId = sFail.id;

    for (const st of [sPass, sFail]) {
      await prisma.moduleProgress.create({
        data: {
          studentId: st.id,
          moduleId: module1Id,
          status: 'IN_PROGRESS',
        },
      });
      await prisma.moduleProgress.create({
        data: {
          studentId: st.id,
          moduleId: module2Id,
          status: 'LOCKED',
        },
      });
    }

    await prisma.examAttempt.create({
      data: {
        id: `it-att-pass-${suffix}`,
        cbtExamId,
        studentId: studentPassId,
        answers: { 0: 0 },
        score: 72,
        totalCorrect: 4,
        timeTaken: 400,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });
    await prisma.examAttempt.create({
      data: {
        id: `it-att-fail-${suffix}`,
        cbtExamId,
        studentId: studentFailId,
        answers: { 0: 1 },
        score: 35,
        totalCorrect: 2,
        timeTaken: 500,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });

    await prisma.practicalSubmission.create({
      data: {
        taskId: practicalTaskId,
        studentId: studentPassId,
        attempt: 1,
        evidenceText: 'ok',
        totalScore: 68,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUserId,
      },
    });
    await prisma.practicalSubmission.create({
      data: {
        taskId: practicalTaskId,
        studentId: studentFailId,
        attempt: 1,
        evidenceText: 'ok',
        totalScore: 60,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUserId,
      },
    });

    const mockCurriculum: Pick<ClassCurriculumService, 'getState'> = {
      getState: async () => null,
    };
    const mockAudit = { log: async () => undefined } as any;
    service = new ModulesService(
      prisma as unknown as PrismaService,
      mockCurriculum as ClassCurriculumService,
      mockAudit,
    );
  }, 120000);

  afterAll(async () => {
    if (!runIntegration || !prisma) return;
    try {
      const examIds = [`it-att-pass-${suffix}`, `it-att-fail-${suffix}`, `it-att-fail-retake-${suffix}`];
      await prisma.examAttempt.deleteMany({ where: { id: { in: examIds } } });
      await prisma.practicalSubmission.deleteMany({
        where: { taskId: practicalTaskId },
      });
      await prisma.moduleProgress.deleteMany({
        where: { studentId: { in: [studentPassId, studentFailId] } },
      });
      await prisma.cBTExam.deleteMany({ where: { id: cbtExamId } });
      await prisma.practicalTask.deleteMany({ where: { id: practicalTaskId } });
      await prisma.tutorAssignment.deleteMany({ where: { schoolId, className } });
      const studentRows = await prisma.student.findMany({
        where: { schoolId, className },
        select: { userId: true },
      });
      const studentUserIds = studentRows.map((r) => r.userId);
      await prisma.student.deleteMany({ where: { schoolId, className } });
      await prisma.tutor.deleteMany({ where: { id: tutorId } });
      await prisma.user.deleteMany({
        where: { id: { in: [...studentUserIds, tutorUserId, superAdminUserId] } },
      });
      await prisma.school.delete({ where: { id: schoolId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('getModuleRetakeStatus reflects CBT + practical gates', async () => {
    const pass = await service.getModuleRetakeStatus(studentPassId, module1Id, 50);
    expect(pass.ready).toBe(true);
    expect(pass.cbt.passed).toBe(true);
    expect(pass.practical.passed).toBe(true);

    const fail = await service.getModuleRetakeStatus(studentFailId, module1Id, 50);
    expect(fail.ready).toBe(false);
    expect(fail.cbt.passed).toBe(false);
    expect(fail.practical.passed).toBe(true);
  });

  it('advanceClassModule marks COMPLETED vs FAILED from best CBT + practical', async () => {
    const res = await service.advanceClassModule(schoolId, className, module1Id, 50);
    expect(res.advanced).toBe(true);
    expect(res).toMatchObject({ advanced: true });
    if ('nextModule' in res && res.nextModule) {
      expect(res.nextModule.id).toBe(module2Id);
    } else {
      throw new Error('expected nextModule on advance result');
    }

    const p1 = await prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId: studentPassId, moduleId: module1Id } },
    });
    const p2 = await prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId: studentFailId, moduleId: module1Id } },
    });
    expect(p1?.status).toBe('COMPLETED');
    expect(p2?.status).toBe('FAILED');

    const n1 = await prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId: studentPassId, moduleId: module2Id } },
    });
    const n2 = await prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId: studentFailId, moduleId: module2Id } },
    });
    expect(n1?.status).toBe('IN_PROGRESS');
    expect(n2?.status).toBe('IN_PROGRESS');
  });

  it('applyModuleRetake clears FAILED when both assessments pass (super admin)', async () => {
    await prisma.examAttempt.create({
      data: {
        id: `it-att-fail-retake-${suffix}`,
        cbtExamId,
        studentId: studentFailId,
        answers: { 0: 0 },
        score: 78,
        totalCorrect: 4,
        timeTaken: 420,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });

    const before = await service.getModuleRetakeStatus(studentFailId, module1Id, 50);
    expect(before.ready).toBe(true);

    const out = await service.applyModuleRetake(superAdminUserId, studentFailId, module1Id, 50);
    expect(out.applied).toBe(true);
    const mp = await prisma.moduleProgress.findUnique({
      where: { studentId_moduleId: { studentId: studentFailId, moduleId: module1Id } },
    });
    expect(mp?.status).toBe('COMPLETED');
  });
});
