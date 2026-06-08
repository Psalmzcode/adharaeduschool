-- Phase 1–3: learning delivery + lesson plan publish + practical AI grading
ALTER TABLE "class_curriculum_state" ADD COLUMN IF NOT EXISTS "lastDeliveredLessonId" TEXT;

ALTER TABLE "lesson_plans" ADD COLUMN IF NOT EXISTS "studentHandoutMarkdown" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN IF NOT EXISTS "materialPublishedAt" TIMESTAMP(3);

ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiProposedScore" DOUBLE PRECISION;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiProposedFeedback" TEXT;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiScoreBreakdown" JSONB;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "practical_submissions" ADD COLUMN IF NOT EXISTS "aiGradedAt" TIMESTAMP(3);
