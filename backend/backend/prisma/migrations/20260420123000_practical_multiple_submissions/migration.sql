-- Allow multiple practical submissions (retakes) per student per task.
-- Adds attempt counter and updates unique constraint.

-- AddColumn
ALTER TABLE "practical_submissions" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;

-- DropIndex (old single-submission constraint)
DROP INDEX IF EXISTS "practical_submissions_taskId_studentId_key";

-- CreateIndex (new multi-attempt constraint)
CREATE UNIQUE INDEX "practical_submissions_taskId_studentId_attempt_key"
ON "practical_submissions"("taskId", "studentId", "attempt");

-- CreateIndex (lookup convenience)
CREATE INDEX "practical_submissions_taskId_studentId_idx"
ON "practical_submissions"("taskId", "studentId");

