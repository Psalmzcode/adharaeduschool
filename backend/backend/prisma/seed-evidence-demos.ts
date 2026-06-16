import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { EvidenceFixtureBuilder } from '../src/evidence-grading/fixtures/evidence-fixture.builder';
import { extractFromDocxBuffer } from '../src/evidence-grading/extractors/word.extractor';
import { extractFromXlsxBuffer } from '../src/evidence-grading/extractors/excel.extractor';
import { extractFromSb3Buffer } from '../src/evidence-grading/extractors/scratch.extractor';
import { extractFromZipBuffer } from '../src/evidence-grading/extractors/zip.extractor';
import { extractFromVisionBuffer } from '../src/evidence-grading/extractors/vision.extractor';
import type { ExtractionStatus, SubmissionEvidence } from '../src/evidence-grading/types/submission-evidence.types';

type SeedCtx = {
  prisma: any;
  tutorUserId: string;
  schoolId: string;
  moduleId: string;
  studentId: string;
  className?: string;
};

type DemoTaskRow = {
  id: string;
  tutorId: string;
  schoolId: string;
  className: string;
  moduleId: string;
  title: string;
  description: string;
  instructions: string;
  maxScore: number;
  passScore: number;
  submissionType: string;
  modelAnswer: string;
  lessonObjective: string;
  isPublished: boolean;
};

function cloudinaryReady(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

async function uploadSeedBuffer(
  buffer: Buffer,
  filename: string,
  resourceType: 'raw' | 'image' = 'raw',
): Promise<string | null> {
  if (!cloudinaryReady()) return null;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'adharaedu/seed-evidence',
        resource_type: resourceType,
        public_id: `demo-${filename.replace(/\.[^.]+$/, '')}`,
      },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url)),
    );
    stream.end(buffer);
  });
}

function tutorEvidenceNote(label: string, evidence: SubmissionEvidence): string {
  if (evidence.codeFiles?.length) {
    const names = evidence.codeFiles.map((f) => f.filename).join(', ');
    return `${label}\n\nFiles in archive: ${names}`;
  }
  const preview = evidence.extractedText?.trim().slice(0, 400);
  return preview && preview.length > label.length ? `${label}\n\n${preview}` : label;
}

const CLEAR_AI_FIELDS = {
  aiProposedScore: null,
  aiProposedFeedback: null,
  aiScoreBreakdown: null,
  aiConfidence: null,
  aiGradedAt: null,
  ruleEngineResult: null,
  automatedScore: null,
  aiScore: null,
  gradingProvider: null,
  gradingModelUsed: null,
  manualReviewRequired: false,
};

async function persistDemoSubmission(
  ctx: SeedCtx,
  taskId: string,
  task: DemoTaskRow,
  evidence: SubmissionEvidence,
  status: ExtractionStatus,
  note: string,
  evidenceUrl?: string | null,
) {
  if (evidenceUrl) {
    evidence = {
      ...evidence,
      metadata: { ...evidence.metadata, sourceUrl: evidenceUrl },
    }
  }
  await ctx.prisma.practicalTask.upsert({
    where: { id: taskId },
    update: {
      submissionType: task.submissionType,
      instructions: task.instructions,
      lessonObjective: task.lessonObjective,
      modelAnswer: task.modelAnswer,
    } as unknown as Prisma.PracticalTaskUpdateInput,
    create: task as unknown as Prisma.PracticalTaskUncheckedCreateInput,
  });

  await ctx.prisma.practicalSubmission.upsert({
    where: { taskId_studentId_attempt: { taskId, studentId: ctx.studentId, attempt: 1 } },
    update: {
      evidenceUrl: evidenceUrl || null,
      evidenceText: tutorEvidenceNote(note, evidence),
      status: 'SUBMITTED',
      totalScore: null,
      gradedAt: null,
      gradedBy: null,
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractionError: null,
      extractedAt: new Date(),
      ...CLEAR_AI_FIELDS,
    } as unknown as Prisma.PracticalSubmissionUpdateInput,
    create: {
      taskId,
      studentId: ctx.studentId,
      attempt: 1,
      evidenceUrl: evidenceUrl || null,
      evidenceText: tutorEvidenceNote(note, evidence),
      status: 'SUBMITTED',
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractedAt: new Date(),
    } as unknown as Prisma.PracticalSubmissionUncheckedCreateInput,
  });
}

export async function seedEvidenceTypeDemos(ctx: SeedCtx) {
  const className = ctx.className || 'SS3A';
  const baseTask = (
    id: string,
    title: string,
    submissionType: string,
    instructions: string,
    objective: string,
    modelAnswer: string,
  ): DemoTaskRow => ({
    id,
    tutorId: ctx.tutorUserId,
    schoolId: ctx.schoolId,
    className,
    moduleId: ctx.moduleId,
    title,
    description: `Seed demo for ${submissionType} AI-assisted grading.`,
    instructions,
    maxScore: 100,
    passScore: 50,
    submissionType,
    modelAnswer,
    lessonObjective: objective,
    isPublished: true,
  });

  let uploadedCount = 0;

  const docxBuf = await EvidenceFixtureBuilder.docx();
  const wordEvidence = await extractFromDocxBuffer(docxBuf, 'digital-citizenship.docx');
  let wordUrl: string | null = null;
  try {
    wordUrl = await uploadSeedBuffer(docxBuf, 'digital-citizenship.docx');
    if (wordUrl) uploadedCount += 1;
  } catch (e) {
    console.warn('⚠️  Seed evidence upload failed (word):', (e as Error).message);
  }
  await persistDemoSubmission(
    ctx,
    'seed-practical-ss3a-word-ai',
    baseTask(
      'seed-practical-ss3a-word-ai',
      '[SEED] AI demo — Word essay (.docx)',
      'word',
      'Write a 200+ word essay on digital citizenship and submit as .docx.',
      'Demonstrate structured writing with headings and paragraphs.',
      'Must cover online safety, research skills, and a conclusion.',
    ),
    wordEvidence,
    wordEvidence.extractedText?.trim() ? 'ok' : 'failed',
    '[SEED] Word demo — extracted from generated docx fixture',
    wordUrl,
  );

  const xlsxBuf = EvidenceFixtureBuilder.xlsx();
  const excelEvidence = extractFromXlsxBuffer(xlsxBuf, 'club-inventory.xlsx');
  let excelUrl: string | null = null;
  try {
    excelUrl = await uploadSeedBuffer(xlsxBuf, 'club-inventory.xlsx');
    if (excelUrl) uploadedCount += 1;
  } catch (e) {
    console.warn('⚠️  Seed evidence upload failed (excel):', (e as Error).message);
  }
  await persistDemoSubmission(
    ctx,
    'seed-practical-ss3a-excel-ai',
    baseTask(
      'seed-practical-ss3a-excel-ai',
      '[SEED] AI demo — Excel budget (.xlsx)',
      'excel',
      'Build a spreadsheet with headers, data rows, and SUM formulas.',
      'Use Excel formulas to calculate totals.',
      'Must include Item/Qty/Price columns and a SUM formula.',
    ),
    excelEvidence,
    (excelEvidence.tables?.length ?? 0) > 0 ? 'ok' : 'failed',
    '[SEED] Excel demo — generated xlsx fixture',
    excelUrl,
  );

  const sb3Buf = await EvidenceFixtureBuilder.sb3();
  const scratchEvidence = await extractFromSb3Buffer(sb3Buf, 'cat-animation.sb3');
  let scratchUrl: string | null = null;
  try {
    scratchUrl = await uploadSeedBuffer(sb3Buf, 'cat-animation.sb3');
    if (scratchUrl) uploadedCount += 1;
  } catch (e) {
    console.warn('⚠️  Seed evidence upload failed (scratch):', (e as Error).message);
  }
  await persistDemoSubmission(
    ctx,
    'seed-practical-ss3a-scratch-ai',
    baseTask(
      'seed-practical-ss3a-scratch-ai',
      '[SEED] AI demo — Scratch animation (.sb3)',
      'scratch',
      'Create a Scratch project with sprites, motion, and a loop.',
      'Animate a sprite when the green flag is clicked.',
      'Must include motion blocks and event handler.',
    ),
    scratchEvidence,
    scratchEvidence.scratchData ? 'ok' : 'failed',
    '[SEED] Scratch demo — generated sb3 fixture',
    scratchUrl,
  );

  const zipBuf = await EvidenceFixtureBuilder.zipWebProject();
  const zipEvidence = await extractFromZipBuffer(zipBuf, 'club-website.zip');
  let zipUrl: string | null = null;
  try {
    zipUrl = await uploadSeedBuffer(zipBuf, 'club-website.zip');
    if (zipUrl) uploadedCount += 1;
  } catch (e) {
    console.warn('⚠️  Seed evidence upload failed (zip):', (e as Error).message);
  }
  await persistDemoSubmission(
    ctx,
    'seed-practical-ss3a-zip-ai',
    baseTask(
      'seed-practical-ss3a-zip-ai',
      '[SEED] AI demo — ZIP web project',
      'zip',
      'Submit a ZIP with index.html, CSS (flex), and JS click handler.',
      'Build a small multi-file website packaged as ZIP.',
      'HTML + CSS flex layout + JS button that updates text.',
    ),
    zipEvidence,
    (zipEvidence.codeFiles?.length ?? 0) > 0 ? 'ok' : 'partial',
    '[SEED] ZIP demo — generated web project archive',
    zipUrl,
  );

  const pngBuf = EvidenceFixtureBuilder.png();
  const config = new ConfigService({ GEMINI_API_KEY: process.env.GEMINI_API_KEY || '' });
  let imageEvidence: SubmissionEvidence;
  let imageStatus: ExtractionStatus = 'ok';

  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const vision = await extractFromVisionBuffer(
        config,
        pngBuf,
        'image/png',
        'screenshot.png',
        'Screenshot of completed ICT assignment.',
      );
      imageEvidence = vision;
      imageStatus = vision.extractedText?.trim() ? 'ok' : 'partial';
    } catch {
      imageEvidence = {
        extractedText:
          'Seed fallback: screenshot shows SS3 club budget page with header, navigation, Calculate button, and total amount field.',
        images: [{ url: 'screenshot.png', description: 'Seed image demo (vision API unavailable during seed)' }],
        metadata: { fileType: 'image', fileName: 'screenshot.png' },
      };
      imageStatus = 'ok';
    }
  } else {
    imageEvidence = {
      extractedText:
        'Seed demo screenshot: page titled "SS3 Club Budget" with navigation, a Calculate button, and a total spend label. Set GEMINI_API_KEY and re-seed for live vision extraction.',
      images: [{ url: 'screenshot.png', description: 'Placeholder image evidence for tutor AI grading demo' }],
      metadata: { fileType: 'image', fileName: 'screenshot.png', validationWarnings: ['Vision skipped — no GEMINI_API_KEY at seed time'] },
    };
    imageStatus = 'ok';
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadSeedBuffer(pngBuf, 'screenshot.png', 'image');
    if (imageUrl) uploadedCount += 1;
  } catch (e) {
    console.warn('⚠️  Seed evidence upload failed (image):', (e as Error).message);
  }

  await persistDemoSubmission(
    ctx,
    'seed-practical-ss3a-image-ai',
    baseTask(
      'seed-practical-ss3a-image-ai',
      '[SEED] AI demo — screenshot / image',
      'image',
      'Submit a screenshot or photo of your completed work.',
      'Capture visible evidence of the finished task.',
      'Screenshot must show the full page/UI with key labels readable.',
    ),
    imageEvidence,
    imageStatus,
    '[SEED] Image demo — png fixture' + (process.env.GEMINI_API_KEY ? ' (vision)' : ' (static fallback)'),
    imageUrl,
  );

  const uploadNote = uploadedCount > 0 ? ` (${uploadedCount}/5 files on Cloudinary)` : ' (no Cloudinary — cached extraction only)';
  console.log(`✅ Evidence type demos: word, excel, scratch, zip, image (Tunde / SS3A)${uploadNote}`);
}
