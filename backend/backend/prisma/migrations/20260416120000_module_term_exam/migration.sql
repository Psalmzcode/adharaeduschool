-- Add term-level exam modules (anchor CBT exams spanning multiple modules)

DO $$ BEGIN
  CREATE TYPE "ModuleType" AS ENUM ('STANDARD', 'TERM_EXAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "modules"
  ADD COLUMN IF NOT EXISTS "moduleType" "ModuleType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "termOrdinal" INTEGER;

