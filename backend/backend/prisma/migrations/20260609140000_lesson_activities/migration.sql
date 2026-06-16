-- Lesson-level micro-quizzes and lesson practice assignments (formative; do not gate module advance)

ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "assignmentKind" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "curriculumLessonId" TEXT;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "class_assignments_moduleId_curriculumLessonId_assignmentKind_idx"
  ON "class_assignments"("moduleId", "curriculumLessonId", "assignmentKind");

ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_curriculumLessonId_fkey"
  FOREIGN KEY ("curriculumLessonId") REFERENCES "curriculum_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "lesson_micro_quizzes" (
  "id" TEXT NOT NULL,
  "tutorId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "curriculumLessonId" TEXT NOT NULL,
  "title" TEXT,
  "questions" JSONB NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lesson_micro_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lesson_micro_quizzes_schoolId_className_curriculumLessonId_key"
  ON "lesson_micro_quizzes"("schoolId", "className", "curriculumLessonId");

CREATE INDEX IF NOT EXISTS "lesson_micro_quizzes_moduleId_schoolId_className_idx"
  ON "lesson_micro_quizzes"("moduleId", "schoolId", "className");

ALTER TABLE "lesson_micro_quizzes" ADD CONSTRAINT "lesson_micro_quizzes_curriculumLessonId_fkey"
  FOREIGN KEY ("curriculumLessonId") REFERENCES "curriculum_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "lesson_micro_quiz_attempts" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "answers" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_micro_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lesson_micro_quiz_attempts_quizId_studentId_key"
  ON "lesson_micro_quiz_attempts"("quizId", "studentId");

CREATE INDEX IF NOT EXISTS "lesson_micro_quiz_attempts_studentId_idx"
  ON "lesson_micro_quiz_attempts"("studentId");

ALTER TABLE "lesson_micro_quiz_attempts" ADD CONSTRAINT "lesson_micro_quiz_attempts_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "lesson_micro_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_micro_quiz_attempts" ADD CONSTRAINT "lesson_micro_quiz_attempts_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
