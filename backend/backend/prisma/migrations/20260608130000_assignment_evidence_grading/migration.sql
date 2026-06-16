-- Evidence grading fields for class assignments (parity with practicals)
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "submissionType" TEXT NOT NULL DEFAULT 'mixed';
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "allowedExtensions" JSONB;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "maxSizeMB" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "structuredRubric" JSONB;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "modelAnswer" TEXT;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "lessonObjective" TEXT;

ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "extractedEvidence" JSONB;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "extractionStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "extractionError" TEXT;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3);
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "ruleEngineResult" JSONB;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "automatedScore" DOUBLE PRECISION;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiProposedScore" DOUBLE PRECISION;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiProposedFeedback" TEXT;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiScoreBreakdown" JSONB;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "aiGradedAt" TIMESTAMP(3);
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "gradingProvider" TEXT;
ALTER TABLE "class_assignment_submissions" ADD COLUMN IF NOT EXISTS "gradingModelUsed" TEXT;
