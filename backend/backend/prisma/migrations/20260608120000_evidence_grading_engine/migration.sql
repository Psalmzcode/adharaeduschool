-- Evidence Processing Engine: extraction cache, rule results, structured task rubrics
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "submissionType" TEXT NOT NULL DEFAULT 'mixed';
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "allowedExtensions" JSONB;
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "maxSizeMB" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "structuredRubric" JSONB;
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "modelAnswer" TEXT;
ALTER TABLE "practical_tasks" ADD COLUMN IF NOT EXISTS "lessonObjective" TEXT;

ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "extractedEvidence" JSONB;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "extractionStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "extractionError" TEXT;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3);
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "ruleEngineResult" JSONB;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "automatedScore" DOUBLE PRECISION;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "gradingProvider" TEXT;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "gradingModelUsed" TEXT;
