-- Weekly session expectation per tutor class assignment (Phase C)
ALTER TABLE "tutor_assignments" ADD COLUMN "expectedSessionsPerWeek" INTEGER NOT NULL DEFAULT 3;
