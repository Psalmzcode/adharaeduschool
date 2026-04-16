-- Curriculum layer: canonical lessons, class "next lesson" pointer, per-student lesson completion.
-- Role: CURRICULUM_LEAD

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'CURRICULUM_LEAD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "curriculum_lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "outline" JSONB,
    "exercises" JSONB,
    "takeHomeTask" TEXT,
    "quickCheckQuestions" JSONB,
    "resources" JSONB,
    "estimatedDurationMins" INTEGER NOT NULL DEFAULT 60,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_curriculum_state" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "curriculumBranchKey" TEXT NOT NULL,
    "currentLessonId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_curriculum_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_lesson_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sessionId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "quickCheckScore" DOUBLE PRECISION,
    "exerciseScores" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_lesson_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "curriculum_lessons_moduleId_position_key" ON "curriculum_lessons"("moduleId", "position");

CREATE INDEX "curriculum_lessons_moduleId_idx" ON "curriculum_lessons"("moduleId");

CREATE UNIQUE INDEX "class_curriculum_state_schoolId_className_curriculumBranchKey_key"
  ON "class_curriculum_state"("schoolId", "className", "curriculumBranchKey");

CREATE INDEX "class_curriculum_state_schoolId_className_idx" ON "class_curriculum_state"("schoolId", "className");

CREATE UNIQUE INDEX "student_lesson_progress_studentId_lessonId_key" ON "student_lesson_progress"("studentId", "lessonId");

CREATE INDEX "student_lesson_progress_lessonId_idx" ON "student_lesson_progress"("lessonId");

ALTER TABLE "lesson_plans" ADD COLUMN "curriculumLessonId" TEXT;

ALTER TABLE "session_logs" ADD COLUMN "lessonId" TEXT;

CREATE INDEX "session_logs_lessonId_idx" ON "session_logs"("lessonId");

ALTER TABLE "curriculum_lessons"
  ADD CONSTRAINT "curriculum_lessons_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_curriculum_state"
  ADD CONSTRAINT "class_curriculum_state_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_curriculum_state"
  ADD CONSTRAINT "class_curriculum_state_currentLessonId_fkey"
  FOREIGN KEY ("currentLessonId") REFERENCES "curriculum_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_lesson_progress"
  ADD CONSTRAINT "student_lesson_progress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_lesson_progress"
  ADD CONSTRAINT "student_lesson_progress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "curriculum_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_lesson_progress"
  ADD CONSTRAINT "student_lesson_progress_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "session_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lesson_plans"
  ADD CONSTRAINT "lesson_plans_curriculumLessonId_fkey"
  FOREIGN KEY ("curriculumLessonId") REFERENCES "curriculum_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "session_logs"
  ADD CONSTRAINT "session_logs_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "curriculum_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
