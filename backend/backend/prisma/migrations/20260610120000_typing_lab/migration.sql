-- Typing lab: practice + formal 3-minute tests (formative; does not gate module advance)

CREATE TABLE IF NOT EXISTS "typing_attempts" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "drillKey" TEXT NOT NULL,
  "wpm" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL,
  "correctChars" INTEGER NOT NULL,
  "errorCount" INTEGER NOT NULL,
  "durationSec" INTEGER NOT NULL,
  "isValidScore" BOOLEAN NOT NULL DEFAULT true,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "typing_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "typing_attempts_studentId_moduleId_kind_idx"
  ON "typing_attempts"("studentId", "moduleId", "kind");

CREATE INDEX IF NOT EXISTS "typing_attempts_moduleId_submittedAt_idx"
  ON "typing_attempts"("moduleId", "submittedAt");

ALTER TABLE "typing_attempts" ADD CONSTRAINT "typing_attempts_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "typing_attempts" ADD CONSTRAINT "typing_attempts_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
