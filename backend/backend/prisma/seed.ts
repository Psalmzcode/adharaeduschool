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

/** Mirrors Prisma enums so this file type-checks even if editor `@prisma/client` typings lag `prisma generate`. */
const ModuleStackVariant = {
  COMMON: 'COMMON',
  PYTHON_FLASK: 'PYTHON_FLASK',
  REACT_NODE: 'REACT_NODE',
} as const;
type ModuleStackVariant = (typeof ModuleStackVariant)[keyof typeof ModuleStackVariant];

const Track3Stack = {
  PYTHON_FLASK: 'PYTHON_FLASK',
  REACT_NODE: 'REACT_NODE',
} as const;

/** Stored in School.notes — parsed by school-classes API for admin/tutor class pickers. */
const DEMO_CLASS_REGISTRY_JSON = JSON.stringify([{ className: 'SS3A', track: TrackLevel.TRACK_3 }]);
const DEMO_SCHOOL_NOTES = `Demo registry for Class performance (Phase D) + school-classes list.\n[[ADHARA_CLASSES_JSON]]${DEMO_CLASS_REGISTRY_JSON}`;

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<
    Array<{ column_name: string }>
  >`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = ${columnName} LIMIT 1`;
  return Array.isArray(rows) && rows.length > 0;
}

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
  const modulesHasExamFields =
    (await hasColumn('modules', 'moduleType')) &&
    (await hasColumn('modules', 'termOrdinal'));

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

  /** Canonical module spine — aligned with AdharaEdu student handbooks (Tracks 1–3). */
  const moduleUpsertFields = (m: {
    number: number;
    title: string;
    description: string;
    objectives: string[];
    durationWeeks?: number;
  }) => ({
    title: m.title,
    description: m.description,
    objectives: m.objectives,
    durationWeeks: m.durationWeeks ?? 2,
  });

  async function upsertModule(
    track: TrackLevel,
    number: number,
    stackVariant: ModuleStackVariant,
    m: {
      title: string;
      description: string;
      objectives: string[];
      durationWeeks?: number;
    },
  ) {
    const fields = moduleUpsertFields({ ...m, number });
    const existing = await prisma.module.findFirst({
      where: { track, number, stackVariant } as Prisma.ModuleWhereInput,
      select: { id: true },
    });
    if (existing) {
      await prisma.module.update({
        where: { id: existing.id },
        data: fields,
      });
    } else {
      await prisma.module.create({
        data: {
          ...fields,
          number,
          track,
          stackVariant,
        } as Prisma.ModuleCreateInput,
      });
    }
  }

  /** Term exam module per track — anchors a combined CBT for the term. */
  async function upsertTermExamModule(track: TrackLevel, termOrdinal: 1 | 2 | 3) {
    const number = 90 + termOrdinal; // keep exam modules out of the standard handbook range
    const title = `Term ${termOrdinal} Main Exam`;
    const description =
      `Term ${termOrdinal} combined assessment for ${String(track).replace('TRACK_', 'Track ')}. ` +
      `Draft questions spanning all modules taught in the term.`;
    const objectives = [
      'Assess theory and practical understanding across the term',
      'Provide a consistent termly benchmark across schools',
    ];
    const existing = await prisma.module.findFirst({
      where: { track, number, stackVariant: ModuleStackVariant.COMMON } as Prisma.ModuleWhereInput,
      select: { id: true },
    });
    if (existing) {
      await prisma.module.update({
        where: { id: existing.id },
        data: {
          track,
          number,
          stackVariant: ModuleStackVariant.COMMON as any,
          title,
          description,
          objectives,
          durationWeeks: 1,
          isActive: true,
        } as any,
      });
      if (modulesHasExamFields) {
        await prisma.$executeRaw`UPDATE "modules" SET "moduleType" = 'TERM_EXAM', "termOrdinal" = ${termOrdinal} WHERE "id" = ${existing.id}`;
      }
    } else {
      const created = await prisma.module.create({
        data: {
          track,
          number,
          stackVariant: ModuleStackVariant.COMMON as any,
          title,
          description,
          objectives,
          durationWeeks: 1,
          isActive: true,
        } as any,
        select: { id: true },
      });
      if (modulesHasExamFields) {
        await prisma.$executeRaw`UPDATE "modules" SET "moduleType" = 'TERM_EXAM', "termOrdinal" = ${termOrdinal} WHERE "id" = ${created.id}`;
      }
    }
  }

  // Track 1 — Computer Appreciation (JSS1–SS1) · 5 modules
  const track1Modules = [
    {
      number: 1,
      title: 'Understanding Computers',
      description:
        'Hardware vs software, parts of a computer, IPO cycle, types of computers, data measurement (bits, bytes). Foundation vocabulary before touching applications.',
      objectives: [
        'Explain hardware and software and how they work together',
        'Identify main parts of a desktop and their roles',
        'Describe the Input → Process → Output cycle',
        'Compare common types of computers and storage units',
      ],
      durationWeeks: 2,
    },
    {
      number: 2,
      title: 'Mouse, Keyboard & Windows',
      description:
        'Correct start-up and shut-down, mouse control, Windows desktop, File Explorer, files and folders, essential shortcuts, touch-typing home row.',
      objectives: [
        'Navigate the desktop and File Explorer confidently',
        'Create, rename, move, and organise files and folders',
        'Use core keyboard shortcuts and safe shutdown procedures',
        'Build touch-typing habits toward the programme WPM target',
      ],
      durationWeeks: 3,
    },
    {
      number: 3,
      title: 'Microsoft Word',
      description:
        'Professional documents: interface, save formats, formatting, lists, tables, images, page setup, spelling and grammar, simple projects (e.g. “About Me”).',
      objectives: [
        'Create and format a multi-section Word document',
        'Use tables, lists, headers/footers, and page layout tools',
        'Apply spelling, grammar, and find/replace',
        'Save appropriately (.docx vs PDF)',
      ],
      durationWeeks: 3,
    },
    {
      number: 4,
      title: 'Microsoft Excel',
      description:
        'Spreadsheets: interface, cell references, formulas (SUM, AVERAGE, MAX, MIN, IF), formatting, charts, and a simple class results project.',
      objectives: [
        'Enter data and write correct formulas starting with =',
        'Format cells and use basic charts',
        'Interpret cell references and ranges',
        'Complete a small real-world spreadsheet task',
      ],
      durationWeeks: 3,
    },
    {
      number: 5,
      title: 'Internet, Email & Online Safety',
      description:
        'How the web works, searching effectively, professional email structure and etiquette, HTTPS, phishing, digital footprint, safe behaviour on shared computers.',
      objectives: [
        'Explain how browsers, URLs, and servers work at a user level',
        'Write a short professional email with subject and greeting',
        'Apply basic online safety and privacy habits',
        'Describe phishing, malware, and responsible sharing',
      ],
      durationWeeks: 2,
    },
  ];

  for (const m of track1Modules) {
    await upsertModule(TrackLevel.TRACK_1, m.number, ModuleStackVariant.COMMON, m);
  }

  // Track 2 — Introduction to Programming (SS1–SS2) · 6 modules (handbook)
  const track2Modules = [
    {
      number: 1,
      title: 'Logic & Algorithms',
      description:
        'How computers follow instructions: algorithms, sequence, selection, iteration, flowcharts, variables — the mental model before Scratch and web languages.',
      objectives: [
        'Define an algorithm and list properties of good algorithms',
        'Use sequence, conditions, and loops to describe solutions',
        'Read and sketch simple flowcharts',
        'Connect everyday steps to programming structure',
      ],
      durationWeeks: 2,
    },
    {
      number: 2,
      title: 'Scratch (Block-Based Programming)',
      description:
        'Visual coding: events, motion, looks, loops, conditions, variables, messages — build at least one interactive game or animation.',
      objectives: [
        'Build a Scratch project using events and loops',
        'Use variables and conditionals in a block environment',
        'Debug by reading behaviour and adjusting blocks',
        'Explain program flow to a peer',
      ],
      durationWeeks: 2,
    },
    {
      number: 3,
      title: 'HTML Fundamentals',
      description:
        'Structure of web pages: tags, attributes, semantic layout, links, images, tables, forms, multi-page sites.',
      objectives: [
        'Write valid HTML5 structure for a small multi-page site',
        'Use semantic tags where appropriate',
        'Embed links, images, tables, and simple forms',
      ],
      durationWeeks: 2,
    },
    {
      number: 4,
      title: 'CSS Styling',
      description:
        'Selectors, properties, colours, typography, box model, Flexbox, responsive basics, hover states.',
      objectives: [
        'Style HTML with external CSS',
        'Use Flexbox for layout',
        'Apply responsive thinking (viewport, relative units)',
      ],
      durationWeeks: 2,
    },
    {
      number: 5,
      title: 'JavaScript Basics',
      description:
        'Interactivity: variables, conditions, loops, functions, DOM manipulation, events, simple client-side behaviour.',
      objectives: [
        'Write small scripts that respond to user actions',
        'Select and manipulate DOM elements',
        'Validate forms or show/hide content',
      ],
      durationWeeks: 2,
    },
    {
      number: 6,
      title: 'Final Web Project',
      description:
        'Capstone for Track 2: a polished multi-page site combining HTML, CSS, and JavaScript — presentation-ready for portfolio or demo.',
      objectives: [
        'Integrate HTML, CSS, and JavaScript in one project',
        'Meet basic accessibility and UX expectations',
        'Present the project and explain design choices',
      ],
      durationWeeks: 2,
    },
  ];

  for (const m of track2Modules) {
    await upsertModule(TrackLevel.TRACK_2, m.number, ModuleStackVariant.COMMON, m);
  }

  // Track 3 — Advanced Tech (SS3): shared modules 1–2 & 5–6; branch at 3–4 (Python/Flask vs React/Node per tutor assignment)
  const track3Common = [
    {
      number: 1,
      title: 'Advanced HTML & CSS',
      description:
        'Semantic HTML, responsive design, CSS Grid, animations, professional site structure and patterns used in industry.',
      objectives: [
        'Build responsive layouts with Grid and Flexbox',
        'Use semantic HTML for SEO and accessibility',
        'Apply animation and transition thoughtfully',
      ],
      durationWeeks: 2,
    },
    {
      number: 2,
      title: 'Advanced JavaScript',
      description:
        'ES6+ features, arrays and objects, async fetch, consuming APIs, building interactive UIs.',
      objectives: [
        'Use modern JS syntax and async patterns',
        'Fetch and display data from an API',
        'Structure small front-end apps clearly',
      ],
      durationWeeks: 2,
    },
    {
      number: 5,
      title: 'Freelancing & Tech Business',
      description:
        'Portfolio, GitHub presence, client communication, pricing, platforms — turning skills into income and strong applications.',
      objectives: [
        'Maintain a portfolio and public code samples',
        'Describe services and pricing professionally',
        'Follow safe client and payment practices',
      ],
      durationWeeks: 2,
    },
    {
      number: 6,
      title: 'Capstone Project',
      description:
        'Full-stack or portfolio-quality project: design, build, document, and present a complete piece of work.',
      objectives: [
        'Deliver a complete project with scope appropriate to the term',
        'Document and present work to tutors or peers',
        'Reflect on strengths and next learning steps',
      ],
      durationWeeks: 2,
    },
  ];
  for (const m of track3Common) {
    await upsertModule(TrackLevel.TRACK_3, m.number, ModuleStackVariant.COMMON, m);
  }

  const track3PythonFlask = [
    {
      number: 3,
      title: 'Python Programming',
      description:
        'Core Python: variables, types, control flow, functions, file handling, OOP introduction — scripts and small programs.',
      objectives: [
        'Write and debug Python scripts',
        'Use functions, files, and basic classes',
        'Solve problems with readable code',
      ],
      durationWeeks: 2,
    },
    {
      number: 4,
      title: 'Backend Basics (Flask)',
      description:
        'HTTP, servers, REST mindset, Flask web apps, SQLite — connect to prior Python and front-end work.',
      objectives: [
        'Explain request/response and simple routes',
        'Build a minimal Flask app with SQLite',
        'Understand how front-end and back-end connect',
      ],
      durationWeeks: 2,
    },
  ];
  for (const m of track3PythonFlask) {
    await upsertModule(TrackLevel.TRACK_3, m.number, ModuleStackVariant.PYTHON_FLASK, m);
  }

  const track3ReactNode = [
    {
      number: 3,
      title: 'React Application Development',
      description:
        'Component-based UI with React: JSX, hooks, props, state, routing, and consuming APIs from a modern front-end.',
      objectives: [
        'Build interactive UIs with components and hooks',
        'Organise routes and shared state',
        'Connect to REST APIs from the client',
      ],
      durationWeeks: 2,
    },
    {
      number: 4,
      title: 'Node.js & API Backend',
      description:
        'Server-side JavaScript with Node: Express, REST endpoints, middleware, environment config, and a persistent data layer.',
      objectives: [
        'Design simple REST APIs',
        'Implement Express routes and middleware',
        'Describe how the React client talks to a Node API',
      ],
      durationWeeks: 2,
    },
  ];
  for (const m of track3ReactNode) {
    await upsertModule(TrackLevel.TRACK_3, m.number, ModuleStackVariant.REACT_NODE, m);
  }

  console.log('✅ All modules seeded (19 rows: Track 1 ×5, Track 2 ×6, Track 3 ×8 shared + branch)');

  // Term exam modules (3 per track)
  for (const termOrdinal of [1, 2, 3] as const) {
    await upsertTermExamModule(TrackLevel.TRACK_1, termOrdinal);
    await upsertTermExamModule(TrackLevel.TRACK_2, termOrdinal);
    await upsertTermExamModule(TrackLevel.TRACK_3, termOrdinal);
  }
  console.log('✅ Term exam modules seeded (Track 1–3 × Term 1–3)');

  // Track 1 — curriculum lessons (Module 1–2, handbook-aligned; published for tutor session tagging)
  const t1Module = async (num: number) =>
    prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_1, number: num, stackVariant: ModuleStackVariant.COMMON },
      select: { id: true, title: true },
    });

  /** `PrismaClient` exposes `curriculumLesson` after `npx prisma generate` (CurriculumLesson model). */
  const prismaCurriculum = prisma as PrismaClient & {
    curriculumLesson: {
      upsert: (args: {
        where: { moduleId_position: { moduleId: string; position: number } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<{ id: string }>;
    };
  };

  const upsertCurriculumLesson = async (
    moduleId: string,
    position: number,
    data: {
      title: string;
      objective: string;
      handbook: string;
      exercises: Prisma.InputJsonValue;
      quickCheck: Prisma.InputJsonValue;
      outline?: Prisma.InputJsonValue;
      takeHomeTask?: string | null;
      lab?: string | null;
    },
  ) => {
    const resources: Prisma.InputJsonValue = {
      handbook: data.handbook,
      ...(data.lab ? { lab: data.lab } : {}),
    };
    const payload = {
      title: data.title,
      objective: data.objective,
      outline: data.outline ?? [{ label: 'Session', minutes: 75 }],
      exercises: data.exercises,
      quickCheckQuestions: data.quickCheck,
      resources,
      takeHomeTask: data.takeHomeTask ?? null,
      estimatedDurationMins: 75,
      isPublished: true,
    };
    await prismaCurriculum.curriculumLesson.upsert({
      where: { moduleId_position: { moduleId, position } },
      create: { moduleId, position, ...payload },
      update: { ...payload },
    });
  };

  const mod1 = await t1Module(1);
  const mod2 = await t1Module(2);
  if (mod1) {
    await upsertCurriculumLesson(mod1.id, 1, {
      title: 'What is a Computer + Types of Computers',
      objective: 'Define a computer and compare common types; relate to handbook Sections 1.1 and 1.5.',
      handbook: 'Sections 1.1, 1.5',
      outline: [
        { label: 'Intro & types of computers', minutes: 25 },
        { label: 'Guided practice', minutes: 35 },
        { label: 'Quick check & wrap-up', minutes: 15 },
      ],
      exercises: ['Identify computer types from pictures (handbook / worksheet).'],
      quickCheck: ['Name 2 input devices and 2 output devices.'],
    });
    await upsertCurriculumLesson(mod1.id, 2, {
      title: 'Hardware vs Software + Parts of Desktop',
      objective: 'Distinguish hardware and software; label main parts of a desktop system.',
      handbook: 'Sections 1.2, 1.3',
      exercises: ['Draw and label 8 parts of a computer.', 'Hardware vs software sort exercise.'],
      quickCheck: ['Hardware vs software sort exercise (class or worksheet).'],
    });
    await upsertCurriculumLesson(mod1.id, 3, {
      title: 'The IPO Cycle',
      objective: 'Explain Input → Process → Output with real-world examples.',
      handbook: 'Section 1.4',
      exercises: ['Give 3 real-life IPO examples (different contexts).'],
      quickCheck: ['Fill in the IPO diagram.'],
    });
    await upsertCurriculumLesson(mod1.id, 4, {
      title: 'Data Measurement + Module 1 Review',
      objective: 'Convert between common units; consolidate Module 1 with a full quick check.',
      handbook: 'Sections 1.6, 1.7',
      exercises: ['Convert KB → MB → GB problems.', 'Review key terms from Module 1.'],
      quickCheck: ['Full Module 1 quick check (7 questions).'],
    });
  }
  if (mod2) {
    await upsertCurriculumLesson(mod2.id, 1, {
      title: 'Switching On/Off + Using the Mouse',
      objective: 'Safe power-up/down; mouse control and pointer actions.',
      handbook: 'Sections 2.1, 2.2',
      lab: 'Mouse practice exercise (all 5 tasks).',
      exercises: ['Complete all mouse practice tasks in the lab.'],
      quickCheck: ['Name each mouse action demonstrated.'],
    });
    await upsertCurriculumLesson(mod2.id, 2, {
      title: 'The Windows Desktop + Files and Folders',
      objective: 'Navigate the desktop and File Explorer; create a simple folder structure.',
      handbook: 'Sections 2.3, 2.4',
      lab: 'Create AdharaEdu Work folder + 3 subfolders.',
      exercises: ['Create AdharaEdu Work folder + 3 subfolders.', 'Navigate and rename items safely.'],
      quickCheck: ['Desktop parts identification.'],
    });
    await upsertCurriculumLesson(mod2.id, 3, {
      title: 'Keyboard Layout + Sections',
      objective: 'Identify keyboard sections and typical key roles.',
      handbook: 'Section 2.5',
      lab: 'Identify each keyboard section physically (hands-on).',
      exercises: ['Label or point to main zones: alphanumeric, function, navigation, numeric keypad.'],
      quickCheck: ['What does each key group do? (short prompts)'],
    });
    await upsertCurriculumLesson(mod2.id, 4, {
      title: 'Keyboard Shortcuts',
      objective: 'Use essential shortcuts in Word and File Explorer.',
      handbook: 'Section 2.6',
      lab: 'Practice all 17 shortcuts in Word and Explorer.',
      exercises: ['Drill the shortcut list with teacher sign-off.'],
      quickCheck: ['Shortcut matching quiz.'],
    });
    await upsertCurriculumLesson(mod2.id, 5, {
      title: 'Touch Typing — Home Row',
      objective: 'Establish home-row posture and accuracy before speed.',
      handbook: 'Section 2.7',
      lab: 'keybr.com — home row only drills.',
      exercises: ['Home row drills until comfortable.'],
      quickCheck: ['Type a home-row sentence accurately.'],
    });
    await upsertCurriculumLesson(mod2.id, 6, {
      title: 'Touch Typing — Building Speed',
      objective: 'Build speed while maintaining accuracy on extended drills.',
      handbook: 'Section 2.7 (continued)',
      lab: 'All 6 typing drill sentences × 5 each.',
      exercises: ['Complete the six drill sentences, five rounds each.'],
      quickCheck: ['Typing test — record WPM + accuracy.'],
    });
    await upsertCurriculumLesson(mod2.id, 7, {
      title: 'Module 2 Review + Typing Test Week 1',
      objective: 'Consolidate Module 2; first official typing speed test for the tracker.',
      handbook: 'Section 2.8',
      lab: 'Full quick check + first official typing speed test. Record in Weekly Typing Speed Tracker.',
      exercises: ['Module 2 review tasks.', 'Official Week 1 typing test.'],
      quickCheck: ['Combined review + typing result recorded.'],
    });
  }
  if (mod1 && mod2) {
    console.log('✅ Track 1 curriculum lessons seeded (Module 1: 4 lessons, Module 2: 7 lessons, published)');
  } else {
    console.warn('⚠️ Track 1 modules 1 or 2 missing — curriculum lesson seed skipped');
  }

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
    update: { track3Stack: Track3Stack.PYTHON_FLASK } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'demo-assignment-1',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_3,
      className: 'SS3A',
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.TutorAssignmentCreateInput,
  });
  console.log('✅ Demo tutor created and assigned');

  // Demo student — default password student@{reg suffix} e.g. student@021 for CHR/.../021
  const studentPw = await argon2.hash('student@021');
  const studentUser = await prisma.user.upsert({
    where: { email: 'aisha@crownheights.edu.ng' },
    update: {
      password: studentPw,
      firstName: 'Aisha',
      lastName: 'Okonkwo',
      role: 'STUDENT',
      schoolId: school.id,
      username: 'chr.aisha',
      mustChangePassword: true,
    },
    create: {
      email: 'aisha@crownheights.edu.ng',
      username: 'chr.aisha',
      password: studentPw,
      firstName: 'Aisha',
      lastName: 'Okonkwo',
      role: 'STUDENT',
      schoolId: school.id,
      mustChangePassword: true,
    },
  });
  const student = await prisma.student.upsert({
    where: { regNumber: 'CHR/2024/SS3A/021' },
    update: { track3Stack: Track3Stack.PYTHON_FLASK } as Prisma.StudentUpdateInput,
    create: {
      userId: studentUser.id,
      schoolId: school.id,
      regNumber: 'CHR/2024/SS3A/021',
      className: 'SS3A',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 2',
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.StudentCreateInput,
  });

  // Second student — same class/track so class-performance roll-up has real averages
  const student2Pw = await argon2.hash('student@022');
  const student2User = await prisma.user.upsert({
    where: { email: 'tunde@crownheights.edu.ng' },
    update: {
      password: student2Pw,
      firstName: 'Tunde',
      lastName: 'Balogun',
      role: 'STUDENT',
      schoolId: school.id,
      username: 'chr.tunde',
      mustChangePassword: true,
    },
    create: {
      email: 'tunde@crownheights.edu.ng',
      username: 'chr.tunde',
      password: student2Pw,
      firstName: 'Tunde',
      lastName: 'Balogun',
      role: 'STUDENT',
      schoolId: school.id,
      mustChangePassword: true,
    },
  });
  const student2 = await prisma.student.upsert({
    where: { regNumber: 'CHR/2024/SS3A/022' },
    update: { track3Stack: Track3Stack.PYTHON_FLASK } as Prisma.StudentUpdateInput,
    create: {
      userId: student2User.id,
      schoolId: school.id,
      regNumber: 'CHR/2024/SS3A/022',
      className: 'SS3A',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 2',
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.StudentCreateInput,
  });

  // Set module progress for demo students (Phase D: module breakdown + currentModule)
  const track3Mods = await prisma.module.findMany({
    where: {
      track: TrackLevel.TRACK_3,
      OR: [
        { stackVariant: ModuleStackVariant.COMMON },
        { stackVariant: ModuleStackVariant.PYTHON_FLASK },
      ],
    } as unknown as Prisma.ModuleWhereInput,
    orderBy: [{ number: 'asc' }, { stackVariant: 'asc' }] as Prisma.ModuleOrderByWithRelationInput[],
  });
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
  console.log('  Student:      chr.aisha or aisha@crownheights.edu.ng / student@021');
  console.log('  Student:      chr.tunde or tunde@crownheights.edu.ng / student@022 (SS3A peer)');
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
