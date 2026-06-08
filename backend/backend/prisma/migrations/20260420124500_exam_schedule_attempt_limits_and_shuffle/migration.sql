-- Add max attempt limits for scheduled exams and store per-attempt randomization variant.

-- AddColumn
ALTER TABLE "exam_schedules" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 1;

-- AddColumn
ALTER TABLE "exam_attempts" ADD COLUMN "variant" JSONB;

