import {
  PrismaClient,
  Prisma,
  TrackLevel,
  AttendanceStatus,
  AssignmentStatus,
  ExamStatus,
  TutorIdentificationType,
} from '@prisma/client';
import * as argon2 from '@node-rs/argon2';

const prisma = new PrismaClient();

/** Stored in School.notes — parsed by school-classes API for admin/tutor class pickers. */
const DEMO_CLASS_REGISTRY_JSON = JSON.stringify([{ className: 'SS3A', track: TrackLevel.TRACK_3 }]);
const DEMO_SCHOOL_NOTES = `Demo registry for Class performance (Phase D) + school-classes list.\n[[ADHARA_CLASSES_JSON]]${DEMO_CLASS_REGISTRY_JSON}`;

function utcDate(y: number, month: number, day: number) {
  return new Date(Date.UTC(y, month - 1, day, 12, 0, 0, 0));
}

/** Recent weekdays (for attendance inside default 30-day class-performance window). */
function recentAttendanceWeekdays(count: number, maxScanDays = 45): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  for (let back = 0; out.length < count && back < maxScanDays; back++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0)));
  }
  return out;
}

async function main() {
  console.log('🌱 Seeding AdharaEdu database...');

  // Super Admin
  const superAdminPassword = await argon2.hash(process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123');
  const superAdmin = await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL || 'admin@adharaedu.com' },
    update: {
      password: superAdminPassword,
      firstName: 'Adhara',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
    create: {
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@adharaedu.com',
      password: superAdminPassword,
      firstName: 'Adhara',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Super admin created:', superAdmin.email);

  // Default Modules — Track 1
  const track1Modules = [
    { number: 1, title: 'Computer Hardware Basics', description: 'Computer parts, mouse, keyboard basics', objectives: ['Identify hardware components', 'Basic typing skills', 'Computer safety'] },
    { number: 2, title: 'Operating Systems', description: 'Windows OS, files & folders, desktop navigation', objectives: ['Navigate Windows OS', 'Manage files and folders', 'Desktop shortcuts'] },
    { number: 3, title: 'Internet & Productivity Tools', description: 'Internet safety, email etiquette, Google tools', objectives: ['Safe internet browsing', 'Email basics', 'Google Docs/Sheets intro'] },
    { number: 4, title: 'Microsoft Office', description: 'Word, Excel, PowerPoint for schoolwork', objectives: ['Create documents in Word', 'Basic spreadsheets in Excel', 'Build presentations'] },
    { number: 5, title: 'Digital Business Skills', description: 'Digital literacy, online safety, basic networking', objectives: ['Understand digital economy', 'Online safety practices', 'Basic networking concepts'] },
  ];

  for (const m of track1Modules) {
    await prisma.module.upsert({
      where: { track_number: { track: TrackLevel.TRACK_1, number: m.number } },
      update: {},
      create: { ...m, track: TrackLevel.TRACK_1 },
    });
  }

  // Track 2 Modules
  const track2Modules = [
    { number: 1, title: 'Scratch Programming', description: 'Events, loops, conditionals, mini-games', objectives: ['Build games in Scratch', 'Understand event-driven programming'] },
    { number: 2, title: 'HTML Fundamentals', description: 'Building real webpages with HTML', objectives: ['Structure webpages', 'Use semantic HTML tags'] },
    { number: 3, title: 'CSS Styling', description: 'Colors, fonts, layouts with CSS', objectives: ['Style HTML elements', 'Create layouts with Flexbox'] },
    { number: 4, title: 'JavaScript Basics', description: 'Variables, functions, DOM manipulation', objectives: ['Write JavaScript code', 'Make pages interactive'] },
    { number: 5, title: 'Portfolio Project', description: 'Build and deploy a personal portfolio page', objectives: ['Combine HTML, CSS, JS', 'Deploy a live website'] },
  ];

  for (const m of track2Modules) {
    await prisma.module.upsert({
      where: { track_number: { track: TrackLevel.TRACK_2, number: m.number } },
      update: {},
      create: { ...m, track: TrackLevel.TRACK_2 },
    });
  }

  // Track 3 Modules
  const track3Modules = [
    { number: 1, title: 'Frontend Development', description: 'HTML + CSS + JS combined projects', objectives: ['Build full frontend projects', 'Responsive layouts'] },
    { number: 2, title: 'Responsive Design', description: 'Mobile-first development with CSS Grid & Flexbox', objectives: ['Media queries', 'CSS Grid mastery'] },
    { number: 3, title: 'Python Basics', description: 'Variables, loops, functions, logic', objectives: ['Write Python scripts', 'Solve problems with code'] },
    { number: 4, title: 'Backend Basics', description: 'How websites work, databases, APIs', objectives: ['Understand server-client model', 'Basic database concepts'] },
    { number: 5, title: 'Freelancing & Entrepreneurship', description: 'Fiverr, portfolio, getting clients', objectives: ['Set up freelancing profile', 'Price services correctly'] },
    { number: 6, title: 'Capstone Project', description: 'Build and present a working web application', objectives: ['Complete a full project', 'Present to judges'] },
  ];

  for (const m of track3Modules) {
    await prisma.module.upsert({
      where: { track_number: { track: TrackLevel.TRACK_3, number: m.number } },
      update: {},
      create: { ...m, track: TrackLevel.TRACK_3 },
    });
  }

  console.log('✅ All modules seeded (18 total across 3 tracks)');

  // Demo school
  const schoolAdminPw = await argon2.hash('SchoolAdmin@123');
  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'admin@crownheights.edu.ng' },
    update: {
      password: schoolAdminPw,
      firstName: 'Crown',
      lastName: 'Heights Admin',
      role: 'SCHOOL_ADMIN',
    },
    create: {
      email: 'admin@crownheights.edu.ng',
      password: schoolAdminPw,
      firstName: 'Crown',
      lastName: 'Heights Admin',
      role: 'SCHOOL_ADMIN',
    },
  });

  /** Typed via assertion so seed compiles even if the IDE uses a stale generated client — run `pnpm prisma generate` after schema changes. */
  const crownDemoSchoolUpdate = {
    notes: DEMO_SCHOOL_NOTES,
    enrolledTracks: [TrackLevel.TRACK_1, TrackLevel.TRACK_2, TrackLevel.TRACK_3],
    officialName: 'Crown Heights Secondary School',
    schoolType: 'SECONDARY' as const,
    officialEmail: 'admin@crownheights.edu.ng',
    officialPhone: '+234 802 345 6780',
    platformLevels: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'],
    currentTermLabel: 'Second Term',
    academicYearLabel: '2025/2026',
    studentCountBand: '100 – 300',
    profileCompletedAt: new Date(),
  } as unknown as Prisma.SchoolUpdateInput;

  const crownDemoSchoolCreate = {
    name: 'Crown Heights Secondary School',
    officialName: 'Crown Heights Secondary School',
    schoolType: 'SECONDARY' as const,
    code: 'CHR',
    address: '12 Education Boulevard, Victoria Island',
    state: 'Lagos',
    lga: 'Victoria Island',
    principalName: 'Mr. Adebayo Okafor',
    principalPhone: '+234 802 345 6789',
    officialEmail: 'admin@crownheights.edu.ng',
    officialPhone: '+234 802 345 6780',
    platformLevels: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'],
    currentTermLabel: 'Second Term',
    academicYearLabel: '2025/2026',
    studentCountBand: '100 – 300',
    status: 'APPROVED' as const,
    enrolledTracks: [TrackLevel.TRACK_1, TrackLevel.TRACK_2, TrackLevel.TRACK_3],
    feesPerStudent: 8000,
    notes: DEMO_SCHOOL_NOTES,
    profileCompletedAt: new Date(),
    admins: { connect: { id: schoolAdmin.id } },
  } as unknown as Prisma.SchoolCreateInput;

  const school = await prisma.school.upsert({
    where: { code: 'CHR' },
    update: crownDemoSchoolUpdate,
    create: crownDemoSchoolCreate,
  });
  console.log('✅ Demo school created:', school.name);

  // Demo tutor
  const tutorPw = await argon2.hash('Tutor@123');
  const tutorUser = await prisma.user.upsert({
    where: { email: 'tutor@adharaedu.com' },
    update: {
      password: tutorPw,
      firstName: 'Emeka',
      lastName: 'Nwosu',
      role: 'TUTOR',
      phone: '+234 803 123 4567',
    },
    create: {
      email: 'tutor@adharaedu.com',
      password: tutorPw,
      firstName: 'Emeka',
      lastName: 'Nwosu',
      role: 'TUTOR',
      phone: '+234 803 123 4567',
    },
  });
  const tutor = await prisma.tutor.upsert({
    where: { userId: tutorUser.id },
    update: {
      onboardingStatus: 'COMPLETE',
      passportPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-passport.jpg',
      identificationType: TutorIdentificationType.NIN,
      identificationNumber: '12345678901',
      identificationDocumentUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-id.pdf',
      signatureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-signature.png',
      bankName: 'GTBank',
      bankAccount: '0123456789',
      guarantors: [
        {
          fullName: 'Ngozi Nwosu',
          phone: '+234 803 000 0001',
          email: 'ngozi.demo@example.com',
          address: 'Lagos, Nigeria',
          relationship: 'Spouse',
        },
      ] as any,
    },
    create: {
      userId: tutorUser.id,
      bio: 'Frontend developer with 5 years experience. Passionate about teaching young Nigerians to code.',
      specializations: ['HTML/CSS', 'JavaScript', 'Python', 'React'],
      tracks: [TrackLevel.TRACK_2, TrackLevel.TRACK_3],
      isVerified: true,
      rating: 4.8,
      onboardingStatus: 'COMPLETE',
      passportPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-passport.jpg',
      identificationType: TutorIdentificationType.NIN,
      identificationNumber: '12345678901',
      identificationDocumentUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-id.pdf',
      signatureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/seed/tutor-signature.png',
      bankName: 'GTBank',
      bankAccount: '0123456789',
      guarantors: [
        {
          fullName: 'Ngozi Nwosu',
          phone: '+234 803 000 0001',
          email: 'ngozi.demo@example.com',
          address: 'Lagos, Nigeria',
          relationship: 'Spouse',
        },
      ] as any,
    },
  });

  await prisma.tutorAssignment.upsert({
    where: { id: 'demo-assignment-1' },
    update: {},
    create: {
      id: 'demo-assignment-1',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_3,
      className: 'SS3A',
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
    },
  });
  console.log('✅ Demo tutor created and assigned');

  // Demo student
  const studentPw = await argon2.hash('Student@123');
  const studentUser = await prisma.user.upsert({
    where: { email: 'aisha@crownheights.edu.ng' },
    update: {
      password: studentPw,
      firstName: 'Aisha',
      lastName: 'Okonkwo',
      role: 'STUDENT',
      schoolId: school.id,
    },
    create: {
      email: 'aisha@crownheights.edu.ng',
      password: studentPw,
      firstName: 'Aisha',
      lastName: 'Okonkwo',
      role: 'STUDENT',
      schoolId: school.id,
    },
  });
  const student = await prisma.student.upsert({
    where: { regNumber: 'CHR/2024/SS3A/021' },
    update: {},
    create: {
      userId: studentUser.id,
      schoolId: school.id,
      regNumber: 'CHR/2024/SS3A/021',
      className: 'SS3A',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 2',
    },
  });

  // Second student — same class/track so class-performance roll-up has real averages
  const student2Pw = await argon2.hash('Student@123');
  const student2User = await prisma.user.upsert({
    where: { email: 'tunde@crownheights.edu.ng' },
    update: {
      password: student2Pw,
      firstName: 'Tunde',
      lastName: 'Balogun',
      role: 'STUDENT',
      schoolId: school.id,
    },
    create: {
      email: 'tunde@crownheights.edu.ng',
      password: student2Pw,
      firstName: 'Tunde',
      lastName: 'Balogun',
      role: 'STUDENT',
      schoolId: school.id,
    },
  });
  const student2 = await prisma.student.upsert({
    where: { regNumber: 'CHR/2024/SS3A/022' },
    update: {},
    create: {
      userId: student2User.id,
      schoolId: school.id,
      regNumber: 'CHR/2024/SS3A/022',
      className: 'SS3A',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 2',
    },
  });

  // Set module progress for demo students (Phase D: module breakdown + currentModule)
  const track3Mods = await prisma.module.findMany({ where: { track: TrackLevel.TRACK_3 }, orderBy: { number: 'asc' } });
  const progressDataAisha = [
    { score: 92, status: 'COMPLETED' },
    { score: 88, status: 'COMPLETED' },
    { score: 85, status: 'COMPLETED' },
    { score: 91, status: 'COMPLETED' },
    { score: 95, status: 'COMPLETED' },
    { score: null, status: 'IN_PROGRESS' },
  ];
  for (let i = 0; i < track3Mods.length; i++) {
    const row = progressDataAisha[i] || { score: null, status: 'LOCKED' };
    await prisma.moduleProgress.upsert({
      where: { studentId_moduleId: { studentId: student.id, moduleId: track3Mods[i].id } },
      update: {},
      create: {
        studentId: student.id,
        moduleId: track3Mods[i].id,
        status: row.status as any,
        score: row.score,
        completedAt: row.status === 'COMPLETED' ? new Date() : null,
      },
    });
  }
  const progressDataTunde = [
    { score: 72, status: 'COMPLETED' },
    { score: 65, status: 'COMPLETED' },
    { score: 58, status: 'FAILED' },
    { score: null, status: 'IN_PROGRESS' },
    { score: null, status: 'LOCKED' },
    { score: null, status: 'LOCKED' },
  ];
  for (let i = 0; i < track3Mods.length; i++) {
    const row = progressDataTunde[i] || { score: null, status: 'LOCKED' };
    await prisma.moduleProgress.upsert({
      where: { studentId_moduleId: { studentId: student2.id, moduleId: track3Mods[i].id } },
      update: {},
      create: {
        studentId: student2.id,
        moduleId: track3Mods[i].id,
        status: row.status as any,
        score: row.score,
        completedAt: row.status === 'COMPLETED' ? new Date() : null,
      },
    });
  }
  console.log('✅ Demo students (SS3A · TRACK_3) + module progress');

  // ── Phase D: data consumed by GET /class-performance roll-up ─────────────────
  const modT3First = track3Mods[0];
  if (!modT3First) {
    console.warn('⚠️ No Track 3 modules; skipping Phase D grade seed');
  } else {
    const attDays = recentAttendanceWeekdays(12);
    const statusesAisha: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.EXCUSED,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
    ];
    const statusesTunde: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
    ];
    for (let i = 0; i < attDays.length; i++) {
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date: attDays[i] } },
        update: { status: statusesAisha[i] ?? AttendanceStatus.PRESENT, markedBy: tutorUser.id },
        create: {
          studentId: student.id,
          date: attDays[i],
          status: statusesAisha[i] ?? AttendanceStatus.PRESENT,
          notes: 'Seed attendance (Phase D)',
          markedBy: tutorUser.id,
        },
      });
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: student2.id, date: attDays[i] } },
        update: { status: statusesTunde[i] ?? AttendanceStatus.PRESENT, markedBy: tutorUser.id },
        create: {
          studentId: student2.id,
          date: attDays[i],
          status: statusesTunde[i] ?? AttendanceStatus.PRESENT,
          notes: 'Seed attendance (Phase D)',
          markedBy: tutorUser.id,
        },
      });
    }

    // Curriculum assignment (module) + graded submissions → grades.moduleAssignments
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
    await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: curriculumAssignId, studentId: student.id } },
      update: {
        grade: 90,
        status: AssignmentStatus.GRADED,
        gradedAt: new Date(),
      },
      create: {
        assignmentId: curriculumAssignId,
        studentId: student.id,
        status: AssignmentStatus.GRADED,
        grade: 90,
        notes: 'Seed submission',
        gradedAt: new Date(),
      },
    });
    await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: curriculumAssignId, studentId: student2.id } },
      update: {
        grade: 74,
        status: AssignmentStatus.GRADED,
        gradedAt: new Date(),
      },
      create: {
        assignmentId: curriculumAssignId,
        studentId: student2.id,
        status: AssignmentStatus.GRADED,
        grade: 74,
        notes: 'Seed submission',
        gradedAt: new Date(),
      },
    });

    // Tutor class assignment + scores → grades.classAssignments
    const classHwId = 'seed-class-hw-ss3a-track3';
    await prisma.classAssignment.upsert({
      where: { id: classHwId },
      update: {},
      create: {
        id: classHwId,
        tutorId: tutorUser.id,
        schoolId: school.id,
        className: 'SS3A',
        moduleId: modT3First.id,
        title: '[SEED] Homework: layout sketch',
        description: 'Seeded homework for Phase D roll-up.',
        dueDate: utcDate(2026, 3, 22),
        maxScore: 100,
        isPublished: true,
      },
    });
    await prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: classHwId, studentId: student.id } },
      update: { score: 88, status: 'GRADED', gradedAt: new Date() },
      create: {
        assignmentId: classHwId,
        studentId: student.id,
        score: 88,
        status: 'GRADED',
        textBody: 'Seed homework body',
        gradedAt: new Date(),
      },
    });
    await prisma.classAssignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: classHwId, studentId: student2.id } },
      update: { score: 71, status: 'GRADED', gradedAt: new Date() },
      create: {
        assignmentId: classHwId,
        studentId: student2.id,
        score: 71,
        status: 'GRADED',
        textBody: 'Seed homework body',
        gradedAt: new Date(),
      },
    });

    // CBT exam + completed attempts → grades.cbt
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

    // Exam schedule for SS3A → shows under Student "My Exams" (tutor-scheduled flow)
    const futureCbtSlot = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.examSchedule.upsert({
      where: { id: 'seed-exam-schedule-ss3a-cbt' },
      update: {
        scheduledAt: futureCbtSlot,
        venue: 'Computer Lab B',
        durationMins: 20,
        status: ExamStatus.SCHEDULED,
        isActive: true,
        accessCode: '021',
      },
      create: {
        id: 'seed-exam-schedule-ss3a-cbt',
        cbtExamId,
        schoolId: school.id,
        className: 'SS3A',
        scheduledAt: futureCbtSlot,
        venue: 'Computer Lab B',
        durationMins: 20,
        status: ExamStatus.SCHEDULED,
        createdBy: tutorUser.id,
        accessCode: '021',
      },
    });

    await prisma.examAttempt.upsert({
      where: { id: 'seed-exam-attempt-aisha' },
      update: {
        score: 82,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
      create: {
        id: 'seed-exam-attempt-aisha',
        cbtExamId,
        studentId: student.id,
        answers: { 0: 0, 1: 1 } as any,
        score: 82,
        totalCorrect: 4,
        timeTaken: 480,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });
    await prisma.examAttempt.upsert({
      where: { id: 'seed-exam-attempt-tunde' },
      update: {
        score: 64,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
      create: {
        id: 'seed-exam-attempt-tunde',
        cbtExamId,
        studentId: student2.id,
        answers: { 0: 0 } as any,
        score: 64,
        totalCorrect: 3,
        timeTaken: 600,
        status: ExamStatus.COMPLETED,
        submittedAt: new Date(),
      },
    });

    // Practical task + graded submissions → grades.practicals
    const practicalTaskId = 'seed-practical-ss3a-m1';
    await prisma.practicalTask.upsert({
      where: { id: practicalTaskId },
      update: {},
      create: {
        id: practicalTaskId,
        tutorId: tutorUser.id,
        schoolId: school.id,
        className: 'SS3A',
        moduleId: modT3First.id,
        title: '[SEED] Lab: simple webpage',
        description: 'Hands-on task for Phase D demo.',
        maxScore: 100,
        passScore: 50,
        isPublished: true,
      },
    });
    await prisma.practicalSubmission.upsert({
      where: { taskId_studentId: { taskId: practicalTaskId, studentId: student.id } },
      update: {
        totalScore: 86,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
      create: {
        taskId: practicalTaskId,
        studentId: student.id,
        evidenceText: 'Seed practical evidence',
        totalScore: 86,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
    });
    await prisma.practicalSubmission.upsert({
      where: { taskId_studentId: { taskId: practicalTaskId, studentId: student2.id } },
      update: {
        totalScore: 69,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
      create: {
        taskId: practicalTaskId,
        studentId: student2.id,
        evidenceText: 'Seed practical evidence',
        totalScore: 69,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
    });

    console.log('✅ Phase D: attendance, curriculum + class assignments, CBT attempts, exam schedule (My Exams), practicals');
  }

  // Demo parent
  const parentPw = await argon2.hash('Parent@123');
  const parentUser = await prisma.user.upsert({
    where: { email: 'funke.okonkwo@gmail.com' },
    update: {
      password: parentPw,
      firstName: 'Funke',
      lastName: 'Okonkwo',
      role: 'PARENT',
      phone: '+234 803 456 7890',
    },
    create: {
      email: 'funke.okonkwo@gmail.com',
      password: parentPw,
      firstName: 'Funke',
      lastName: 'Okonkwo',
      role: 'PARENT',
      phone: '+234 803 456 7890',
    },
  });
  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      notifyBySMS: true,
      notifyByWhatsApp: true,
    },
  });
  await prisma.student.update({ where: { id: student.id }, data: { parentId: parent.id } });

  // Demo notices
  await prisma.notice.createMany({
    skipDuplicates: true,
    data: [
      { schoolId: school.id, title: 'Postponement of Track 3 Module 5 Final Exam', body: 'The Module 5 final exam originally scheduled for March 14 has been moved to March 15, 2026 at 9:00 AM.', type: 'URGENT', createdBy: schoolAdmin.id },
      { schoolId: school.id, title: 'End of Term Ceremony — March 28, 2026', body: 'Parents are cordially invited to our Term 2 certificate and closing ceremony.', type: 'IMPORTANT', createdBy: schoolAdmin.id },
      { schoolId: school.id, title: 'Term 3 Registration Now Open', body: 'Registration for the 2025/2026 Term 3 is now open. Please confirm re-enrollment before March 31, 2026.', type: 'INFO', createdBy: schoolAdmin.id },
    ],
  });

  // Demo certificates — Superadmin "All Certificates" + /verify-certificate/{serial} (PDF is null until issued via API with Cloudinary)
  const seedSerialAisha = 'ADH-CERT-2026-SEED-AISHA';
  const seedSerialTunde = 'ADH-CERT-2026-SEED-TUNDE';
  await prisma.certificate.upsert({
    where: { serialNumber: seedSerialAisha },
    update: {},
    create: {
      studentId: student.id,
      track: 'TRACK_3',
      serialNumber: seedSerialAisha,
      averageScore: 90,
      pdfUrl: null,
      qrCode: null,
      isRevoked: false,
    },
  });
  await prisma.certificate.upsert({
    where: { serialNumber: seedSerialTunde },
    update: {},
    create: {
      studentId: student2.id,
      track: 'TRACK_3',
      serialNumber: seedSerialTunde,
      averageScore: 72,
      pdfUrl: null,
      qrCode: null,
      isRevoked: false,
    },
  });
  console.log('✅ Demo certificates (2) — Superadmin → Certificates; verify:', seedSerialAisha);

  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('  Super Admin:  admin@adharaedu.com / SuperAdmin@123');
  console.log('  School Admin: admin@crownheights.edu.ng / SchoolAdmin@123');
  console.log('  Tutor:        tutor@adharaedu.com / Tutor@123 (onboarding COMPLETE + KYC fields)');
  console.log('  Student:      aisha@crownheights.edu.ng / Student@123');
  console.log('  Student:      tunde@crownheights.edu.ng / Student@123 (SS3A peer for class roll-up)');
  console.log('  Parent:       funke.okonkwo@gmail.com / Parent@123');
  console.log('\n  Phase D: SS3A / TRACK_3 has attendance, module progress, curriculum + class homework,');
  console.log('  CBT attempts, practicals — try GET /class-performance or dashboard Class performance.\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());

// ── Seed a demo conversation between tutor and student ──
async function seedMessages(prisma: any) {
  const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } })
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
  const school = await prisma.school.findFirst()
  if (!tutor || !student || !school) return

  const convo = await prisma.conversation.upsert({
    where: { tutorId_studentId: { tutorId: tutor.id, studentId: student.id } },
    create: { tutorId: tutor.id, studentId: student.id, schoolId: school.id, lastMessage: 'Come to Lab B on Wednesday.' },
    update: {},
  })

  const msgs = [
    { senderId: tutor.id, body: 'Hello Aisha! How can I help you today?', createdAt: new Date(Date.now() - 86400000 * 2) },
    { senderId: student.id, body: "Sir, I'm struggling with the database schema for Module 6. Can we meet?", createdAt: new Date(Date.now() - 86400000) },
    { senderId: tutor.id, body: 'Sure! Come to Lab B on Wednesday after the 9AM class. Bring your project outline.', createdAt: new Date(Date.now() - 3600000 * 12) },
  ]

  for (const m of msgs) {
    await prisma.message.upsert({
      where: { id: `demo-${m.senderId}-${m.createdAt.getTime()}` },
      create: { ...m, conversationId: convo.id },
      update: {},
    }).catch(() => {})
  }
  console.log('✓ Demo conversation seeded')
}
