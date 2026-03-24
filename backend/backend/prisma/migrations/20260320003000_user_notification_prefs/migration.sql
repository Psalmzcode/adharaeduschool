-- User notification preference toggles (tutor / account settings)
ALTER TABLE "users" ADD COLUMN "notifyNewMessage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notifyReportDeadline" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notifyExamResults" BOOLEAN NOT NULL DEFAULT false;
