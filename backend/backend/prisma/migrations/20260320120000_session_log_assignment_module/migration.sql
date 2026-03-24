-- Link session logs to tutor assignment (class) and optional curriculum module
ALTER TABLE "session_logs" ADD COLUMN "tutorAssignmentId" TEXT;
ALTER TABLE "session_logs" ADD COLUMN "moduleId" TEXT;

ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_tutorAssignmentId_fkey" FOREIGN KEY ("tutorAssignmentId") REFERENCES "tutor_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "session_logs_tutorAssignmentId_idx" ON "session_logs"("tutorAssignmentId");
CREATE INDEX "session_logs_moduleId_idx" ON "session_logs"("moduleId");
