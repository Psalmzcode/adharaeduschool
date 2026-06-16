import {
  PrismaClient,
  Prisma,
  TrackLevel,
  AttendanceStatus,
  AssignmentStatus,
  ExamStatus,
  ModuleType,
  TutorIdentificationType,
} from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { seedEvidenceTypeDemos } from './seed-evidence-demos';
import { seedAssignmentEvidenceDemos } from './seed-assignment-evidence-demos';
import { extractFromHtmlSources } from '../src/evidence-grading/extractors/html.extractor';

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
const CROWN_HEIGHTS_CLASSES_JSON = JSON.stringify([
  { className: 'SS3A', track: TrackLevel.TRACK_3 },
  { className: 'SS1A', track: TrackLevel.TRACK_1 },
  { className: 'SS1B', track: TrackLevel.TRACK_1 },
]);
const LAKESIDE_CLASSES_JSON = JSON.stringify([{ className: 'SS3B', track: TrackLevel.TRACK_3 }]);
const crownHeightsSchoolNotes = `In-progress Track 3 demo (pass / fail / in-progress).\n[[ADHARA_CLASSES_JSON]]${CROWN_HEIGHTS_CLASSES_JSON}`;
const lakesideSchoolNotes = `Graduated Track 3 demo (certificate download + superadmin issue flow).\n[[ADHARA_CLASSES_JSON]]${LAKESIDE_CLASSES_JSON}`;

type ProgressRow = { score: number | null; status: string };

function studentPasswordFromReg(regNumber: string) {
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

/** Writes a downloadable PDF to frontend/public — branded PDFs use Superadmin Issue (API + pdfmake). */
async function issueDemoCertificateLocal(opts: {
  studentId: string;
  track: TrackLevel;
  serialNumber: string;
  averageScore: number;
}) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendUrl}/verify-certificate/${opts.serialNumber}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });
  const outDir = path.join(__dirname, '../../../frontend/public/demo-certificates');
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `${opts.serialNumber}.pdf`;
  const filePath = path.join(outDir, filename);
  if (!fs.existsSync(filePath)) {
    const res = await fetch('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  }
  const pdfUrl = `${frontendUrl}/demo-certificates/${filename}`;
  return prisma.certificate.upsert({
    where: { serialNumber: opts.serialNumber },
    update: {
      pdfUrl,
      qrCode: qrDataUrl,
      averageScore: opts.averageScore,
      isRevoked: false,
    },
    create: {
      studentId: opts.studentId,
      track: opts.track,
      serialNumber: opts.serialNumber,
      averageScore: opts.averageScore,
      pdfUrl,
      qrCode: qrDataUrl,
      isRevoked: false,
    },
  });
}

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

  const curriculumLeadPw = await argon2.hash(process.env.CURRICULUM_LEAD_PASSWORD || 'Curriculum@123');
  const curriculumLead = await prisma.user.upsert({
    where: { email: process.env.CURRICULUM_LEAD_EMAIL || 'curriculum@adharaedu.com' },
    update: {
      password: curriculumLeadPw,
      firstName: 'Curriculum',
      lastName: 'Lead',
      role: 'CURRICULUM_LEAD',
    },
    create: {
      email: process.env.CURRICULUM_LEAD_EMAIL || 'curriculum@adharaedu.com',
      password: curriculumLeadPw,
      firstName: 'Curriculum',
      lastName: 'Lead',
      role: 'CURRICULUM_LEAD',
    },
  });
  console.log('✅ Curriculum lead created:', curriculumLead.email);

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

  /** Optional termly assessment per track — not required for certificates. */
  async function upsertTermExamModule(track: TrackLevel, termOrdinal: 1 | 2 | 3) {
    const number = 90 + termOrdinal; // keep exam modules out of the standard handbook range
    const title = `Term ${termOrdinal} Termly Assessment`;
    const description =
      `Optional termly combined CBT for ${String(track).replace('TRACK_', 'Track ')}. ` +
      `Spans modules taught in the term; not required for track certificates.`;
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

  /** One capstone exam per track — required for certificate eligibility (≥50%). */
  async function upsertTrackCompletionExamModule(track: TrackLevel) {
    const number = 99;
    const trackLabel = String(track).replace('TRACK_', 'Track ');
    const title = `${trackLabel} Completion Exam`;
    const description =
      `Final track capstone CBT after all standard modules on ${trackLabel} are complete. ` +
      `Required for certificate eligibility (score ≥ 50%).`;
    const objectives = [
      'Assess integrated understanding across the full track curriculum',
      'Serve as the certificate gate alongside completed standard modules',
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
        await prisma.$executeRaw`UPDATE "modules" SET "moduleType" = 'TRACK_COMPLETION_EXAM', "termOrdinal" = NULL WHERE "id" = ${existing.id}`;
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
        await prisma.$executeRaw`UPDATE "modules" SET "moduleType" = 'TRACK_COMPLETION_EXAM', "termOrdinal" = NULL WHERE "id" = ${created.id}`;
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
  console.log('✅ Termly assessment modules seeded (Track 1–3 × Term 1–3)');

  for (const track of [TrackLevel.TRACK_1, TrackLevel.TRACK_2, TrackLevel.TRACK_3] as const) {
    await upsertTrackCompletionExamModule(track);
  }
  console.log('✅ Track completion exam modules seeded (Track 1–3)');

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
      title: 'Module 2 Review + Official Typing Assessment',
      objective: 'Consolidate Module 2; complete the official typing speed test when your tutor assigns it.',
      handbook: 'Section 2.8',
      lab: 'Full quick check + official typing speed test. Record in Weekly Typing Speed Tracker.',
      exercises: ['Module 2 review tasks.', 'Official typing assessment.'],
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
    notes: crownHeightsSchoolNotes,
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
    notes: crownHeightsSchoolNotes,
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
      tracks: [TrackLevel.TRACK_1, TrackLevel.TRACK_2, TrackLevel.TRACK_3],
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
      tracks: [TrackLevel.TRACK_1, TrackLevel.TRACK_2, TrackLevel.TRACK_3],
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
  await prisma.tutorAssignment.upsert({
    where: { id: 'demo-assignment-ss1a-track1' },
    update: {
      termLabel: '2025/2026 Term 2',
      isActive: true,
      track: TrackLevel.TRACK_1,
    } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'demo-assignment-ss1a-track1',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_1,
      className: 'SS1A',
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
    } as unknown as Prisma.TutorAssignmentCreateInput,
  });
  await prisma.tutorAssignment.upsert({
    where: { id: 'demo-assignment-ss1b-track1' },
    update: {
      termLabel: '2025/2026 Term 2',
      isActive: true,
      track: TrackLevel.TRACK_1,
    } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'demo-assignment-ss1b-track1',
      tutorId: tutor.id,
      schoolId: school.id,
      track: TrackLevel.TRACK_1,
      className: 'SS1B',
      termLabel: '2025/2026 Term 2',
      isActive: true,
      startDate: new Date('2026-01-06'),
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

  // Standard Track 3 modules only (excludes term exams + completion exam — matches production eligibility)
  const track3StandardMods = await prisma.module.findMany({
    where: {
      track: TrackLevel.TRACK_3,
      moduleType: ModuleType.STANDARD,
      OR: [
        { stackVariant: ModuleStackVariant.COMMON },
        { stackVariant: ModuleStackVariant.PYTHON_FLASK },
      ],
    } as unknown as Prisma.ModuleWhereInput,
    orderBy: [{ number: 'asc' }, { stackVariant: 'asc' }] as Prisma.ModuleOrderByWithRelationInput[],
  });
  // Crown Heights SS3A — mid-track: high performer vs failed retake vs class on next module
  const progressDataAisha: ProgressRow[] = [
    { score: 92, status: 'COMPLETED' },
    { score: 88, status: 'COMPLETED' },
    { score: 85, status: 'COMPLETED' },
    { score: 91, status: 'COMPLETED' },
    { score: 95, status: 'COMPLETED' },
    { score: null, status: 'IN_PROGRESS' },
  ];
  const progressDataTunde: ProgressRow[] = [
    { score: 72, status: 'COMPLETED' },
    { score: 65, status: 'COMPLETED' },
    { score: 58, status: 'FAILED' },
    { score: null, status: 'IN_PROGRESS' },
    { score: null, status: 'LOCKED' },
    { score: null, status: 'LOCKED' },
  ];
  await upsertStudentModuleProgress(student.id, track3StandardMods, progressDataAisha);
  await upsertStudentModuleProgress(student2.id, track3StandardMods, progressDataTunde);
  console.log('✅ Crown Heights SS3A — in-progress demo (Aisha near finish, Tunde failed M3)');

  // ── Track 1 SS1A / SS1B — Typing Lab demo (Module 2 Mouse, Keyboard & Windows) ──
  const track1StandardMods = await prisma.module.findMany({
    where: {
      track: TrackLevel.TRACK_1,
      moduleType: ModuleType.STANDARD,
      stackVariant: ModuleStackVariant.COMMON,
    },
    orderBy: { number: 'asc' },
  });
  const modT1Second = track1StandardMods.find((m) => m.number === 2);
  const modT1Third = track1StandardMods.find((m) => m.number === 3);

  /** Class pace: `finalized` modules tutor has advanced; `current` is in progress for the whole class. */
  function track1ClassProgress(
    finalizedCount: number,
    currentModuleNumber: number,
    moduleScores: Record<number, number>,
  ): ProgressRow[] {
    return track1StandardMods.map((m) => {
      if (m.number <= finalizedCount) {
        return { score: moduleScores[m.number] ?? 75, status: 'COMPLETED' };
      }
      if (m.number === currentModuleNumber) {
        return { score: null, status: 'IN_PROGRESS' };
      }
      return { score: null, status: 'LOCKED' };
    });
  }

  const progressSS1A = track1ClassProgress(1, 2, { 1: 78 });
  const progressSS1B_Mary = track1ClassProgress(2, 3, { 1: 82, 2: 85 });
  const progressSS1B_Kemi = track1ClassProgress(2, 3, { 1: 76, 2: 80 });
  const progressSS1B_Tobi = track1ClassProgress(2, 3, { 1: 90, 2: 88 });

  async function upsertTrack1DemoStudent(opts: {
    email: string;
    username: string;
    regNumber: string;
    firstName: string;
    lastName: string;
    className: string;
    progress: ProgressRow[];
  }) {
    const pw = await argon2.hash(studentPasswordFromReg(opts.regNumber));
    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {
        password: pw,
        firstName: opts.firstName,
        lastName: opts.lastName,
        role: 'STUDENT',
        schoolId: school.id,
        username: opts.username,
        mustChangePassword: false,
      },
      create: {
        email: opts.email,
        username: opts.username,
        password: pw,
        firstName: opts.firstName,
        lastName: opts.lastName,
        role: 'STUDENT',
        schoolId: school.id,
        mustChangePassword: false,
      },
    });
    const row = await prisma.student.upsert({
      where: { regNumber: opts.regNumber },
      update: {
        className: opts.className,
        track: TrackLevel.TRACK_1,
        termLabel: '2025/2026 Term 2',
      },
      create: {
        userId: user.id,
        schoolId: school.id,
        regNumber: opts.regNumber,
        className: opts.className,
        track: TrackLevel.TRACK_1,
        termLabel: '2025/2026 Term 2',
      },
    });
    await upsertStudentModuleProgress(row.id, track1StandardMods, opts.progress);
    return row;
  }

  if (track1StandardMods.length && modT1Second) {
    const lessonM2 = await prisma.curriculumLesson.findFirst({
      where: { moduleId: modT1Second.id, isPublished: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const lessonM3 = modT1Third
      ? await prisma.curriculumLesson.findFirst({
          where: { moduleId: modT1Third.id, isPublished: true },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
      : null;

    if (lessonM2) {
      await prisma.classCurriculumState.upsert({
        where: {
          schoolId_className_curriculumBranchKey: {
            schoolId: school.id,
            className: 'SS1A',
            curriculumBranchKey: TrackLevel.TRACK_1,
          },
        },
        update: {
          currentLessonId: lessonM2.id,
          lastDeliveredLessonId: lessonM2.id,
        },
        create: {
          schoolId: school.id,
          className: 'SS1A',
          curriculumBranchKey: TrackLevel.TRACK_1,
          currentLessonId: lessonM2.id,
          lastDeliveredLessonId: lessonM2.id,
        },
      });
    }
    if (lessonM3) {
      await prisma.classCurriculumState.upsert({
        where: {
          schoolId_className_curriculumBranchKey: {
            schoolId: school.id,
            className: 'SS1B',
            curriculumBranchKey: TrackLevel.TRACK_1,
          },
        },
        update: {
          currentLessonId: lessonM3.id,
          lastDeliveredLessonId: lessonM3.id,
        },
        create: {
          schoolId: school.id,
          className: 'SS1B',
          curriculumBranchKey: TrackLevel.TRACK_1,
          currentLessonId: lessonM3.id,
          lastDeliveredLessonId: lessonM3.id,
        },
      });
    }

    await upsertTrack1DemoStudent({
      email: 'typing.demo@crownheights.edu.ng',
      username: 'chr.typing',
      regNumber: 'CHR/2026/SS1A/901',
      firstName: 'Demo',
      lastName: 'Typist',
      className: 'SS1A',
      progress: progressSS1A,
    });
    await upsertTrack1DemoStudent({
      email: 'typing2.demo@crownheights.edu.ng',
      username: 'chr.typing2',
      regNumber: 'CHR/2026/SS1A/902',
      firstName: 'Ada',
      lastName: 'Keys',
      className: 'SS1A',
      progress: progressSS1A,
    });
    await upsertTrack1DemoStudent({
      email: 'typing3.demo@crownheights.edu.ng',
      username: 'chr.typing3',
      regNumber: 'CHR/2026/SS1A/903',
      firstName: 'Samuel',
      lastName: 'Ali',
      className: 'SS1A',
      progress: progressSS1A,
    });
    await upsertTrack1DemoStudent({
      email: 'typing4.demo@crownheights.edu.ng',
      username: 'chr.typing4',
      regNumber: 'CHR/2026/SS1B/901',
      firstName: 'Mary',
      lastName: 'Okafor',
      className: 'SS1B',
      progress: progressSS1B_Mary,
    });
    await upsertTrack1DemoStudent({
      email: 'typing5.demo@crownheights.edu.ng',
      username: 'chr.typing5',
      regNumber: 'CHR/2026/SS1B/902',
      firstName: 'Kemi',
      lastName: 'Adeyemi',
      className: 'SS1B',
      progress: progressSS1B_Kemi,
    });
    await upsertTrack1DemoStudent({
      email: 'typing6.demo@crownheights.edu.ng',
      username: 'chr.typing6',
      regNumber: 'CHR/2026/SS1B/903',
      firstName: 'Tobi',
      lastName: 'Musa',
      className: 'SS1B',
      progress: progressSS1B_Tobi,
    });
    console.log('✅ Crown Heights SS1A (1 mod) / SS1B (2 mods) — Track 1 leaderboard pace demo');
  } else {
    console.warn('⚠️ Track 1 modules missing — typing lab demo seed skipped');
  }

  // ── Phase D: data consumed by GET /class-performance roll-up ─────────────────
  const modT3First = track3StandardMods[0];
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
      update: {
        submissionType: 'html',
        modelAnswer: 'Semantic layout (header, nav, main, footer), CSS flex/grid, JS click handler.',
        lessonObjective: 'Demonstrate a simple responsive webpage with interactivity.',
      } as unknown as Prisma.PracticalTaskUpdateInput,
      create: {
        id: practicalTaskId,
        tutorId: tutorUser.id,
        schoolId: school.id,
        className: 'SS3A',
        moduleId: modT3First.id,
        title: '[SEED] Lab: simple webpage',
        description: 'Hands-on task for Phase D demo.',
        instructions: 'Submit HTML/CSS/JS (paste code or upload .html). Include header, nav, main, footer, flex/grid CSS, and a button with a click handler.',
        maxScore: 100,
        passScore: 50,
        submissionType: 'html',
        modelAnswer: 'Semantic layout (header, nav, main, footer), CSS flex/grid, JS click handler.',
        lessonObjective: 'Demonstrate a simple responsive webpage with interactivity.',
        isPublished: true,
      } as unknown as Prisma.PracticalTaskCreateInput,
    });
    await prisma.practicalSubmission.upsert({
      where: { taskId_studentId_attempt: { taskId: practicalTaskId, studentId: student.id, attempt: 1 } },
      update: {
        totalScore: 86,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
      create: {
        taskId: practicalTaskId,
        studentId: student.id,
        attempt: 1,
        evidenceText: 'Seed practical evidence',
        totalScore: 86,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
    });
    await prisma.practicalSubmission.upsert({
      where: { taskId_studentId_attempt: { taskId: practicalTaskId, studentId: student2.id, attempt: 1 } },
      update: {
        totalScore: 69,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
      create: {
        taskId: practicalTaskId,
        studentId: student2.id,
        attempt: 1,
        evidenceText: 'Seed practical evidence',
        totalScore: 69,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: tutorUser.id,
      },
    });

    const htmlDemoTaskId = 'seed-practical-ss3a-html-ai';
    const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Adhara Landing Page</title>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .layout { display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1; padding: 24px; }
    nav { padding: 12px; background: #0B2048; color: white; }
  </style>
</head>
<body>
  <div class="layout">
    <header><h1>Adhara Tech Club</h1></header>
    <nav><a href="#home">Home</a></nav>
    <main>
      <p>Welcome to our SS3 web design lab.</p>
      <button id="cta">Join now</button>
    </main>
    <footer><small>© 2026 Crown Heights</small></footer>
  </div>
  <script>
    document.getElementById('cta').addEventListener('click', function () {
      this.textContent = 'Thanks for joining!';
    });
  </script>
</body>
</html>`;
    await prisma.practicalTask.upsert({
      where: { id: htmlDemoTaskId },
      update: {
        submissionType: 'html',
        instructions: 'Build a landing page with semantic HTML, flex layout, and a button that changes text on click.',
      } as unknown as Prisma.PracticalTaskUpdateInput,
      create: {
        id: htmlDemoTaskId,
        tutorId: tutorUser.id,
        schoolId: school.id,
        className: 'SS3A',
        moduleId: modT3First.id,
        title: '[SEED] AI grading demo — HTML landing page',
        description: 'Ungraded submission with pasted HTML for tutor AI suggest grade testing.',
        instructions: 'Build a landing page with semantic HTML, flex layout, and a button that changes text on click.',
        maxScore: 100,
        passScore: 50,
        submissionType: 'html',
        modelAnswer: 'Must include header, nav, main, footer; display:flex; addEventListener click on button.',
        lessonObjective: 'Apply semantic HTML, CSS layout, and basic JavaScript events.',
        isPublished: true,
      } as unknown as Prisma.PracticalTaskCreateInput,
    });
    const htmlDemoEvidence = extractFromHtmlSources([{ filename: 'index.html', content: sampleHtml }]);
    await prisma.practicalSubmission.upsert({
      where: { taskId_studentId_attempt: { taskId: htmlDemoTaskId, studentId: student2.id, attempt: 1 } },
      update: {
        evidenceText: sampleHtml,
        status: 'SUBMITTED',
        totalScore: null,
        gradedAt: null,
        gradedBy: null,
        extractedEvidence: htmlDemoEvidence as any,
        extractionStatus: 'ok',
        extractedAt: new Date(),
        extractionError: null,
        aiProposedScore: null,
        aiProposedFeedback: null,
        aiScoreBreakdown: null,
      } as unknown as Prisma.PracticalSubmissionUpdateInput,
      create: {
        taskId: htmlDemoTaskId,
        studentId: student2.id,
        attempt: 1,
        evidenceText: sampleHtml,
        status: 'SUBMITTED',
        extractedEvidence: htmlDemoEvidence as any,
        extractionStatus: 'ok',
        extractedAt: new Date(),
      } as unknown as Prisma.PracticalSubmissionUncheckedCreateInput,
    });

    await seedEvidenceTypeDemos({
      prisma,
      tutorUserId: tutorUser.id,
      schoolId: school.id,
      moduleId: modT3First.id,
      studentId: student2.id,
      className: 'SS3A',
    });

    await seedAssignmentEvidenceDemos({
      prisma,
      tutorUserId: tutorUser.id,
      schoolId: school.id,
      moduleId: modT3First.id,
      studentId: student2.id,
      className: 'SS3A',
    });

    console.log('✅ Phase D: attendance, curriculum + class assignments, CBT attempts, exam schedule (My Exams), practicals');
  }

  // ── Lakeside Demo Academy — graduated class (production-faithful certificate path) ──
  const lakesideAdminPw = await argon2.hash('SchoolAdmin@123');
  const lakesideAdmin = await prisma.user.upsert({
    where: { email: 'admin@lakeside.demo' },
    update: {
      password: lakesideAdminPw,
      firstName: 'Lakeside',
      lastName: 'Admin',
      role: 'SCHOOL_ADMIN',
    },
    create: {
      email: 'admin@lakeside.demo',
      password: lakesideAdminPw,
      firstName: 'Lakeside',
      lastName: 'Admin',
      role: 'SCHOOL_ADMIN',
    },
  });
  const lakesideSchool = await prisma.school.upsert({
    where: { code: 'LSD' },
    update: {
      notes: lakesideSchoolNotes,
      enrolledTracks: [TrackLevel.TRACK_3],
      officialName: 'Lakeside Demo Academy',
      profileCompletedAt: new Date(),
    } as unknown as Prisma.SchoolUpdateInput,
    create: {
      name: 'Lakeside Demo Academy',
      officialName: 'Lakeside Demo Academy',
      schoolType: 'SECONDARY' as const,
      code: 'LSD',
      address: '8 Innovation Close, Lekki',
      state: 'Lagos',
      lga: 'Eti-Osa',
      principalName: 'Mrs. Adaeze Eze',
      principalPhone: '+234 802 111 2233',
      officialEmail: 'admin@lakeside.demo',
      officialPhone: '+234 802 111 2233',
      platformLevels: ['SS3'],
      currentTermLabel: 'Third Term',
      academicYearLabel: '2025/2026',
      studentCountBand: 'Under 100',
      status: 'APPROVED' as const,
      enrolledTracks: [TrackLevel.TRACK_3],
      feesPerStudent: 8000,
      notes: lakesideSchoolNotes,
      profileCompletedAt: new Date(),
      admins: { connect: { id: lakesideAdmin.id } },
    } as unknown as Prisma.SchoolCreateInput,
  });
  console.log('✅ Lakeside Demo Academy (graduated class SS3B)');

  const lakesideTutorPw = await argon2.hash('Tutor@123');
  const lakesideTutorUser = await prisma.user.upsert({
    where: { email: 'tutor@lakeside.demo' },
    update: {
      password: lakesideTutorPw,
      firstName: 'Ada',
      lastName: 'Bello',
      role: 'TUTOR',
      phone: '+234 803 222 3344',
      schoolId: lakesideSchool.id,
    },
    create: {
      email: 'tutor@lakeside.demo',
      password: lakesideTutorPw,
      firstName: 'Ada',
      lastName: 'Bello',
      role: 'TUTOR',
      phone: '+234 803 222 3344',
      schoolId: lakesideSchool.id,
    },
  });
  const lakesideTutor = await prisma.tutor.upsert({
    where: { userId: lakesideTutorUser.id },
    update: {
      tracks: [TrackLevel.TRACK_3],
      onboardingStatus: 'COMPLETE',
      isVerified: true,
      rating: 4.7,
    },
    create: {
      userId: lakesideTutorUser.id,
      bio: 'Track 3 tutor at Lakeside Demo Academy.',
      specializations: ['Python', 'Flask', 'Web Development'],
      tracks: [TrackLevel.TRACK_3],
      isVerified: true,
      rating: 4.7,
      onboardingStatus: 'COMPLETE',
    },
  });

  // Crown Heights tutor must not retain Lakeside placements (one school per tutor).
  await prisma.tutorAssignment.updateMany({
    where: {
      tutorId: tutor.id,
      schoolId: { not: school.id },
      isActive: true,
    },
    data: { isActive: false, endDate: new Date() },
  });

  await prisma.tutorAssignment.upsert({
    where: { id: 'demo-assignment-lakeside-ss3b' },
    update: {
      tutorId: lakesideTutor.id,
      track3Stack: Track3Stack.PYTHON_FLASK,
      isActive: true,
    } as Prisma.TutorAssignmentUpdateInput,
    create: {
      id: 'demo-assignment-lakeside-ss3b',
      tutorId: lakesideTutor.id,
      schoolId: lakesideSchool.id,
      track: TrackLevel.TRACK_3,
      className: 'SS3B',
      termLabel: '2025/2026 Term 3',
      isActive: true,
      startDate: new Date('2026-01-06'),
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.TutorAssignmentCreateInput,
  });

  const graduateProgress: ProgressRow[] = [
    { score: 88, status: 'COMPLETED' },
    { score: 84, status: 'COMPLETED' },
    { score: 79, status: 'COMPLETED' },
    { score: 82, status: 'COMPLETED' },
    { score: 90, status: 'COMPLETED' },
    { score: 87, status: 'COMPLETED' },
  ];

  const chiomaPw = await argon2.hash('student@031');
  const chiomaUser = await prisma.user.upsert({
    where: { email: 'chioma@lakeside.demo' },
    update: {
      password: chiomaPw,
      firstName: 'Chioma',
      lastName: 'Eze',
      role: 'STUDENT',
      schoolId: lakesideSchool.id,
      username: 'lsd.chioma',
      mustChangePassword: true,
    },
    create: {
      email: 'chioma@lakeside.demo',
      username: 'lsd.chioma',
      password: chiomaPw,
      firstName: 'Chioma',
      lastName: 'Eze',
      role: 'STUDENT',
      schoolId: lakesideSchool.id,
      mustChangePassword: true,
    },
  });
  const chioma = await prisma.student.upsert({
    where: { regNumber: 'LSD/2024/SS3B/031' },
    update: { track3Stack: Track3Stack.PYTHON_FLASK } as Prisma.StudentUpdateInput,
    create: {
      userId: chiomaUser.id,
      schoolId: lakesideSchool.id,
      regNumber: 'LSD/2024/SS3B/031',
      className: 'SS3B',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 3',
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.StudentCreateInput,
  });

  const amaraPw = await argon2.hash('student@032');
  const amaraUser = await prisma.user.upsert({
    where: { email: 'amara@lakeside.demo' },
    update: {
      password: amaraPw,
      firstName: 'Amara',
      lastName: 'Okoro',
      role: 'STUDENT',
      schoolId: lakesideSchool.id,
      username: 'lsd.amara',
      mustChangePassword: true,
    },
    create: {
      email: 'amara@lakeside.demo',
      username: 'lsd.amara',
      password: amaraPw,
      firstName: 'Amara',
      lastName: 'Okoro',
      role: 'STUDENT',
      schoolId: lakesideSchool.id,
      mustChangePassword: true,
    },
  });
  const amara = await prisma.student.upsert({
    where: { regNumber: 'LSD/2024/SS3B/032' },
    update: { track3Stack: Track3Stack.PYTHON_FLASK } as Prisma.StudentUpdateInput,
    create: {
      userId: amaraUser.id,
      schoolId: lakesideSchool.id,
      regNumber: 'LSD/2024/SS3B/032',
      className: 'SS3B',
      track: TrackLevel.TRACK_3,
      termLabel: '2025/2026 Term 3',
      track3Stack: Track3Stack.PYTHON_FLASK,
    } as unknown as Prisma.StudentCreateInput,
  });

  await upsertStudentModuleProgress(chioma.id, track3StandardMods, graduateProgress);
  await upsertStudentModuleProgress(amara.id, track3StandardMods, graduateProgress);

  const track3CompletionMod = await prisma.module.findFirst({
    where: {
      track: TrackLevel.TRACK_3,
      moduleType: ModuleType.TRACK_COMPLETION_EXAM,
      stackVariant: ModuleStackVariant.COMMON,
    } as unknown as Prisma.ModuleWhereInput,
  });
  const completionCbtId = 'seed-cbt-track3-completion';
  if (track3CompletionMod) {
    await prisma.cBTExam.upsert({
      where: { id: completionCbtId },
      update: { moduleId: track3CompletionMod.id, isPublished: true, isVetted: true },
      create: {
        id: completionCbtId,
        tutorId: lakesideTutor.id,
        moduleId: track3CompletionMod.id,
        title: '[SEED] Track 3 Completion Exam',
        description: 'Capstone CBT — required for certificate eligibility (≥50%).',
        track: TrackLevel.TRACK_3,
        durationMins: 45,
        totalQuestions: 20,
        passScore: 50,
        isPublished: true,
        isVetted: true,
      },
    });
    for (const [studentId, attemptId, score] of [
      [chioma.id, 'seed-exam-attempt-chioma-completion', 78],
      [amara.id, 'seed-exam-attempt-amara-completion', 81],
    ] as const) {
      await prisma.examAttempt.upsert({
        where: { id: attemptId },
        update: { score, status: ExamStatus.COMPLETED, submittedAt: new Date() },
        create: {
          id: attemptId,
          cbtExamId: completionCbtId,
          studentId,
          answers: {} as any,
          score,
          totalCorrect: Math.round(score / 5),
          timeTaken: 1200,
          status: ExamStatus.COMPLETED,
          submittedAt: new Date(),
        },
      });
    }
  }

  console.log('✅ Lakeside SS3B graduates — all modules complete + completion exam passed');

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

  // Remove legacy fake certificates that bypassed eligibility rules
  await prisma.certificate.deleteMany({
    where: { serialNumber: { in: ['ADH-CERT-2026-SEED-AISHA', 'ADH-CERT-2026-SEED-TUNDE'] } },
  });

  const chiomaSerial = 'ADH-CERT-2026-DEMO-CHIOMA';
  const chiomaAvg = Math.round(
    graduateProgress.reduce((sum, row) => sum + (row.score || 0), 0) / graduateProgress.length,
  );
  const chiomaCert = await issueDemoCertificateLocal({
    studentId: chioma.id,
    track: TrackLevel.TRACK_3,
    serialNumber: chiomaSerial,
    averageScore: chiomaAvg,
  });
  console.log('✅ Chioma certificate issued (downloadable PDF):', chiomaCert.serialNumber);
  console.log('   Amara is eligible but not issued — use Superadmin → Certificate Authorization to test branded PDF issue.');

  console.log('\n🎉 Seed complete! Demo matches production rules — two schools, two scenarios:\n');
  console.log('  Super Admin:     admin@adharaedu.com / SuperAdmin@123');
  console.log('  Curriculum Lead: curriculum@adharaedu.com / Curriculum@123');
  console.log('  Tutor:           tutor@adharaedu.com / Tutor@123');
  console.log('');
  console.log('  CROWN HEIGHTS (CHR) — SS3A mid-track · test pass / fail / in-progress');
  console.log('    School admin:  admin@crownheights.edu.ng / SchoolAdmin@123');
  console.log('    Aisha:         aisha@crownheights.edu.ng / student@021 — 5/6 done, capstone module in progress, NO cert');
  console.log('    Tunde:         tunde@crownheights.edu.ng / student@022 — Module 3 FAILED (retake), Module 4 in progress, NO cert');
  console.log('    Parent:        funke.okonkwo@gmail.com / Parent@123');
  console.log('');
  console.log('  CROWN HEIGHTS (CHR) — SS1A vs SS1B Track 1 · different class pace + typing lab');
  console.log('    SS1A — 1 module finalized, Module 2 in progress (typing lab unlocked):');
  console.log('    CHR/2026/SS1A/901 / student@901 — Demo Typist');
  console.log('    CHR/2026/SS1A/902 / student@902 — Ada Keys');
  console.log('    CHR/2026/SS1A/903 / student@903 — Samuel Ali');
  console.log('    SS1B — 2 modules finalized, Module 3 in progress (ahead of SS1A):');
  console.log('    CHR/2026/SS1B/901 / student@901 — Mary Okafor');
  console.log('    CHR/2026/SS1B/902 / student@902 — Kemi Adeyemi');
  console.log('    CHR/2026/SS1B/903 / student@903 — Tobi Musa (top Track 1 avg ~89%)');
  console.log('    Leaderboard → All Classes: compare SS1A · 1 module vs SS1B · 2 modules');
  console.log('');
  console.log('  LAKESIDE (LSD) — SS3B graduated · test certificate download + superadmin issue');
  console.log('    Tutor:         tutor@lakeside.demo / Tutor@123');
  console.log('    School admin:  admin@lakeside.demo / SchoolAdmin@123');
  console.log('    Chioma:        chioma@lakeside.demo / student@031 — eligible + cert issued (My Certificates → Download PDF)');
  console.log('    Amara:         amara@lakeside.demo / student@032 — eligible, NOT issued (Superadmin → Certificate Authorization → Issue branded PDF)');
  console.log(`    Verify Chioma: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-certificate/${chiomaSerial}`);
  console.log('');
  console.log('  Superadmin tests: Certificate Authorization → Amara should appear eligible; bulk issue for Lakeside school.\n');
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
