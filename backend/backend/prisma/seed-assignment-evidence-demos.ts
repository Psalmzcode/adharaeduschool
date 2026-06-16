import { Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { EvidenceFixtureBuilder } from '../src/evidence-grading/fixtures/evidence-fixture.builder';
import { extractFromDocxBuffer } from '../src/evidence-grading/extractors/word.extractor';
import { extractFromXlsxBuffer } from '../src/evidence-grading/extractors/excel.extractor';
import type { ExtractionStatus, SubmissionEvidence } from '../src/evidence-grading/types/submission-evidence.types';

type SeedCtx = {
  prisma: any;
  tutorUserId: string;
  schoolId: string;
  moduleId: string;
  studentId: string;
  className?: string;
};

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
  score: null,
  feedback: null,
  gradedAt: null,
};

async function uploadSeedBuffer(buffer: Buffer, filename: string): Promise<string | null> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    !process.env.CLOUDINARY_API_KEY?.trim() ||
    !process.env.CLOUDINARY_API_SECRET?.trim()
  ) {
    return null;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'adharaedu/seed-evidence', resource_type: 'raw', public_id: `asg-${filename.replace(/\.[^.]+$/, '')}` },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url)),
    );
    stream.end(buffer);
  });
}

async function persistAssignmentDemo(
  ctx: SeedCtx,
  assignmentId: string,
  title: string,
  submissionType: string,
  instructions: string,
  evidence: SubmissionEvidence,
  status: ExtractionStatus,
  note: string,
  fileUrl?: string | null,
) {
  if (fileUrl) {
    evidence = { ...evidence, metadata: { ...evidence.metadata, sourceUrl: fileUrl } };
  }

  await ctx.prisma.classAssignment.upsert({
    where: { id: assignmentId },
    update: {
      submissionType,
      description: instructions,
      lessonObjective: evidence.metadata?.fileType ? `Seed demo for ${submissionType}` : undefined,
      modelAnswer: submissionType === 'word'
        ? 'Must cover online safety, research skills, and a conclusion.'
        : 'Must include Item/Qty/Price columns and a SUM formula.',
    } as unknown as Prisma.ClassAssignmentUpdateInput,
    create: {
      id: assignmentId,
      tutorId: ctx.tutorUserId,
      schoolId: ctx.schoolId,
      className: ctx.className || 'SS3A',
      moduleId: ctx.moduleId,
      title,
      description: instructions,
      dueDate: new Date(Date.now() + 14 * 86400000),
      maxScore: 100,
      submissionType,
      modelAnswer: submissionType === 'word'
        ? 'Must cover online safety, research skills, and a conclusion.'
        : 'Must include Item/Qty/Price columns and a SUM formula.',
      lessonObjective: `Demonstrate ${submissionType} skills for AI-assisted grading.`,
      isPublished: true,
    } as unknown as Prisma.ClassAssignmentUncheckedCreateInput,
  });

  await ctx.prisma.classAssignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: ctx.studentId } },
    update: {
      fileUrl: fileUrl || null,
      textBody: note,
      status: 'SUBMITTED',
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractionError: null,
      extractedAt: new Date(),
      ...CLEAR_AI_FIELDS,
    } as unknown as Prisma.ClassAssignmentSubmissionUpdateInput,
    create: {
      assignmentId,
      studentId: ctx.studentId,
      fileUrl: fileUrl || null,
      textBody: note,
      status: 'SUBMITTED',
      extractedEvidence: evidence as any,
      extractionStatus: status,
      extractedAt: new Date(),
    } as unknown as Prisma.ClassAssignmentSubmissionUncheckedCreateInput,
  });
}

export async function seedAssignmentEvidenceDemos(ctx: SeedCtx) {
  let uploaded = 0;

  const docxBuf = await EvidenceFixtureBuilder.docx();
  const wordEvidence = await extractFromDocxBuffer(docxBuf, 'digital-citizenship.docx');
  let wordUrl: string | null = null;
  try {
    wordUrl = await uploadSeedBuffer(docxBuf, 'assignment-essay.docx');
    if (wordUrl) uploaded += 1;
  } catch (e) {
    console.warn('⚠️  Assignment seed upload failed (word):', (e as Error).message);
  }
  await persistAssignmentDemo(
    ctx,
    'seed-assignment-ss3a-word-ai',
    '[SEED] AI demo — Word essay assignment',
    'word',
    'Write a 200+ word essay on digital citizenship and submit as .docx.',
    wordEvidence,
    wordEvidence.extractedText?.trim() ? 'ok' : 'failed',
    '[SEED] Word assignment — generated docx fixture',
    wordUrl,
  );

  const xlsxBuf = EvidenceFixtureBuilder.xlsx();
  const excelEvidence = extractFromXlsxBuffer(xlsxBuf, 'club-inventory.xlsx');
  let excelUrl: string | null = null;
  try {
    excelUrl = await uploadSeedBuffer(xlsxBuf, 'assignment-budget.xlsx');
    if (excelUrl) uploaded += 1;
  } catch (e) {
    console.warn('⚠️  Assignment seed upload failed (excel):', (e as Error).message);
  }
  await persistAssignmentDemo(
    ctx,
    'seed-assignment-ss3a-excel-ai',
    '[SEED] AI demo — Excel budget assignment',
    'excel',
    'Build a spreadsheet with headers, data rows, and SUM formulas.',
    excelEvidence,
    (excelEvidence.tables?.length ?? 0) > 0 ? 'ok' : 'failed',
    '[SEED] Excel assignment — generated xlsx fixture',
    excelUrl,
  );

  const uploadNote = uploaded > 0 ? ` (${uploaded}/2 files on Cloudinary)` : '';
  console.log(`✅ Assignment evidence demos: word, excel (Tunde / SS3A)${uploadNote}`);
}
