-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "termLabel" TEXT;

-- AlterTable
ALTER TABLE "class_assignment_submissions" ADD COLUMN     "termLabel" TEXT;

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN     "termLabel" TEXT;

-- AlterTable
ALTER TABLE "module_progress" ADD COLUMN     "termLabel" TEXT;

-- AlterTable
ALTER TABLE "practical_submissions" ADD COLUMN     "termLabel" TEXT;

-- AlterTable
ALTER TABLE "session_logs" ADD COLUMN     "termLabel" TEXT;
