CREATE TABLE "practical_tasks" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "dueDate" TIMESTAMP(3),
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "passScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "rubric" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "practical_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "practical_submissions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "evidenceText" TEXT,
    "scoreBreakdown" JSONB,
    "totalScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "gradedBy" TEXT,
    CONSTRAINT "practical_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "practical_submissions_taskId_studentId_key" ON "practical_submissions"("taskId", "studentId");
CREATE INDEX "practical_submissions_studentId_idx" ON "practical_submissions"("studentId");
CREATE INDEX "practical_tasks_schoolId_className_moduleId_idx" ON "practical_tasks"("schoolId", "className", "moduleId");

ALTER TABLE "practical_tasks"
ADD CONSTRAINT "practical_tasks_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "modules"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "practical_submissions"
ADD CONSTRAINT "practical_submissions_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "practical_tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
