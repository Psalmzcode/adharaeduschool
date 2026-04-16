-- AlterTable
ALTER TABLE "exam_schedules" ADD COLUMN "awaitTutorResultRelease" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exam_schedules" ADD COLUMN "resultsReleasedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN "examScheduleId" TEXT;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "exam_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
